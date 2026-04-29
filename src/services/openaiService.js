const OpenAI = require("openai");
const systemRules = require('../../prompts/systemRules');
const procedureInfo = require('../../prompts/procedureInfo');
const commonQuestions = require('../../prompts/commonQuestions');
const objections = require('../../prompts/objections');
const salesGuidance = require('../../prompts/salesGuidance');
const guardrails = require('../../prompts/guardrails');
const conversationFlow = require('../../prompts/conversationFlow');

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

if (!openai) {
  console.error("OpenAI client NOT initialized - missing API key");
}

const FALLBACK_ESCALATION_BASE = Object.freeze({
  route: 'staff',
  escalate: true,
  escalation_reason: 'fallback_error',
});

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, maxLen) {
  const s = normalizeWhitespace(text);
  if (!maxLen || s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function extractFallbackTopic(message, context = {}) {
  const procedure = typeof context?.procedure === 'string' ? context.procedure.trim() : '';
  if (procedure) return procedure;

  const t = normalizeWhitespace(message).toLowerCase();
  if (!t) return '';

  const matchesAny = (keywords) => keywords.some((k) => t.includes(k));

  if (matchesAny(['price', 'pricing', 'cost', 'quote', 'payment', 'financing', 'insurance'])) return 'pricing';
  if (matchesAny(['recover', 'recovery', 'heal', 'healing', 'downtime', 'swelling', 'bruis', 'pain'])) return 'recovery';
  if (matchesAny(['schedule', 'scheduling', 'book', 'booking', 'consult', 'consultation', 'appointment', 'availability']))
    return 'scheduling';
  if (matchesAny(['candidate', 'candidacy', 'eligible', 'eligibility', 'right for me'])) return 'candidacy';

  if (matchesAny(['rhinoplasty', 'nose job'])) return 'rhinoplasty';
  if (matchesAny(['facelift'])) return 'facelift';
  if (matchesAny(['blepharoplasty', 'eyelid'])) return 'blepharoplasty';
  if (matchesAny(['necklift', 'submental'])) return 'necklift';
  if (matchesAny(['mentoplasty', 'chin'])) return 'mentoplasty';
  if (matchesAny(['otoplasty', 'ear'])) return 'otoplasty';
  if (matchesAny(['co2 laser', 'laser'])) return 'laser';
  if (matchesAny(['chemical peel', 'peel'])) return 'chemical peel';
  if (matchesAny(['filler', 'fillers'])) return 'dermal fillers';

  return 'your question';
}

function buildFallbackReply(message, context = {}) {
  const topic = extractFallbackTopic(message, context);
  if (topic && topic !== 'your question') {
    return `Got it — thanks for asking about ${topic}. I’m going to have someone from the team follow up with you directly to make sure you get the most accurate information.`;
  }
  return `Got it — thanks for reaching out. I’m going to have someone from the team follow up with you directly to make sure you get the most accurate information.`;
}

function buildFallbackEscalation(message, context = {}) {
  const topic = extractFallbackTopic(message, context);
  const msg = truncate(message, 260);
  const staff_summary = [
    'AI fallback triggered due to parsing or response error.',
    topic ? `Topic: ${topic}.` : null,
    msg ? `Message: "${msg}"` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    ...FALLBACK_ESCALATION_BASE,
    reply: buildFallbackReply(message, context),
    staff_summary,
  };
}

function buildUserInputBlock(message, ctxPairs) {
  const lines = ['User input'];
  if (Array.isArray(ctxPairs) && ctxPairs.length) {
    lines.push(`- patient context: ${ctxPairs.join(', ')}`);
  }
  lines.push(`- message: ${String(message || '').trim()}`);
  return lines.join('\n');
}

function isRecoveryRelatedMessage(message) {
  const t = normalizeWhitespace(message).toLowerCase();
  if (!t) return false;

  const keywords = [
    'post op', 'post-op', 'postop', 'after surgery', 'after procedure',
    'recovery', 'recover', 'healing', 'heal', 'downtime',
    'swelling', 'bruis', 'bruise', 'pain', 'sore', 'tender',
    'incision', 'stitch', 'stitches', 'suture', 'bandage', 'dressing',
    'bleeding', 'oozing', 'pus', 'infection', 'fever', 'redness', 'warmth',
    'numb', 'numbness', 'tingling', 'scar', 'scarring',
    'meds', 'medication', 'antibiotic', 'ibuprofen', 'tylenol', 'acetaminophen',
  ];

  return keywords.some((k) => t.includes(k));
}

function buildModularPrompt(userInputBlock, { stage, message } = {}) {
  const stageNorm = String(stage || '').trim().toLowerCase();
  userInputBlock = String(userInputBlock || '').trim();

  const conditionalPrompts = [];

  const isRecovery = stageNorm === 'post_op' || isRecoveryRelatedMessage(message);
  if (isRecovery) {
    conditionalPrompts.push(procedureInfo);
  } else if (stageNorm === 'lead') {
    conditionalPrompts.push(commonQuestions, salesGuidance, objections);
  } else if (stageNorm === 'post_consult') {
    conditionalPrompts.push(salesGuidance, objections);
  }

  return [
    systemRules,
    guardrails,
    conversationFlow,
    ...conditionalPrompts,
    userInputBlock
  ]
  .filter(Boolean)
  .join('\n\n')
  .trim();
}

/**
 * Generate a helpful reply for a lead's message.
 * @param {string} message - The lead's message
 * @param {object} context - Optional metadata to steer replies (e.g. { name, phone, stage, procedure })
 * @returns {Promise<{ reply: string, route: string, escalate: boolean, escalation_reason: string|null, staff_summary: string|null, isQualified: boolean }>}
 */
async function generateReply(message, context = {}) {
  if (!openai) {
    return {
      ...buildFallbackEscalation(message, context),
      isQualified: false,
    };
  }

  const ctxPairs = [
    ['name', context?.name],
    ['phone', context?.phone],
    ['stage', context?.stage],
    ['procedure', context?.procedure],
    ['source', context?.source],
  ]
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([k, v]) => `${k}=${String(v).trim()}`);

  const userInputBlock = buildUserInputBlock(message, ctxPairs);
  const fallbackRoute = String(context?.stage || '').trim() || 'lead';

  try {
    const prompt = buildModularPrompt(userInputBlock, { stage: context?.stage, message });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: prompt.slice(0, 4000)
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 80
    });

    const content = completion.choices?.[0]?.message?.content;

    return {
      reply: content,
      route: context.stage || "lead",
      escalate: false
    };
  } catch (err) {
    console.error("REAL ERROR:", err);
    console.error("FULL OPENAI ERROR:", err);
    console.error('OpenAI generateReply error:', err);
    return {
      ...buildFallbackEscalation(message, context),
      isQualified: false,
    };
  }
}
module.exports = { generateReply };

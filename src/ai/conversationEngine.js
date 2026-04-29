const OpenAI = require('openai');

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SYSTEM_PROMPT = `You are an AI assistant for a cosmetic / medical clinic.
Your job is to convert inquiries into booked consultations.

Rules:
- Respond in short messages (1–2 sentences).
- Be friendly and professional.
- Never give medical advice.
- Never diagnose conditions.
- Never invent pricing.
- Only answer questions about clinic services.

Conversation goals:
1) Identify the lead
2) Identify the procedure interest
3) Move the lead toward booking

Key qualifying questions (use as needed):
- What procedure are you interested in?
- Have you had this treatment before?
- Are you looking to book a consultation?

Scheduling intent examples (if detected, intent MUST be "handoff"):
- "I want to book"
- "Can I schedule"
- "When is your next appointment"
- "I'd like a consultation"

Other intents:
- procedure_question
- pricing_question
- general_question
- handoff

Return JSON ONLY with this exact shape:
{
  "reply": "message to user",
  "intent": "procedure_question | pricing_question | general_question | handoff",
  "lead_name": null,
  "procedure_interest": null
}

Output rules:
- reply must be short and never exceed 2 sentences
- ask questions to move the conversation forward
- keep tone conversational
- do not include any other keys, markdown, code fences, or extra text`;

const ALLOWED_INTENTS = new Set([
  'procedure_question',
  'pricing_question',
  'general_question',
  'handoff',
]);

function detectHandoffIntent(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  return [
    'i want to book',
    'book',
    'schedule',
    'book consultation',
    'book appointment',
    'appointment',
    'consultation',
    'consult',
    'when is your next appointment',
    'next availability',
    'available',
  ].some((p) => t.includes(p));
}

function trimToTwoSentences(text) {
  const s = String(text || '').trim();
  if (!s) return s;
  const parts = s
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 2) return s;
  return `${parts[0]} ${parts[1]}`.trim();
}

function safeJsonParse(maybeJson) {
  if (typeof maybeJson !== 'string') return null;
  const raw = maybeJson.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    // Try to salvage the first JSON object in the string.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

function coerceResult(result, { forceHandoff = false } = {}) {
  const reply = trimToTwoSentences(String(result?.reply || '').trim());

  let intent = String(result?.intent || '').trim();
  if (!ALLOWED_INTENTS.has(intent)) intent = 'general_question';
  if (forceHandoff) intent = 'handoff';

  const lead_name =
    result?.lead_name === null || typeof result?.lead_name === 'string'
      ? result.lead_name
      : null;

  const procedure_interest =
    result?.procedure_interest === null ||
    typeof result?.procedure_interest === 'string'
      ? result.procedure_interest
      : null;

  return {
    reply: reply || 'Thanks for reaching out—what procedure are you interested in, and are you looking to book a consultation?',
    intent,
    lead_name: lead_name || null,
    procedure_interest: procedure_interest || null,
  };
}

function fallbackResponse(messages) {
  const lastUser = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find((m) => m && m.role === 'user' && typeof m.content === 'string');
  const lastText = lastUser?.content || '';
  const forceHandoff = detectHandoffIntent(lastText);

  if (forceHandoff) {
    return {
      reply: 'Great—are you looking to book a consultation, and what procedure are you interested in?',
      intent: 'handoff',
      lead_name: null,
      procedure_interest: null,
    };
  }

  return {
    reply: 'Thanks for reaching out—what procedure are you interested in, and have you had this treatment before?',
    intent: 'general_question',
    lead_name: null,
    procedure_interest: null,
  };
}

/**
 * Generate a JSON-only response for the clinic lead responder.
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @returns {Promise<{reply: string, intent: string, lead_name: string|null, procedure_interest: string|null}>}
 */
async function generateAIResponse(messages) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const lastUser = [...safeMessages]
    .reverse()
    .find((m) => m && m.role === 'user' && typeof m.content === 'string');
  const forceHandoff = detectHandoffIntent(lastUser?.content || '');

  if (!openai) return fallbackResponse(safeMessages);

  const chatMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...safeMessages.map((m) => ({
      role: m.role,
      content: String(m.content ?? ''),
    })),
  ];

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-5.2-fast',
      messages: chatMessages,
      response_format: { type: 'json_object' },
      max_tokens: 220,
    });

    const text = resp.choices?.[0]?.message?.content || '';
    const parsed = safeJsonParse(text);
    if (!parsed) return fallbackResponse(safeMessages);

    return coerceResult(parsed, { forceHandoff });
  } catch (err) {
    console.error('generateAIResponse error:', err);
    return fallbackResponse(safeMessages);
  }
}

module.exports = { generateAIResponse, SYSTEM_PROMPT };


const { supabase } = require('../lib/supabaseClient');
const { generateReply } = require('./openaiService');

const CALENDLY_URL = process.env.CALENDLY_BOOKING_URL || process.env.CALENDLY_LINK || '';

/**
 * Save lead to Supabase, get AI reply, and optionally include booking link.
 * @param {{ phone: string, message: string, name?: string, source?: string }}
 */
async function processLead({ phone, message, name, source = 'form' }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || !message?.trim()) {
    return { success: false, error: 'phone and message are required' };
  }

  let leadId = null;

  if (supabase) {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        phone: normalizedPhone,
        name: name || null,
        message: message.trim(),
        source,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return { success: false, error: 'Failed to save lead' };
    }
    leadId = data?.id;
  }

  const { reply, isQualified } = await generateReply(message.trim(), { name, phone: normalizedPhone });
  let outboundMessage = reply;
  if (isQualified && CALENDLY_URL) {
    outboundMessage += `\n\nBook a consultation here: ${CALENDLY_URL}`;
  }

  if (supabase && leadId) {
    await supabase.from('leads').update({ last_reply_sent: outboundMessage }).eq('id', leadId);
  }

  return {
    success: true,
    leadId,
    reply: outboundMessage,
    qualified: isQualified,
  };
}

function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

module.exports = { processLead, normalizePhone };

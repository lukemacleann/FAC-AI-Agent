const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabaseClient');
const { generateReply } = require('../services/openaiService'); // or wherever your AI function is

const ACTIVE_DEMAND_WRITEBACK_URL =
  process.env.ACTIVEDM_WRITEBACK_URL || 'https://api.activedemand.com/v1/contacts/notes';

async function writeBackToActiveDemand({ identifier, reply, stage }) {
  const apiKey = process.env.ACTIVEDM_API_KEY;
  if (!apiKey) {
    console.warn('ActiveDemand write-back skipped: ACTIVEDM_API_KEY is not configured.');
    return;
  }

  if (!identifier) {
    console.warn('ActiveDemand write-back skipped: no contact identifier was supplied.');
    return;
  }

  if (typeof fetch !== 'function') {
    console.warn('ActiveDemand write-back skipped: global fetch is not available in this runtime.');
    return;
  }

  try {
    const response = await fetch(ACTIVE_DEMAND_WRITEBACK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        contact_identifier: identifier,
        message: reply,
        stage,
        source: 'fac-ai-agent',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `ActiveDemand write-back failed with status ${response.status}: ${errorBody}`
      );
    }
  } catch (error) {
    console.error('ActiveDemand write-back error:', error);
  }
}

router.post('/', async (req, res) => {
  const { message, name, phone, email, tags } = req.body;
  const stage = tags && tags.includes('post_consult') ? 'post_consult' : 'lead';

  try {
    const aiResponse = await generateReply(message, { name, phone, stage });
    const replyText = aiResponse?.reply;
    const contactIdentifier = phone || email;

    await writeBackToActiveDemand({
      identifier: contactIdentifier,
      reply: replyText,
      stage,
    });

    return res.json({
      reply: replyText,
      stage,
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


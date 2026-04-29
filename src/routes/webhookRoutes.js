const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabaseClient');
const { generateReply } = require('../services/openaiService'); // or wherever your AI function is

router.post('/', async (req, res) => {
  const { message, name, phone, tags } = req.body;
  const stage = tags && tags.includes('post_consult') ? 'post_consult' : 'lead';

  try {
    const aiResponse = await generateReply(message, { name, phone, stage });
    const replyText = aiResponse?.reply;

    if (req.body.contact_id) {
      try {
        fetch("https://app.activedemand.com/api/v1/webchat/message", {
          method: "POST",
          headers: {
            "X-API-Key": process.env.ACTIVEDM_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contact_id: req.body.contact_id,
            message: replyText
          })
        }).catch((err) => {
          console.error("ActiveDemand write-back failed:", err.message);
        });
      } catch (err) {
        console.error("ActiveDemand write-back failed:", err.message);
      }
    }

    return res.json({ reply: replyText });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


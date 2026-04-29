const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabaseClient');
const { generateReply } = require('../services/openaiService'); // or wherever your AI function is

router.post('/', async (req, res) => {
  try {
    const { message, name, phone, tags } = req.body;
    const stage = tags && tags.includes('post_consult') ? 'post_consult' : 'lead';
    const reply = await generateReply(message, { name, phone, stage });

    return res.send(reply.reply);

  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;


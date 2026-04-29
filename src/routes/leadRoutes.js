const express = require('express');
const { processLead } = require('../services/leadService');

const router = express.Router();

/**
 * POST /lead
 * Body: { phone, message, name?, source? }
 * Saves lead, generates AI reply, optionally adds Calendly link if qualified.
 */
router.post('/', async (req, res) => {
  try {
    const { phone, message, name, source } = req.body;
    const result = await processLead({
      phone,
      message,
      name: name || undefined,
      source: source || 'form',
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to process lead',
      });
    }

    res.status(201).json({
      success: true,
      leadId: result.leadId,
      qualified: result.qualified,
      reply: result.reply,
      message: 'Lead saved and reply generated.',
    });
  } catch (err) {
    console.error('POST /lead error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

module.exports = router;

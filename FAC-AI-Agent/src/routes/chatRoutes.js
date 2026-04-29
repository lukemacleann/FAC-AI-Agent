const express = require('express');
const { generateReply } = require('../services/openaiService');

const router = express.Router();

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * POST /chat
 * Body: { message: string, stage: string, procedure: string }
 * Returns: { reply: string, stage: string, escalate: boolean }
 */
router.post('/', async (req, res) => {
  try {
    const { message, stage, procedure } = req.body || {};

    if (!isNonEmptyString(message) || !isNonEmptyString(stage) || !isNonEmptyString(procedure)) {
      return res.status(400).json({
        error: 'message, stage, and procedure are required',
      });
    }

    const { reply, escalate } = await generateReply(message.trim(), {
      stage: stage.trim(),
      procedure: procedure.trim(),
    });

    return res.status(200).json({
      reply,
      stage: stage.trim(),
      escalate: Boolean(escalate),
    });
  } catch (err) {
    console.error('POST /chat error:', err);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

module.exports = router;


const path = require('path');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const chatRoutes = require('./src/routes/chatRoutes');
const leadRoutes = require('./src/routes/leadRoutes');
const webhookRoutes = require('./src/routes/webhookRoutes');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/chat', chatRoutes);
app.use('/lead', leadRoutes);
app.use('/webhook', webhookRoutes);

app.post('/test', (req, res) => {
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-lead-conversion' });
});

app.listen(PORT, () => {
  console.log(`AI Lead Conversion API running on http://localhost:${PORT}`);
});

# FAC AI Agent

## Status
Prototype – working webhook flow, not production-ready.

AI-powered lead conversion backend for clinics. Handles web chat input from ActiveDemand, processes it with OpenAI, and returns structured responses via webhook.

---

## Tech Stack

- Node.js + Express
- OpenAI 
- Supabase
- ActiveDemand 
- Webhook-based integration

---

## How It Works

1. User sends a message via ActiveDemand web chat  
2. ActiveDemand triggers a webhook to this backend  
3. Backend processes the message with OpenAI  
4. Backend returns a structured JSON response  
5. ActiveDemand displays the response in chat  

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Environment

Copy `.env.example` → `.env`

Set:
```
OPENAI_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

### 3. Supabase

In Supabase SQL Editor, run:

```
supabase/schema.sql
```

to create the `leads` table.

### 4. Run locally

```bash
npm run dev
```

## API

---

### POST /webhook

#### Request:
```json
{
  "message": "How much is rhinoplasty?",
  "name": "John",
  "phone": "+15555555555",
  "tags": ["lead"]
}
```

#### Response:
```json
{
  "reply": "Rhinoplasty pricing varies, but we can schedule a consultation.",
  "route": "lead",
  "escalate": false,
  "escalation_reason": "",
  "staff_summary": ""
}
```

---

## Project Structure

```
/src
  /lib → supabaseClient.js
  /routes → webhookRoutes.js, leadRoutes.js
  /services → openaiService.js, leadService.js
server.js
```

---

## Notes

- Designed for ActiveDemand workflows  
- `/webhook` is the core endpoint  

## Key Files
- /prompts → AI logic
- /routes/webhookRoutes.js → main endpoint
- /services/openaiService.js → OpenAI calls

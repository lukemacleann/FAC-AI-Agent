-- Run this in Supabase SQL Editor to create the leads table

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text,
  message text not null,
  source text default 'form',
  last_reply_sent text,
  twilio_sid text,
  created_at timestamptz default now()
);

-- Optional: index for looking up leads by phone
create index if not exists idx_leads_phone on public.leads(phone);
create index if not exists idx_leads_created_at on public.leads(created_at desc);

-- Enable RLS if you want row-level security (adjust policies as needed)
-- alter table public.leads enable row level security;

-- Optional: event log table (follow-ups, handoffs, etc.)
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  event_type text not null,
  follow_up_number int,
  message text,
  created_at timestamptz default now()
);

create index if not exists idx_lead_events_phone on public.lead_events(phone);
create index if not exists idx_lead_events_created_at on public.lead_events(created_at desc);

-- Optional: per-clinic configuration for multi-tenant deployments
create table if not exists public.client_settings (
  phone_number text primary key,
  business_timezone text,
  business_hours_start text,
  business_hours_end text,
  review_link text,
  front_desk_phone text,
  created_at timestamptz default now()
);

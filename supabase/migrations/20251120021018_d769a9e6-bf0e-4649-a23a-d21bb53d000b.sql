-- Create customer_insights table
create table if not exists public.customer_insights (
  phone text primary key,              -- E.164 phone number, e.g. +351912345678
  preferred_items jsonb default '[]',  -- array of product_id or product names most ordered
  preferred_addons jsonb default '[]', -- array of addon_id or addon names often chosen
  rejected_items jsonb default '[]',   -- items/addons the customer usually rejects
  average_ticket numeric(10,2),        -- average order total
  order_count integer default 0,       -- number of completed orders
  order_frequency_days integer,        -- typical days between orders (rolling average)
  last_order_id uuid,                  -- reference to orders.id
  last_interaction_at timestamptz,     -- last message or order timestamp
  notes text,                          -- free-form AI notes about the customer
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for efficient queries on last interaction
create index if not exists idx_customer_insights_last_interaction
  on public.customer_insights (last_interaction_at desc);

-- Enable Row Level Security
alter table public.customer_insights enable row level security;

-- RLS Policies for customer_insights
create policy "Public can view customer insights"
  on public.customer_insights
  for select
  using (true);

create policy "Public can insert customer insights"
  on public.customer_insights
  for insert
  with check (true);

create policy "Public can update customer insights"
  on public.customer_insights
  for update
  using (true);

create policy "Public can delete customer insights"
  on public.customer_insights
  for delete
  using (true);

-- Add trigger for automatic updated_at timestamp
create trigger update_customer_insights_updated_at
  before update on public.customer_insights
  for each row
  execute function public.update_updated_at_column();
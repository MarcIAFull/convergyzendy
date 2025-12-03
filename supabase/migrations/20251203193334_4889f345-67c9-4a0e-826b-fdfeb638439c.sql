-- Add get_product_addons tool to conversational agent
INSERT INTO agent_tools (agent_id, tool_name, enabled, ordering, description_override, usage_rules)
VALUES (
  '1b20ff9a-82b1-47cd-aa06-3708ed76d8c3',
  'get_product_addons',
  true,
  15,
  'Get available addons (borders, extras, toppings) for a specific product',
  'Use BEFORE add_to_cart when: 1) Customer mentions customizations (borda, extra, complemento), 2) Adding pizzas or products that typically have addons. Returns addon_ids to use in add_to_cart.'
)
ON CONFLICT (agent_id, tool_name) DO UPDATE SET
  enabled = true,
  usage_rules = EXCLUDED.usage_rules;
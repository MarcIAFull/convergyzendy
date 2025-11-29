-- Insert all 13 tools for the conversational AI agent with proper usage_rules
INSERT INTO agent_tools (agent_id, tool_name, enabled, ordering, usage_rules)
VALUES 
-- 1. search_menu (THE MOST IMPORTANT TOOL)
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'search_menu', true, 1, 
'When to use: ALWAYS call this when the user asks for products, menu, prices, or specific categories.

How to use:
- If user asks for a category (e.g., "Quero Pizzas"): Call { "category": "Pizzas Salgadas" }.
- If user asks for a specific item (e.g., "Tem Coca?"): Call { "query": "Coca" }.
- If user asks "Cardápio": Call { "category": "Destaques" } (or list categories from context).

Constraint: NEVER invent product UUIDs. You must obtain them from this tool''s output.'),

-- 2. add_to_cart
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'add_to_cart', true, 2,
'When to use: When the user explicitly confirms ONE specific product.

Parameter Rule: The product_id MUST be a UUID returned by a previous search_menu call.

Addons: Only use addon_ids if they were listed in the product details from the search. For custom requests (e.g., "sem cebola"), use notes.'),

-- 3. add_pending_item
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'add_pending_item', true, 3,
'When to use: When the user mentions MULTIPLE items (e.g., "Quero uma pizza e uma coca") or is still deciding.

Logic: This allows you to build a list and ask "Confirmas X e Y?" before adding to the real cart.'),

-- 4. confirm_pending_items
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'confirm_pending_items', true, 4,
'When to use: IMMEDIATELY after the user says "Sim" or "Pode ser" to your summary of pending items.

Action: This moves everything from the "temporary list" to the "final cart".'),

-- 5. validate_and_set_delivery_address (CRITICAL - ANTI-LOOP)
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'validate_and_set_delivery_address', true, 5,
'Trigger: ANY text from the user that looks like an address (Street, Number, Neighborhood), even if short (e.g., "Rua 22").

Strict Rule: You MUST call this tool every time a new address is mentioned. DO NOT rely on the address saved in {{customer_info}} if the user provided a new input.

After Call: Wait for the tool response to tell the user the delivery fee.'),

-- 6. update_customer_profile
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'update_customer_profile', true, 6,
'When to use:
- To save the customer''s Name (e.g., "Meu nome é Pedro").
- To save the Payment Method preference (e.g., "Prefiro pagar com cartão").

Restriction: DO NOT use this to save addresses. Use validate_and_set_delivery_address for that.'),

-- 7. set_payment_method
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'set_payment_method', true, 7,
'When to use: When the user explicitly chooses how to pay for the current order.

Values: typically "cash", "card", "mbway".'),

-- 8. finalize_order
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'finalize_order', true, 8,
'Prerequisites:
- Cart is not empty.
- Address has been validated (fee calculated).
- Payment method is set.

Behavior: Call this to close the order. After calling, say "Pedido Confirmado" and STOP asking for more information.'),

-- 9. remove_pending_item
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'remove_pending_item', true, 9,
'When to use: If the user changes their mind about an item while you are still building the order (before moving to the final cart).'),

-- 10. clear_pending_items
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'clear_pending_items', true, 10,
'When to use: If the user gets confused and says "cancela tudo", "começar do zero" (while still choosing).'),

-- 11. remove_from_cart
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'remove_from_cart', true, 11,
'When to use: If the user wants to remove an item that was already confirmed and is in the final cart.'),

-- 12. clear_cart
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'clear_cart', true, 12,
'When to use: Radical reset. User wants to cancel the entire active order and start a completely new one.'),

-- 13. show_cart
('1b20ff9a-82b1-47cd-aa06-3708ed76d8c3', 'show_cart', true, 13,
'When to use: When the user asks "O que eu já pedi?", "Como está a conta?" or "Resumo".')

ON CONFLICT (agent_id, tool_name) DO UPDATE SET
  usage_rules = EXCLUDED.usage_rules,
  ordering = EXCLUDED.ordering,
  enabled = true,
  updated_at = now();
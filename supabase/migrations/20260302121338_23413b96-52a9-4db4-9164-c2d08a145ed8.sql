ALTER TABLE public.restaurant_ai_settings 
ADD COLUMN order_notifications jsonb DEFAULT '{
  "preparing": {"enabled": true, "message": "👨‍🍳 Olá {{customer_name}}! Seu pedido *#{{order_id}}* está sendo preparado! ⏳"},
  "out_for_delivery": {"enabled": true, "message": "🚚 {{customer_name}}, seu pedido *#{{order_id}}* saiu para entrega! 📍"},
  "completed": {"enabled": true, "message": "🎉 {{customer_name}}, seu pedido *#{{order_id}}* foi entregue! Obrigado! ❤️"},
  "cancelled": {"enabled": true, "message": "❌ {{customer_name}}, seu pedido *#{{order_id}}* foi cancelado. Entre em contato para mais informações."}
}'::jsonb;
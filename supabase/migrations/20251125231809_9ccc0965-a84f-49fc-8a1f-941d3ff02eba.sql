-- Fix UPSERT function - use correct ON CONFLICT syntax for partial unique index

CREATE OR REPLACE FUNCTION public.upsert_debounce_message(
  p_restaurant_id UUID,
  p_customer_phone TEXT,
  p_message_body TEXT,
  p_instance_name TEXT,
  p_debounce_seconds INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  message_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_scheduled_at TIMESTAMP WITH TIME ZONE := v_now + (p_debounce_seconds || ' seconds')::INTERVAL;
  v_message_entry JSONB := jsonb_build_object(
    'body', p_message_body,
    'timestamp', v_now
  );
  v_queue_id UUID;
  v_action TEXT;
  v_msg_count INTEGER;
BEGIN
  -- Try to insert new entry, update if conflict on (restaurant_id, customer_phone) WHERE status='pending'
  INSERT INTO public.message_debounce_queue (
    restaurant_id,
    customer_phone,
    messages,
    first_message_at,
    last_message_at,
    scheduled_process_at,
    status,
    metadata
  )
  VALUES (
    p_restaurant_id,
    p_customer_phone,
    jsonb_build_array(v_message_entry),
    v_now,
    v_now,
    v_scheduled_at,
    'pending',
    jsonb_build_object('instanceName', p_instance_name, 'messageCount', 1)
  )
  ON CONFLICT (restaurant_id, customer_phone) WHERE status = 'pending'
  DO UPDATE SET
    messages = message_debounce_queue.messages || v_message_entry,
    last_message_at = v_now,
    scheduled_process_at = v_scheduled_at,
    metadata = jsonb_set(
      message_debounce_queue.metadata,
      '{messageCount}',
      (jsonb_array_length(message_debounce_queue.messages) + 1)::TEXT::JSONB
    ),
    updated_at = v_now
  RETURNING 
    message_debounce_queue.id,
    CASE 
      WHEN message_debounce_queue.created_at = v_now THEN 'created'
      ELSE 'updated'
    END,
    jsonb_array_length(message_debounce_queue.messages)
  INTO v_queue_id, v_action, v_msg_count;

  RETURN QUERY SELECT v_queue_id, v_action, v_msg_count;
END;
$$;
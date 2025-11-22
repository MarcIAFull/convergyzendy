import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecoveryConfig {
  enabled: boolean;
  types: {
    cart_abandoned: {
      enabled: boolean;
      delay_minutes: number;
      max_attempts: number;
      message_template: string;
    };
    conversation_paused: {
      enabled: boolean;
      delay_minutes: number;
      max_attempts: number;
      message_template: string;
    };
    customer_inactive: {
      enabled: boolean;
      delay_days: number;
      max_attempts: number;
      message_template: string;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Recovery] Starting conversation recovery check...');

    // Get all restaurants with active recovery config
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, phone')
      .limit(100);

    if (restaurantsError) throw restaurantsError;

    for (const restaurant of restaurants || []) {
      console.log(`[Recovery] Processing restaurant ${restaurant.id}`);

      // Get agent configuration for this restaurant
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('recovery_config')
        .eq('type', 'assistant')
        .single();

      if (agentError || !agent) {
        console.log('[Recovery] No agent config found, skipping');
        continue;
      }

      const config = agent.recovery_config as RecoveryConfig;

      if (!config || !config.enabled) {
        console.log('[Recovery] Recovery disabled for restaurant, skipping');
        continue;
      }

      // 1. Detect abandoned carts
      if (config.types.cart_abandoned.enabled) {
        await detectAndScheduleCartRecoveries(supabase, restaurant.id, config);
      }

      // 2. Detect paused conversations
      if (config.types.conversation_paused.enabled) {
        await detectAndSchedulePausedConversations(supabase, restaurant.id, config);
      }

      // 3. Detect inactive customers
      if (config.types.customer_inactive.enabled) {
        await detectAndScheduleInactiveCustomers(supabase, restaurant.id, config);
      }

      // 4. Send pending recovery messages
      await sendPendingRecoveryMessages(supabase, restaurant.id, restaurant.phone);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Recovery check completed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Recovery] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function detectAndScheduleCartRecoveries(supabase: any, restaurantId: string, config: RecoveryConfig) {
  console.log('[Recovery] Detecting abandoned carts...');

  const { data: abandonedCarts, error } = await supabase.rpc('detect_abandoned_carts', {
    p_restaurant_id: restaurantId,
    p_delay_minutes: config.types.cart_abandoned.delay_minutes
  });

  if (error) {
    console.error('[Recovery] Error detecting abandoned carts:', error);
    return;
  }

  console.log(`[Recovery] Found ${abandonedCarts?.length || 0} abandoned carts`);

  for (const cart of abandonedCarts || []) {
    await supabase.from('conversation_recovery_attempts').insert({
      restaurant_id: restaurantId,
      user_phone: cart.user_phone,
      cart_id: cart.cart_id,
      recovery_type: 'cart_abandoned',
      attempt_number: 1,
      max_attempts: config.types.cart_abandoned.max_attempts,
      cart_value: cart.cart_value,
      items_count: cart.items_count,
      customer_name: cart.customer_name,
      scheduled_for: new Date(),
      metadata: { template: config.types.cart_abandoned.message_template }
    });
  }
}

async function detectAndSchedulePausedConversations(supabase: any, restaurantId: string, config: RecoveryConfig) {
  console.log('[Recovery] Detecting paused conversations...');

  const { data: pausedConvs, error } = await supabase.rpc('detect_paused_conversations', {
    p_restaurant_id: restaurantId,
    p_delay_minutes: config.types.conversation_paused.delay_minutes
  });

  if (error) {
    console.error('[Recovery] Error detecting paused conversations:', error);
    return;
  }

  console.log(`[Recovery] Found ${pausedConvs?.length || 0} paused conversations`);

  for (const conv of pausedConvs || []) {
    await supabase.from('conversation_recovery_attempts').insert({
      restaurant_id: restaurantId,
      user_phone: conv.user_phone,
      conversation_state_id: conv.conversation_state_id,
      recovery_type: 'conversation_paused',
      attempt_number: 1,
      max_attempts: config.types.conversation_paused.max_attempts,
      last_state: conv.last_state,
      customer_name: conv.customer_name,
      scheduled_for: new Date(),
      metadata: { template: config.types.conversation_paused.message_template }
    });
  }
}

async function detectAndScheduleInactiveCustomers(supabase: any, restaurantId: string, config: RecoveryConfig) {
  console.log('[Recovery] Detecting inactive customers...');

  const { data: inactiveCustomers, error } = await supabase.rpc('detect_inactive_customers', {
    p_restaurant_id: restaurantId,
    p_delay_days: config.types.customer_inactive.delay_days
  });

  if (error) {
    console.error('[Recovery] Error detecting inactive customers:', error);
    return;
  }

  console.log(`[Recovery] Found ${inactiveCustomers?.length || 0} inactive customers`);

  for (const customer of inactiveCustomers || []) {
    const preferredItem = customer.preferred_items?.[0] || 'pedido favorito';
    
    await supabase.from('conversation_recovery_attempts').insert({
      restaurant_id: restaurantId,
      user_phone: customer.user_phone,
      recovery_type: 'customer_inactive',
      attempt_number: 1,
      max_attempts: config.types.customer_inactive.max_attempts,
      customer_name: customer.customer_name,
      scheduled_for: new Date(),
      metadata: { 
        template: config.types.customer_inactive.message_template,
        preferred_item: preferredItem
      }
    });
  }
}

async function sendPendingRecoveryMessages(supabase: any, restaurantId: string, restaurantPhone: string) {
  console.log('[Recovery] Checking for pending recovery messages...');

  // Check business hours (9am - 10pm)
  const now = new Date();
  const hour = now.getHours();
  if (hour < 9 || hour >= 22) {
    console.log('[Recovery] Outside business hours, skipping send');
    return;
  }

  const { data: pendingRecoveries, error } = await supabase
    .from('conversation_recovery_attempts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .limit(10);

  if (error) {
    console.error('[Recovery] Error fetching pending recoveries:', error);
    return;
  }

  console.log(`[Recovery] Found ${pendingRecoveries?.length || 0} pending recovery messages`);

  for (const recovery of pendingRecoveries || []) {
    // Check if customer has recent activity
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${recovery.user_phone},to_number.eq.${recovery.user_phone}`)
      .gte('timestamp', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(1);

    if (recentMessages && recentMessages.length > 0) {
      console.log(`[Recovery] Customer ${recovery.user_phone} has recent activity, marking as recovered`);
      await supabase
        .from('conversation_recovery_attempts')
        .update({ status: 'recovered', recovered_at: now.toISOString() })
        .eq('id', recovery.id);
      continue;
    }

    // Generate personalized message
    const message = generateMessage(recovery);

    // Send via WhatsApp
    const sent = await sendWhatsAppMessage(supabase, restaurantId, restaurantPhone, recovery.user_phone, message);

    if (sent) {
      await supabase
        .from('conversation_recovery_attempts')
        .update({
          status: 'sent',
          message_sent: message,
          sent_at: now.toISOString()
        })
        .eq('id', recovery.id);

      // Log message
      await supabase.from('messages').insert({
        restaurant_id: restaurantId,
        from_number: restaurantPhone,
        to_number: recovery.user_phone,
        body: message,
        direction: 'outbound',
        timestamp: now.toISOString()
      });

      console.log(`[Recovery] ✅ Sent recovery message to ${recovery.user_phone}`);
    } else {
      await supabase
        .from('conversation_recovery_attempts')
        .update({ status: 'failed' })
        .eq('id', recovery.id);
    }
  }
}

function generateMessage(recovery: any): string {
  let template = recovery.metadata?.template || 'Olá! 👋 Posso ajudar?';
  
  template = template.replace('{{customer_name}}', recovery.customer_name || 'Olá');
  template = template.replace('{{items_count}}', recovery.items_count?.toString() || '0');
  template = template.replace('{{cart_value}}', recovery.cart_value?.toFixed(2) || '0');
  
  if (recovery.metadata?.preferred_item) {
    template = template.replace('{{preferred_item}}', recovery.metadata.preferred_item);
  }
  
  return template;
}

async function sendWhatsAppMessage(
  supabase: any,
  restaurantId: string,
  fromPhone: string,
  toPhone: string,
  message: string
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        restaurantId,
        toPhone,
        message
      }
    });

    if (error) {
      console.error('[Recovery] Error sending WhatsApp message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Recovery] Exception sending WhatsApp message:', error);
    return false;
  }
}
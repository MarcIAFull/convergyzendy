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

const COOLDOWN_HOURS = 24;
const ATTEMPT_INTERVALS = {
  1: 60,
  2: 720,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Recovery] Starting conversation recovery check...');

    // Get all restaurants with their per-restaurant recovery config
    const { data: restaurantSettings, error: settingsError } = await supabase
      .from('restaurant_ai_settings')
      .select('restaurant_id, recovery_config')
      .limit(100);

    if (settingsError) throw settingsError;

    // Also get restaurant phones for sending
    const restaurantIds = (restaurantSettings || []).map((s: any) => s.restaurant_id);
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, phone')
      .in('id', restaurantIds.length > 0 ? restaurantIds : ['00000000-0000-0000-0000-000000000000']);

    const phoneMap = new Map((restaurants || []).map((r: any) => [r.id, r.phone]));

    for (const setting of restaurantSettings || []) {
      const config = setting.recovery_config as RecoveryConfig;
      const restaurantId = setting.restaurant_id;
      const restaurantPhone = phoneMap.get(restaurantId);

      if (!config || !config.enabled) {
        continue;
      }

      if (!restaurantPhone) {
        console.log(`[Recovery] No phone for restaurant ${restaurantId}, skipping`);
        continue;
      }

      console.log(`[Recovery] Processing restaurant ${restaurantId}`);

      if (config.types.cart_abandoned.enabled) {
        await detectAndScheduleCartRecoveries(supabase, restaurantId, config);
      }

      if (config.types.conversation_paused.enabled) {
        await detectAndSchedulePausedConversations(supabase, restaurantId, config);
      }

      if (config.types.customer_inactive.enabled) {
        await detectAndScheduleInactiveCustomers(supabase, restaurantId, config);
      }

      await processNextAttempts(supabase, restaurantId);
      await sendPendingRecoveryMessages(supabase, restaurantId, restaurantPhone);
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

async function checkCooldown(supabase: any, restaurantId: string, userPhone: string): Promise<boolean> {
  const cooldownThreshold = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
  
  const { data, error } = await supabase
    .from('conversation_recovery_attempts')
    .select('sent_at')
    .eq('restaurant_id', restaurantId)
    .eq('user_phone', userPhone)
    .in('status', ['sent', 'recovered'])
    .gte('sent_at', cooldownThreshold.toISOString())
    .limit(1);

  if (error) {
    console.error('[Recovery] Error checking cooldown:', error);
    return false;
  }

  return !data || data.length === 0;
}

async function detectAndScheduleCartRecoveries(supabase: any, restaurantId: string, config: RecoveryConfig) {
  console.log('[Recovery] Detecting abandoned carts (WhatsApp + web)...');

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
    const canSend = await checkCooldown(supabase, restaurantId, cart.user_phone);
    if (!canSend) continue;

    await supabase.from('conversation_recovery_attempts').insert({
      restaurant_id: restaurantId,
      user_phone: cart.user_phone,
      cart_id: cart.cart_id,
      recovery_type: 'cart_abandoned',
      attempt_number: 1,
      max_attempts: Math.min(config.types.cart_abandoned.max_attempts, 3),
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
    const canSend = await checkCooldown(supabase, restaurantId, conv.user_phone);
    if (!canSend) continue;

    await supabase.from('conversation_recovery_attempts').insert({
      restaurant_id: restaurantId,
      user_phone: conv.user_phone,
      conversation_state_id: conv.conversation_state_id,
      recovery_type: 'conversation_paused',
      attempt_number: 1,
      max_attempts: Math.min(config.types.conversation_paused.max_attempts, 3),
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
    const canSend = await checkCooldown(supabase, restaurantId, customer.user_phone);
    if (!canSend) continue;

    const preferredItem = customer.preferred_items?.[0] || 'pedido favorito';
    
    await supabase.from('conversation_recovery_attempts').insert({
      restaurant_id: restaurantId,
      user_phone: customer.user_phone,
      recovery_type: 'customer_inactive',
      attempt_number: 1,
      max_attempts: Math.min(config.types.customer_inactive.max_attempts, 3),
      customer_name: customer.customer_name,
      scheduled_for: new Date(),
      metadata: { 
        template: config.types.customer_inactive.message_template,
        preferred_item: preferredItem
      }
    });
  }
}

async function processNextAttempts(supabase: any, restaurantId: string) {
  const now = new Date();

  const { data: sentAttempts, error } = await supabase
    .from('conversation_recovery_attempts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'sent')
    .lte('next_attempt_at', now.toISOString())
    .not('next_attempt_at', 'is', null);

  if (error) {
    console.error('[Recovery] Error fetching attempts for next try:', error);
    return;
  }

  for (const attempt of sentAttempts || []) {
    if (attempt.attempt_number >= attempt.max_attempts) continue;

    const canSend = await checkCooldown(supabase, restaurantId, attempt.user_phone);
    if (!canSend) continue;

    await supabase.from('conversation_recovery_attempts').insert({
      restaurant_id: attempt.restaurant_id,
      user_phone: attempt.user_phone,
      cart_id: attempt.cart_id,
      conversation_state_id: attempt.conversation_state_id,
      recovery_type: attempt.recovery_type,
      attempt_number: attempt.attempt_number + 1,
      max_attempts: attempt.max_attempts,
      cart_value: attempt.cart_value,
      items_count: attempt.items_count,
      last_state: attempt.last_state,
      customer_name: attempt.customer_name,
      scheduled_for: now,
      metadata: attempt.metadata
    });

    await supabase
      .from('conversation_recovery_attempts')
      .update({ next_attempt_at: null })
      .eq('id', attempt.id);
  }
}

async function sendPendingRecoveryMessages(supabase: any, restaurantId: string, restaurantPhone: string) {
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
    .order('attempt_number', { ascending: true })
    .limit(10);

  if (error) {
    console.error('[Recovery] Error fetching pending recoveries:', error);
    return;
  }

  for (const recovery of pendingRecoveries || []) {
    const canSend = await checkCooldown(supabase, restaurantId, recovery.user_phone);
    if (!canSend) {
      await supabase
        .from('conversation_recovery_attempts')
        .update({ status: 'skipped_cooldown' })
        .eq('id', recovery.id);
      continue;
    }

    // Check recent activity in messages AND web_orders
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${recovery.user_phone},to_number.eq.${recovery.user_phone}`)
      .gte('timestamp', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(1);

    const { data: recentWebOrders } = await supabase
      .from('web_orders')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('customer_phone', recovery.user_phone)
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .not('status', 'eq', 'pending')
      .limit(1);

    if ((recentMessages && recentMessages.length > 0) || (recentWebOrders && recentWebOrders.length > 0)) {
      await supabase
        .from('conversation_recovery_attempts')
        .update({ status: 'recovered', recovered_at: now.toISOString() })
        .eq('id', recovery.id);
      continue;
    }

    const message = generateMessage(recovery);
    const sent = await sendWhatsAppMessage(supabase, restaurantId, restaurantPhone, recovery.user_phone, message);

    if (sent) {
      const nextAttemptTime = calculateNextAttemptTime(recovery.attempt_number, now);

      await supabase
        .from('conversation_recovery_attempts')
        .update({
          status: 'sent',
          message_sent: message,
          sent_at: now.toISOString(),
          next_attempt_at: nextAttemptTime
        })
        .eq('id', recovery.id);

      await supabase.from('messages').insert({
        restaurant_id: restaurantId,
        from_number: restaurantPhone,
        to_number: recovery.user_phone,
        body: message,
        direction: 'outbound',
        timestamp: now.toISOString()
      });

      console.log(`[Recovery] ✅ Sent recovery (attempt ${recovery.attempt_number}) to ${recovery.user_phone}`);
    } else {
      await supabase
        .from('conversation_recovery_attempts')
        .update({ status: 'failed' })
        .eq('id', recovery.id);
    }
  }
}

function calculateNextAttemptTime(currentAttempt: number, now: Date): string | null {
  const intervalMinutes = ATTEMPT_INTERVALS[currentAttempt as keyof typeof ATTEMPT_INTERVALS];
  if (!intervalMinutes) return null;
  return new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString();
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
  supabase: any, restaurantId: string, fromPhone: string, toPhone: string, message: string
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: { restaurantId, toPhone, message }
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

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

interface UpdateCustomerInsightsParams {
  phone: string;
  orderId: string;
  total: number;
  items: Array<{
    productId: string;
    productName: string;
    addons?: Array<{ addonId: string; addonName: string }>;
  }>;
  status: 'created' | 'confirmed' | 'canceled';
  now?: Date;
}

interface ItemFrequency {
  id: string;
  name: string;
  count: number;
}

/**
 * Updates customer_insights table after an order is created, confirmed, or canceled.
 * This is deterministic business logic, not AI-driven.
 */
export async function updateCustomerInsightsAfterOrder(
  supabase: SupabaseClient,
  params: UpdateCustomerInsightsParams
): Promise<void> {
  const { phone, orderId, total, items, status, now = new Date() } = params;

  try {
    console.log(`[CustomerInsights] Processing order ${orderId} for phone ${phone} (status: ${status})`);

    // 1) Load existing customer_insights row
    const { data: existingProfile, error: fetchError } = await supabase
      .from('customer_insights')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (fetchError) {
      console.error('[CustomerInsights] Error fetching profile:', fetchError);
      throw fetchError;
    }

    // Initialize counters and data
    let orderCount = existingProfile?.order_count || 0;
    let averageTicket = existingProfile?.average_ticket || 0;
    let preferredItems: ItemFrequency[] = existingProfile?.preferred_items || [];
    let preferredAddons: ItemFrequency[] = existingProfile?.preferred_addons || [];
    let orderFrequencyDays = existingProfile?.order_frequency_days || null;

    // 2) Update counters and averages (only for confirmed orders)
    if (status === 'confirmed' || status === 'created') {
      orderCount += 1;
      
      // Calculate new average ticket
      if (orderCount === 1) {
        averageTicket = total;
      } else {
        // Running average: (old_avg * (n-1) + new_value) / n
        averageTicket = ((averageTicket * (orderCount - 1)) + total) / orderCount;
      }

      // 3) Update preferred items based on frequency
      items.forEach(item => {
        const existingIndex = preferredItems.findIndex((pi: ItemFrequency) => pi.id === item.productId);
        if (existingIndex >= 0) {
          preferredItems[existingIndex].count += 1;
        } else {
          preferredItems.push({
            id: item.productId,
            name: item.productName,
            count: 1,
          });
        }

        // Update preferred addons
        item.addons?.forEach(addon => {
          const addonIndex = preferredAddons.findIndex((pa: ItemFrequency) => pa.id === addon.addonId);
          if (addonIndex >= 0) {
            preferredAddons[addonIndex].count += 1;
          } else {
            preferredAddons.push({
              id: addon.addonId,
              name: addon.addonName,
              count: 1,
            });
          }
        });
      });

      // Sort by count (most preferred first)
      preferredItems.sort((a, b) => b.count - a.count);
      preferredAddons.sort((a, b) => b.count - a.count);

      // 4) Calculate order frequency (days between orders)
      if (existingProfile?.last_interaction_at && orderCount > 1) {
        const lastOrderDate = new Date(existingProfile.last_interaction_at);
        const daysSinceLastOrder = Math.floor(
          (now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (orderFrequencyDays === null) {
          orderFrequencyDays = daysSinceLastOrder;
        } else {
          // Rolling average of order frequency
          orderFrequencyDays = Math.round(
            (orderFrequencyDays * (orderCount - 2) + daysSinceLastOrder) / (orderCount - 1)
          );
        }
      }
    }

    // 5) Prepare upsert data
    const upsertData = {
      phone,
      preferred_items: preferredItems,
      preferred_addons: preferredAddons,
      average_ticket: parseFloat(averageTicket.toFixed(2)),
      order_count: orderCount,
      order_frequency_days: orderFrequencyDays,
      last_order_id: orderId,
      last_interaction_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    // 6) Upsert to database
    const { error: upsertError } = await supabase
      .from('customer_insights')
      .upsert(upsertData, { onConflict: 'phone' });

    if (upsertError) {
      console.error('[CustomerInsights] Error upserting profile:', upsertError);
      throw upsertError;
    }

    console.log(`[CustomerInsights] ✅ Updated profile for phone ${phone}`, {
      orderCount,
      averageTicket: averageTicket.toFixed(2),
      preferredItemsCount: preferredItems.length,
      orderFrequencyDays,
    });
  } catch (error) {
    // Log error but don't break the main flow
    console.error('[CustomerInsights] Failed to update customer insights:', error);
    console.error('[CustomerInsights] This is non-critical - continuing with order flow');
  }
}

/**
 * Retrieves customer insights for a given phone number
 * Returns a clean JSON structure suitable for AI consumption
 */
export async function getCustomerInsights(
  supabase: SupabaseClient,
  phone: string
): Promise<any | null> {
  try {
    console.log(`[CustomerInsights] Fetching insights for phone: ${phone}`);
    
    const { data: insights, error } = await supabase
      .from('customer_insights')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (error) {
      console.error('[CustomerInsights] Error fetching insights:', error);
      return null;
    }

    if (!insights) {
      console.log('[CustomerInsights] No insights found for phone:', phone);
      return null;
    }

    // Return clean structure
    return {
      phone: insights.phone,
      order_count: insights.order_count || 0,
      average_ticket: insights.average_ticket ? parseFloat(insights.average_ticket.toFixed(2)) : null,
      order_frequency_days: insights.order_frequency_days,
      preferred_items: insights.preferred_items || [],
      preferred_addons: insights.preferred_addons || [],
      rejected_items: insights.rejected_items || [],
      last_order_id: insights.last_order_id,
      last_interaction_at: insights.last_interaction_at,
      notes: insights.notes,
    };
  } catch (error) {
    console.error('[CustomerInsights] Failed to get customer insights:', error);
    return null;
  }
}

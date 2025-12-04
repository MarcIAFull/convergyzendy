import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeliveryZone {
  id: string;
  name: string;
  coordinates: any;
  fee_type: 'fixed' | 'per_km' | 'tiered';
  fee_amount: number;
  min_order_amount: number | null;
  max_delivery_time_minutes: number | null;
  is_active: boolean;
  priority: number;
}

interface ValidationResult {
  valid: boolean;
  zone?: DeliveryZone;
  delivery_fee: number;
  estimated_time_minutes: number;
  distance_km: number;
  error?: string;
}

// Haversine formula to calculate distance between two coordinates
function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Check if point is inside circle
function isPointInCircle(
  pointLat: number, pointLng: number,
  centerLat: number, centerLng: number,
  radiusKm: number
): boolean {
  const distance = calculateDistance(pointLat, pointLng, centerLat, centerLng);
  return distance <= radiusKm;
}

// Check if point is inside polygon using ray casting algorithm
function isPointInPolygon(lat: number, lng: number, polygon: Array<{lat: number, lng: number}>): boolean {
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Calculate delivery fee based on zone type
function calculateDeliveryFee(
  zone: DeliveryZone,
  distanceKm: number
): number {
  switch (zone.fee_type) {
    case 'fixed':
      return zone.fee_amount;
    
    case 'per_km':
      return zone.fee_amount * distanceKm;
    
    case 'tiered':
      // Assuming coordinates contains tiers like: [{distance: 5, fee: 3}, {distance: 10, fee: 5}]
      if (zone.coordinates.tiers && Array.isArray(zone.coordinates.tiers)) {
        const tiers = zone.coordinates.tiers.sort((a: any, b: any) => a.distance - b.distance);
        
        for (const tier of tiers) {
          if (distanceKm <= tier.distance) {
            return tier.fee;
          }
        }
        
        // If distance exceeds all tiers, use the last tier's fee
        return tiers[tiers.length - 1].fee;
      }
      return zone.fee_amount;
    
    default:
      return zone.fee_amount;
  }
}

// Estimate delivery time
function estimateDeliveryTime(distanceKm: number, zone?: DeliveryZone): number {
  const baseTime = 10; // 10 minutes prep time
  const travelTime = distanceKm * 2; // 2 minutes per km (average urban speed)
  const estimated = Math.ceil(baseTime + travelTime);
  
  // Cap at zone's max delivery time if specified
  if (zone?.max_delivery_time_minutes) {
    return Math.min(estimated, zone.max_delivery_time_minutes);
  }
  
  return estimated;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurant_id, lat, lng, order_amount } = await req.json();

    if (!restaurant_id || lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: restaurant_id, lat, lng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get restaurant location
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('latitude, longitude')
      .eq('id', restaurant_id)
      .single();

    if (restaurantError || !restaurant) {
      return new Response(
        JSON.stringify({ error: 'Restaurante não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!restaurant.latitude || !restaurant.longitude) {
      return new Response(
        JSON.stringify({ error: 'Restaurante sem localização configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate distance from restaurant to delivery address
    const distance = calculateDistance(
      restaurant.latitude,
      restaurant.longitude,
      lat,
      lng
    );

    console.log(`Distance from restaurant to delivery address: ${distance.toFixed(2)} km`);

    // Get active delivery zones sorted by priority (ASCENDING = smaller zones first!)
    // This ensures addresses close to the restaurant match Zone 1 before Zone 5
    const { data: zones, error: zonesError } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (zonesError) {
      throw new Error(`Error fetching zones: ${zonesError.message}`);
    }

    console.log(`[Zones] Found ${zones?.length || 0} active delivery zones`);

    if (!zones || zones.length === 0) {
      // No zones configured, use simple radius check with default delivery fee
      console.log('[Zones] No zones configured, using default 10km radius');
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('delivery_fee')
        .eq('id', restaurant_id)
        .single();

      const maxDistance = 10; // Default 10km radius
      
      if (distance > maxDistance) {
        console.log(`[Zones] ❌ Distance ${distance.toFixed(2)}km exceeds default max ${maxDistance}km`);
        return new Response(
          JSON.stringify({
            valid: false,
            error: `Endereço fora da área de entrega (máximo ${maxDistance}km)`,
            distance_km: parseFloat(distance.toFixed(2))
          } as ValidationResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const deliveryFee = restaurantData?.delivery_fee || 0;
      const estimatedTime = estimateDeliveryTime(distance);
      console.log(`[Zones] ✅ Within default zone - Fee: €${deliveryFee}, Time: ${estimatedTime}min`);

      return new Response(
        JSON.stringify({
          valid: true,
          delivery_fee: deliveryFee,
          estimated_time_minutes: estimatedTime,
          distance_km: parseFloat(distance.toFixed(2))
        } as ValidationResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which zone contains the delivery address
    let matchedZone: DeliveryZone | null = null;
    console.log(`[Zones] Checking ${zones.length} zones for point (${lat}, ${lng})`);

    for (const zone of zones) {
      const coords = zone.coordinates;
      console.log(`[Zones] Checking zone "${zone.name}" - Type: ${coords.type}`);

      // Check if it's a circle zone
      if (coords.type === 'circle' && coords.center && coords.radius) {
        const distanceFromZoneCenter = calculateDistance(lat, lng, coords.center.lat, coords.center.lng);
        console.log(`[Zones] Circle zone - Center: (${coords.center.lat}, ${coords.center.lng}), Radius: ${coords.radius}km`);
        console.log(`[Zones] Distance from zone center: ${distanceFromZoneCenter.toFixed(2)}km`);
        
        if (isPointInCircle(lat, lng, coords.center.lat, coords.center.lng, coords.radius)) {
          console.log(`[Zones] ✅ Point is INSIDE circle zone "${zone.name}"`);
          matchedZone = zone;
          break;
        } else {
          console.log(`[Zones] ❌ Point is OUTSIDE circle zone "${zone.name}" (${distanceFromZoneCenter.toFixed(2)}km > ${coords.radius}km)`);
        }
      }

      // Check if it's a polygon zone
      if (coords.type === 'polygon' && coords.points && Array.isArray(coords.points)) {
        console.log(`[Zones] Polygon zone - ${coords.points.length} points`);
        if (isPointInPolygon(lat, lng, coords.points)) {
          console.log(`[Zones] ✅ Point is INSIDE polygon zone "${zone.name}"`);
          matchedZone = zone;
          break;
        } else {
          console.log(`[Zones] ❌ Point is OUTSIDE polygon zone "${zone.name}"`);
        }
      }
    }

    if (!matchedZone) {
      console.log(`[Zones] ❌ No matching zone found for address at (${lat}, ${lng})`);
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Endereço fora da área de entrega',
          distance_km: parseFloat(distance.toFixed(2))
        } as ValidationResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check minimum order amount
    if (order_amount !== undefined && matchedZone.min_order_amount) {
      if (order_amount < matchedZone.min_order_amount) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: `Valor mínimo do pedido: €${matchedZone.min_order_amount.toFixed(2)}`,
            zone: matchedZone,
            distance_km: parseFloat(distance.toFixed(2))
          } as ValidationResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate delivery fee
    const deliveryFee = calculateDeliveryFee(matchedZone, distance);
    const estimatedTime = estimateDeliveryTime(distance, matchedZone);

    console.log(`Valid delivery - Zone: ${matchedZone.name}, Fee: €${deliveryFee}, Time: ${estimatedTime}min`);

    return new Response(
      JSON.stringify({
        valid: true,
        zone: matchedZone,
        delivery_fee: parseFloat(deliveryFee.toFixed(2)),
        estimated_time_minutes: estimatedTime,
        distance_km: parseFloat(distance.toFixed(2))
      } as ValidationResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

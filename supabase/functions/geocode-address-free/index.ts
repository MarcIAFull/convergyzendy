import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodingResult {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id?: string;
  address_components?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();

    if (!address || address.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Endereço muito curto' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check cache first
    const { data: cachedAddress } = await supabase
      .from('address_cache')
      .select('*')
      .eq('address_query', address.toLowerCase().trim())
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cachedAddress) {
      console.log('Returning cached address for:', address);
      return new Response(
        JSON.stringify({
          lat: parseFloat(cachedAddress.latitude),
          lng: parseFloat(cachedAddress.longitude),
          formatted_address: cachedAddress.formatted_address,
          place_id: cachedAddress.google_place_id,
          address_components: cachedAddress.address_components,
          source: 'cache'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Nominatim API
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(address)}&` +
      `format=json&` +
      `addressdetails=1&` +
      `limit=1&` +
      `countrycodes=pt`;

    console.log('Calling Nominatim for:', address);

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'ZendyDeliveryApp/1.0',
        'Accept-Language': 'pt'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Endereço não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = data[0];
    const geocodingResult: GeocodingResult = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      formatted_address: result.display_name,
      place_id: result.place_id?.toString(),
      address_components: result.address
    };

    // Cache the result (90 days TTL)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await supabase.from('address_cache').insert({
      address_query: address.toLowerCase().trim(),
      latitude: geocodingResult.lat,
      longitude: geocodingResult.lng,
      formatted_address: geocodingResult.formatted_address,
      google_place_id: geocodingResult.place_id,
      address_components: geocodingResult.address_components,
      expires_at: expiresAt.toISOString()
    });

    console.log('Geocoded and cached:', address);

    return new Response(
      JSON.stringify({ ...geocodingResult, source: 'nominatim' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Geocoding error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

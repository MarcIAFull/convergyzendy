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
  source?: string;
}

// Normalize address for better geocoding
function normalizeAddress(address: string): string {
  return address
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s,áàâãéèêíïóôõöúçñ-]/gi, '');
}

// Extract Portuguese postal code (####-###)
function extractPostalCode(address: string): string | null {
  const match = address.match(/\b\d{4}-\d{3}\b/);
  return match ? match[0] : null;
}

// Provider 1: Photon (Komoot) - More accurate, free
async function tryPhoton(address: string): Promise<GeocodingResult | null> {
  try {
    // Photon works better with more complete addresses
    // Try with Portugal bias first, then without
    const urls = [
      `https://photon.komoot.io/api/?q=${encodeURIComponent(address + ' Portugal')}&limit=1&lang=pt`,
      `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1&lang=pt`
    ];
    
    for (const url of urls) {
      console.log('Photon: Trying URL:', url);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ZendyDeliveryApp/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.log('Photon: API error:', response.status);
        continue;
      }

      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        console.log('Photon: No results found');
        continue;
      }

      const feature = data.features[0];
      const props = feature.properties;
      
      const formattedAddress = [
        props.name,
        props.street,
        props.housenumber,
        props.postcode,
        props.city,
        props.state,
        props.country
      ].filter(Boolean).join(', ');

      console.log('Photon: Success!', formattedAddress);

      return {
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        formatted_address: formattedAddress,
        place_id: props.osm_id?.toString(),
        address_components: props,
        source: 'photon'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Photon error:', error);
    return null;
  }
}

// Provider 2: Nominatim (fallback)
async function tryNominatim(address: string, countryCode: boolean = true, addPortugal: boolean = false): Promise<GeocodingResult | null> {
  try {
    const searchAddress = addPortugal ? `${address}, Portugal` : address;
    let url = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(searchAddress)}&` +
      `format=json&` +
      `addressdetails=1&` +
      `limit=3`;
    
    if (countryCode) {
      url += `&countrycodes=pt`;
    }

    console.log(`Nominatim: Trying "${searchAddress}" (countryCode=${countryCode})`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ZendyDeliveryApp/1.0',
        'Accept-Language': 'pt'
      }
    });

    if (!response.ok) {
      console.log('Nominatim: API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.log('Nominatim: No results found');
      return null;
    }

    // Pick best result (prefer ones with street/housenumber)
    const result = data.find((r: any) => r.address?.road || r.address?.street) || data[0];
    console.log('Nominatim: Success!', result.display_name);

    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      formatted_address: result.display_name,
      place_id: result.place_id?.toString(),
      address_components: result.address,
      source: 'nominatim'
    };
  } catch (error) {
    console.error('Nominatim error:', error);
    return null;
  }
}

// Provider 3: Nominatim with postal code only
async function tryNominatimPostalCode(address: string): Promise<GeocodingResult | null> {
  const postalCode = extractPostalCode(address);
  
  if (!postalCode) {
    console.log('PostalCode: No postal code found in address');
    return null;
  }

  // Try with postal code + last part (usually city)
  const parts = address.split(',').map((p: string) => p.trim());
  const cityPart = parts[parts.length - 1];
  const searchQuery = `${postalCode} ${cityPart}`;

  console.log('PostalCode: Trying simplified search:', searchQuery);
  
  return tryNominatim(searchQuery, true);
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

    const normalizedAddress = normalizeAddress(address);
    console.log('=== Geocoding request ===');
    console.log('Original:', address);
    console.log('Normalized:', normalizedAddress);

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
      console.log('Cache hit!');
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

    // Try providers in order of accuracy with multiple strategies
    console.log('--- Strategy 1: Photon ---');
    let result = await tryPhoton(normalizedAddress);
    
    if (!result) {
      console.log('--- Strategy 2: Nominatim PT + Portugal suffix ---');
      result = await tryNominatim(normalizedAddress, true, true);
    }
    
    if (!result) {
      console.log('--- Strategy 3: Nominatim PT only ---');
      result = await tryNominatim(normalizedAddress, true, false);
    }
    
    if (!result) {
      console.log('--- Strategy 4: Nominatim no filter + Portugal ---');
      result = await tryNominatim(normalizedAddress, false, true);
    }
    
    if (!result) {
      console.log('--- Strategy 5: Nominatim no filter ---');
      result = await tryNominatim(normalizedAddress, false, false);
    }
    
    if (!result && address.includes(',')) {
      console.log('--- Strategy 6: Postal code extraction ---');
      result = await tryNominatimPostalCode(address);
    }

    if (!result) {
      console.log('❌ All geocoding strategies failed');
      
      // Check if address is too incomplete
      const hasPostalCode = /\d{4}-\d{3}/.test(address);
      const hasComma = address.includes(',');
      
      let errorMsg = 'Endereço não encontrado. ';
      if (!hasPostalCode && !hasComma) {
        errorMsg += 'O endereço está incompleto. Inclua código postal e cidade (ex: Rua X, 8125-248 Quarteira)';
      } else if (!hasPostalCode) {
        errorMsg += 'Adicione o código postal para melhor precisão (ex: 8125-248)';
      } else {
        errorMsg += 'Verifique se o endereço está correto.';
      }
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Geocoding successful via:', result.source);

    // Cache the result (90 days TTL)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await supabase.from('address_cache').insert({
      address_query: address.toLowerCase().trim(),
      latitude: result.lat,
      longitude: result.lng,
      formatted_address: result.formatted_address,
      google_place_id: result.place_id,
      address_components: result.address_components,
      expires_at: expiresAt.toISOString()
    });

    return new Response(
      JSON.stringify(result),
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

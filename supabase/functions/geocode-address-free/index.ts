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

// Provider 0: Google Geocoding API (maximum accuracy) - returns multiple
async function tryGoogleGeocoding(address: string, limit: number = 1): Promise<GeocodingResult[]> {
  const apiKey = Deno.env.get('GOOGLE_GEOCODING_API_KEY');
  
  if (!apiKey) {
    console.log('Google: API key not configured, skipping...');
    return [];
  }
  
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?` +
      `address=${encodeURIComponent(address)}&` +
      `region=pt&` +
      `language=pt&` +
      `key=${apiKey}`;
    
    console.log('Google: Trying geocoding...');
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results?.length) {
      console.log('Google: No results, status:', data.status);
      return [];
    }
    
    const results = data.results.slice(0, limit).map((result: any) => ({
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      place_id: result.place_id,
      address_components: result.address_components,
      source: 'google'
    }));
    
    console.log(`Google: Found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Google Geocoding error:', error);
    return [];
  }
}

// Provider 1: Photon (Komoot) - returns multiple
async function tryPhoton(address: string, cityContext?: string, limit: number = 1): Promise<GeocodingResult[]> {
  try {
    const contextSuffix = cityContext || 'Quarteira, Algarve, Portugal';
    const urls = [
      `https://photon.komoot.io/api/?q=${encodeURIComponent(address + ', ' + contextSuffix)}&limit=${limit}&lang=pt`,
      `https://photon.komoot.io/api/?q=${encodeURIComponent(address + ' Portugal')}&limit=${limit}&lang=pt`,
      `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=${limit}&lang=pt`
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

      const results = data.features.slice(0, limit).map((feature: any) => {
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

        return {
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          formatted_address: formattedAddress,
          place_id: props.osm_id?.toString(),
          address_components: props,
          source: 'photon'
        };
      });

      console.log(`Photon: Found ${results.length} results`);
      return results;
    }
    
    return [];
  } catch (error) {
    console.error('Photon error:', error);
    return [];
  }
}

// Provider 2: Nominatim (fallback) - returns multiple
async function tryNominatim(address: string, countryCode: boolean = true, addPortugal: boolean = false, limit: number = 1): Promise<GeocodingResult[]> {
  try {
    const searchAddress = addPortugal ? `${address}, Portugal` : address;
    let url = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(searchAddress)}&` +
      `format=json&` +
      `addressdetails=1&` +
      `limit=${limit}`;
    
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
      return [];
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.log('Nominatim: No results found');
      return [];
    }

    const results = data.slice(0, limit).map((result: any) => ({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      formatted_address: result.display_name,
      place_id: result.place_id?.toString(),
      address_components: result.address,
      source: 'nominatim'
    }));
    
    console.log(`Nominatim: Found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Nominatim error:', error);
    return [];
  }
}

// Provider 3: Nominatim with postal code only
async function tryNominatimPostalCode(address: string, limit: number = 1): Promise<GeocodingResult[]> {
  const postalCode = extractPostalCode(address);
  
  if (!postalCode) {
    console.log('PostalCode: No postal code found in address');
    return [];
  }

  const parts = address.split(',').map((p: string) => p.trim());
  const cityPart = parts[parts.length - 1];
  const searchQuery = `${postalCode} ${cityPart}`;

  console.log('PostalCode: Trying simplified search:', searchQuery);
  
  return tryNominatim(searchQuery, true, false, limit);
}

// Deduplicate results by formatted_address similarity
function deduplicateResults(results: GeocodingResult[]): GeocodingResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    const key = r.formatted_address.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, force_refresh, multi } = await req.json();

    if (!address || address.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Endereço muito curto' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedAddress = normalizeAddress(address);
    const wantMulti = multi === true;
    const resultLimit = wantMulti ? 5 : 1;
    
    console.log('=== Geocoding request ===');
    console.log('Original:', address);
    console.log('Normalized:', normalizedAddress);
    console.log('Force refresh:', force_refresh);
    console.log('Multi:', wantMulti);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // If force_refresh, delete old cache first
    if (force_refresh) {
      console.log('Force refresh enabled, clearing cache...');
      const { error: deleteError } = await supabase
        .from('address_cache')
        .delete()
        .eq('address_query', address.toLowerCase().trim());
      
      if (deleteError) {
        console.error('Error clearing cache:', deleteError);
      } else {
        console.log('Cache cleared successfully');
      }
    }

    // Check cache first (only for single result, not multi)
    if (!force_refresh && !wantMulti) {
      console.log('Checking cache...');
      const { data: cachedAddress } = await supabase
        .from('address_cache')
        .select('*')
        .eq('address_query', address.toLowerCase().trim())
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cachedAddress) {
        console.log('Cache hit! Source:', cachedAddress.google_place_id ? 'google' : 'nominatim');
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
    }

    console.log('Cache miss or force refresh, trying providers...');

    // Collect all results from multiple providers
    let allResults: GeocodingResult[] = [];

    console.log('--- Strategy 0: Google Geocoding API ---');
    const googleResults = await tryGoogleGeocoding(normalizedAddress, resultLimit);
    allResults.push(...googleResults);
    
    if (allResults.length < resultLimit) {
      console.log('--- Strategy 1: Photon with Quarteira/Algarve context ---');
      const photonResults = await tryPhoton(normalizedAddress, 'Quarteira, Algarve, Portugal', resultLimit);
      allResults.push(...photonResults);
    }
    
    if (allResults.length < resultLimit) {
      console.log('--- Strategy 2: Photon without context ---');
      const photonResults2 = await tryPhoton(normalizedAddress, undefined, resultLimit);
      allResults.push(...photonResults2);
    }
    
    if (allResults.length < resultLimit) {
      console.log('--- Strategy 3: Nominatim PT + Portugal suffix ---');
      const nomResults = await tryNominatim(normalizedAddress, true, true, resultLimit);
      allResults.push(...nomResults);
    }
    
    if (allResults.length < resultLimit) {
      console.log('--- Strategy 4: Nominatim PT only ---');
      const nomResults2 = await tryNominatim(normalizedAddress, true, false, resultLimit);
      allResults.push(...nomResults2);
    }
    
    if (allResults.length < resultLimit) {
      console.log('--- Strategy 5: Nominatim no filter + Portugal ---');
      const nomResults3 = await tryNominatim(normalizedAddress, false, true, resultLimit);
      allResults.push(...nomResults3);
    }
    
    if (allResults.length === 0 && address.includes(',')) {
      console.log('--- Strategy 6: Postal code extraction ---');
      const postalResults = await tryNominatimPostalCode(address, resultLimit);
      allResults.push(...postalResults);
    }

    // Deduplicate
    allResults = deduplicateResults(allResults);

    if (allResults.length === 0) {
      console.log('❌ All geocoding strategies failed');
      
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

    console.log(`✅ Geocoding successful, ${allResults.length} result(s)`);

    // For multi mode, return array of suggestions
    if (wantMulti) {
      return new Response(
        JSON.stringify({ suggestions: allResults.slice(0, 5) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single result mode (backward compatible)
    const result = allResults[0];

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

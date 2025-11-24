# Especificação Técnica - Fase 4: Geolocalização & Validação

## 📋 Visão Geral

Sistema completo de geolocalização com Google Maps API para validação de endereços, cálculo de distância, definição de áreas de entrega, e cálculo dinâmico de taxas de entrega baseadas em distância.

### Objetivos Principais
- ✅ Autocomplete de endereços com Google Places API
- ✅ Validação de raio de entrega
- ✅ Cálculo de distância e tempo estimado
- ✅ Taxa de entrega dinâmica baseada em distância
- ✅ Definição visual de zonas de entrega (polígonos)
- ✅ Cálculo automático de ETA (Estimated Time of Arrival)
- ✅ Suporte para múltiplas zonas com taxas diferentes

---

## 🗄️ Database Schema

### Nova Tabela: `delivery_zones`
```sql
CREATE TABLE public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Nome da Zona
  name TEXT NOT NULL, -- ex: "Centro", "Zona Norte", "Zona Sul"
  
  -- Geometria (polígono ou círculo)
  zone_type TEXT NOT NULL DEFAULT 'circle', -- 'circle', 'polygon'
  
  -- Para círculo
  center_lat NUMERIC,
  center_lng NUMERIC,
  radius_km NUMERIC,
  
  -- Para polígono (array de coordenadas)
  polygon_coords JSONB, -- [[lat1,lng1], [lat2,lng2], ...]
  
  -- Configurações de Entrega
  delivery_fee NUMERIC NOT NULL,
  delivery_fee_type TEXT DEFAULT 'fixed', -- 'fixed', 'per_km', 'tiered'
  
  -- Taxa por km (se delivery_fee_type = 'per_km')
  fee_per_km NUMERIC,
  base_fee NUMERIC,
  
  -- Taxa escalonada (se delivery_fee_type = 'tiered')
  tiered_fees JSONB, 
  -- Ex: [
  --   {"max_km": 3, "fee": 5.00},
  --   {"max_km": 6, "fee": 8.00},
  --   {"max_km": 10, "fee": 12.00}
  -- ]
  
  -- Tempo estimado
  estimated_time_minutes INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- ordem de avaliação (maior = primeiro)
  
  -- Horários específicos (opcional)
  active_hours JSONB, -- Ex: {"monday": {"start": "08:00", "end": "22:00"}}
  
  -- Valor mínimo do pedido para esta zona
  min_order_value NUMERIC,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_delivery_zones_restaurant ON delivery_zones(restaurant_id);
CREATE INDEX idx_delivery_zones_active ON delivery_zones(is_active) WHERE is_active = true;
CREATE INDEX idx_delivery_zones_priority ON delivery_zones(priority DESC);

-- RLS
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant delivery zones"
  ON delivery_zones FOR ALL
  USING (user_has_restaurant_access(restaurant_id));

-- Public pode visualizar zonas ativas (para menu público)
CREATE POLICY "Public can view active delivery zones"
  ON delivery_zones FOR SELECT
  USING (is_active = true);
```

### Nova Tabela: `address_cache`
```sql
-- Cache de geocodificação para economizar chamadas à API
CREATE TABLE public.address_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Endereço original
  address_input TEXT NOT NULL UNIQUE,
  
  -- Geocodificação
  formatted_address TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  
  -- Componentes do endereço
  street_name TEXT,
  street_number TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  
  -- Place ID do Google (para referência)
  place_id TEXT,
  
  -- Metadata
  confidence_score NUMERIC, -- 0-1
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  verification_count INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_address_cache_input ON address_cache(address_input);
CREATE INDEX idx_address_cache_place_id ON address_cache(place_id);
CREATE INDEX idx_address_cache_city ON address_cache(city);

-- Sem RLS - apenas service role pode acessar
```

### Nova Tabela: `distance_matrix_cache`
```sql
-- Cache de cálculos de distância
CREATE TABLE public.distance_matrix_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Origem e Destino
  origin_lat NUMERIC NOT NULL,
  origin_lng NUMERIC NOT NULL,
  destination_lat NUMERIC NOT NULL,
  destination_lng NUMERIC NOT NULL,
  
  -- Resultados
  distance_km NUMERIC NOT NULL,
  duration_minutes INTEGER NOT NULL,
  
  -- Modo de transporte
  travel_mode TEXT DEFAULT 'driving', -- 'driving', 'walking', 'bicycling'
  
  -- Timestamp
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Para evitar duplicatas
  UNIQUE(origin_lat, origin_lng, destination_lat, destination_lng, travel_mode)
);

-- Indexes
CREATE INDEX idx_distance_matrix_origin ON distance_matrix_cache(origin_lat, origin_lng);
CREATE INDEX idx_distance_matrix_calculated ON distance_matrix_cache(calculated_at DESC);
```

### Alterar Tabela: `restaurants`
```sql
-- Adicionar coordenadas do restaurante
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC,
  ADD COLUMN IF NOT EXISTS address_place_id TEXT;

-- Index
CREATE INDEX idx_restaurants_location ON restaurants(lat, lng);
```

---

## 🔌 Edge Functions

### `geocode-address`
```typescript
// supabase/functions/geocode-address/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    
    if (!address) {
      throw new Error('Endereço não fornecido');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Verificar cache
    const { data: cached } = await supabase
      .from('address_cache')
      .select('*')
      .eq('address_input', address.toLowerCase().trim())
      .single();

    if (cached) {
      console.log('Address found in cache');
      return new Response(
        JSON.stringify(cached),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Geocodificar com Google Maps
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new Error('Endereço não encontrado. Por favor, verifique e tente novamente.');
    }

    const result = data.results[0];
    const location = result.geometry.location;

    // 3. Extrair componentes do endereço
    const components: any = {};
    result.address_components.forEach((component: any) => {
      if (component.types.includes('street_number')) {
        components.street_number = component.long_name;
      }
      if (component.types.includes('route')) {
        components.street_name = component.long_name;
      }
      if (component.types.includes('sublocality') || component.types.includes('neighborhood')) {
        components.neighborhood = component.long_name;
      }
      if (component.types.includes('locality')) {
        components.city = component.long_name;
      }
      if (component.types.includes('administrative_area_level_1')) {
        components.state = component.short_name;
      }
      if (component.types.includes('postal_code')) {
        components.postal_code = component.long_name;
      }
      if (component.types.includes('country')) {
        components.country = component.long_name;
      }
    });

    // 4. Calcular confidence score
    const confidence_score = calculateConfidenceScore(result);

    // 5. Salvar no cache
    const addressData = {
      address_input: address.toLowerCase().trim(),
      formatted_address: result.formatted_address,
      lat: location.lat,
      lng: location.lng,
      place_id: result.place_id,
      confidence_score,
      ...components
    };

    await supabase
      .from('address_cache')
      .insert(addressData);

    return new Response(
      JSON.stringify(addressData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateConfidenceScore(result: any): number {
  let score = 0.5; // base score

  // Tipo de localização
  if (result.geometry.location_type === 'ROOFTOP') {
    score += 0.3; // endereço exato
  } else if (result.geometry.location_type === 'RANGE_INTERPOLATED') {
    score += 0.2; // interpolado
  } else if (result.geometry.location_type === 'GEOMETRIC_CENTER') {
    score += 0.1; // centro geométrico
  }

  // Partial match
  if (!result.partial_match) {
    score += 0.2; // match completo
  }

  return Math.min(score, 1.0);
}
```

### `validate-delivery-address`
```typescript
// supabase/functions/validate-delivery-address/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurantId, lat, lng } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Buscar restaurante e suas coordenadas
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*, delivery_zones(*)')
      .eq('id', restaurantId)
      .single();

    if (!restaurant || !restaurant.lat || !restaurant.lng) {
      throw new Error('Restaurante não configurado para delivery');
    }

    // 2. Calcular distância do restaurante ao endereço
    const distance = calculateHaversineDistance(
      { lat: restaurant.lat, lng: restaurant.lng },
      { lat, lng }
    );

    // 3. Verificar zonas de entrega (por prioridade)
    const zones = restaurant.delivery_zones
      .filter((z: any) => z.is_active)
      .sort((a: any, b: any) => b.priority - a.priority);

    let matchedZone = null;
    let deliveryFee = null;

    for (const zone of zones) {
      if (zone.zone_type === 'circle') {
        // Verificar se está dentro do círculo
        if (distance <= zone.radius_km) {
          matchedZone = zone;
          break;
        }
      } else if (zone.zone_type === 'polygon') {
        // Verificar se está dentro do polígono
        if (isPointInPolygon({ lat, lng }, zone.polygon_coords)) {
          matchedZone = zone;
          break;
        }
      }
    }

    if (!matchedZone) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Endereço fora da área de entrega',
          distance_km: distance
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Calcular taxa de entrega
    deliveryFee = calculateDeliveryFee(matchedZone, distance);

    // 5. Calcular tempo estimado usando Google Distance Matrix API
    const duration = await calculateDuration(
      { lat: restaurant.lat, lng: restaurant.lng },
      { lat, lng }
    );

    return new Response(
      JSON.stringify({
        valid: true,
        zone: {
          id: matchedZone.id,
          name: matchedZone.name
        },
        distance_km: distance,
        delivery_fee: deliveryFee,
        estimated_time_minutes: duration,
        min_order_value: matchedZone.min_order_value
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateHaversineDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): number {
  const R = 6371; // Raio da Terra em km
  
  const dLat = (destination.lat - origin.lat) * Math.PI / 180;
  const dLng = (destination.lng - origin.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(origin.lat * Math.PI / 180) * 
            Math.cos(destination.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: number[][]
): boolean {
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
                     (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

function calculateDeliveryFee(zone: any, distance: number): number {
  if (zone.delivery_fee_type === 'fixed') {
    return zone.delivery_fee;
  }
  
  if (zone.delivery_fee_type === 'per_km') {
    return zone.base_fee + (distance * zone.fee_per_km);
  }
  
  if (zone.delivery_fee_type === 'tiered') {
    for (const tier of zone.tiered_fees) {
      if (distance <= tier.max_km) {
        return tier.fee;
      }
    }
    // Se passou de todos os tiers, usa o último
    return zone.tiered_fees[zone.tiered_fees.length - 1].fee;
  }
  
  return zone.delivery_fee;
}

async function calculateDuration(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<number> {
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')!;
  
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
    const durationSeconds = data.rows[0].elements[0].duration.value;
    return Math.ceil(durationSeconds / 60);
  }
  
  // Fallback: estimativa de 2 min/km
  const distance = calculateHaversineDistance(origin, destination);
  return Math.ceil(distance * 2);
}
```

---

## 🎨 Componentes Frontend

### Estrutura de Páginas

```
src/pages/delivery/
├── DeliveryZones.tsx        # Gestão de zonas de entrega

src/components/delivery/
├── ZoneEditor.tsx           # Editor de zonas (mapa + form)
├── ZoneMap.tsx              # Mapa interativo para desenhar zonas
├── AddressAutocomplete.tsx  # Campo com autocomplete de endereços
└── DeliveryFeeCalculator.tsx # Preview de taxa calculada
```

### Hook de Geocoding
```typescript
// src/hooks/useGeocoding.ts

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useGeocoding() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function geocodeAddress(address: string) {
    setLoading(true);
    setError(null);

    try {
      const { data, error: geocodeError } = await supabase.functions.invoke(
        'geocode-address',
        { body: { address } }
      );

      if (geocodeError) throw geocodeError;

      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function validateDeliveryAddress(
    restaurantId: string,
    lat: number,
    lng: number
  ) {
    setLoading(true);
    setError(null);

    try {
      const { data, error: validationError } = await supabase.functions.invoke(
        'validate-delivery-address',
        { body: { restaurantId, lat, lng } }
      );

      if (validationError) throw validationError;

      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return {
    geocodeAddress,
    validateDeliveryAddress,
    loading,
    error
  };
}
```

### Componente AddressAutocomplete
```typescript
// src/components/delivery/AddressAutocomplete.tsx

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { useGeocoding } from '@/hooks/useGeocoding';

interface AddressAutocompleteProps {
  onAddressSelect: (address: any) => void;
  placeholder?: string;
}

export function AddressAutocomplete({ 
  onAddressSelect, 
  placeholder = 'Digite seu endereço' 
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const autocompleteService = useRef<any>(null);
  const { geocodeAddress } = useGeocoding();

  useEffect(() => {
    // Inicializar Google Places Autocomplete
    if (window.google && !autocompleteService.current) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
    }
  }, []);

  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  async function fetchSuggestions() {
    if (!autocompleteService.current) return;

    autocompleteService.current.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: ['pt', 'br'] } // Portugal e Brasil
      },
      (predictions: any[], status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          setSuggestions(predictions);
        }
      }
    );
  }

  async function handleSelectSuggestion(suggestion: any) {
    setQuery(suggestion.description);
    setSuggestions([]);

    // Geocodificar endereço selecionado
    const address = await geocodeAddress(suggestion.description);
    
    if (address) {
      onAddressSelect(address);
    }
  }

  return (
    <div className="relative">
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
      
      {suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.place_id}
              className="px-4 py-2 hover:bg-muted cursor-pointer"
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <p className="text-sm">{suggestion.structured_formatting.main_text}</p>
              <p className="text-xs text-muted-foreground">
                {suggestion.structured_formatting.secondary_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 🚀 Implementação (Estimativa: 2 semanas)

### Sprint 1 (Semana 1): Backend + Geocoding
- [ ] Migrations: delivery_zones, address_cache
- [ ] Edge function: geocode-address
- [ ] Edge function: validate-delivery-address
- [ ] Testes de validação

### Sprint 2 (Semana 1-2): Frontend
- [ ] AddressAutocomplete component
- [ ] useGeocoding hook
- [ ] DeliveryZones page
- [ ] ZoneEditor com mapa

### Sprint 3 (Semana 2): Integração
- [ ] Integrar com checkout
- [ ] Cálculo automático de taxa
- [ ] Preview de zona no mapa
- [ ] Testes E2E

---

## 📝 Checklist Final

- [ ] Google Maps API Key configurada
- [ ] Geocoding funcionando
- [ ] Validação de zonas testada
- [ ] Taxa dinâmica calculando corretamente
- [ ] Cache funcionando
- [ ] Autocomplete responsivo
- [ ] Documentação completa

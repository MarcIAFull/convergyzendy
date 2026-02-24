import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GeocodingResult {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id?: string;
  address_components?: any;
  source?: 'cache' | 'nominatim' | 'photon' | 'google';
}

interface ValidationResult {
  valid: boolean;
  zone?: any;
  delivery_fee: number;
  estimated_time_minutes: number;
  distance_km: number;
  error?: string;
}

export const useGeocoding = () => {
  const [loading, setLoading] = useState(false);

  const geocodeAddress = async (
    address: string, 
    forceRefresh: boolean = false
  ): Promise<GeocodingResult | null> => {
    if (!address || address.trim().length < 3) {
      toast.error('Endereço muito curto');
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode-address-free', {
        body: { address, force_refresh: forceRefresh }
      });

      if (error) throw error;

      return data as GeocodingResult;
    } catch (error: any) {
      console.error('Geocoding error:', error);
      toast.error(error.message || 'Erro ao buscar endereço');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const geocodeAddressMulti = async (
    address: string
  ): Promise<GeocodingResult[]> => {
    if (!address || address.trim().length < 3) {
      return [];
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode-address-free', {
        body: { address, multi: true }
      });

      if (error) throw error;

      return (data as any)?.suggestions || [];
    } catch (error: any) {
      console.error('Geocoding multi error:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const validateDeliveryAddress = async (
    restaurant_id: string,
    lat: number,
    lng: number,
    order_amount?: number
  ): Promise<ValidationResult | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-delivery-address', {
        body: { restaurant_id, lat, lng, order_amount }
      });

      if (error) throw error;

      return data as ValidationResult;
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(error.message || 'Erro ao validar endereço');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    geocodeAddress,
    geocodeAddressMulti,
    validateDeliveryAddress
  };
};

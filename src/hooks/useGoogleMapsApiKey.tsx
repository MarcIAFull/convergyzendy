import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGoogleMapsApiKey = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-maps-api-key');
        if (error) throw error;
        
        if (data?.apiKey) {
          setApiKey(data.apiKey);
        } else {
          throw new Error('API Key not returned');
        }
      } catch (err: any) {
        console.error('Error fetching Google Maps API key:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  return { apiKey, loading, error };
};

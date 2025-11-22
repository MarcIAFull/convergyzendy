import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useRestaurantStore } from '@/stores/restaurantStore';

interface UseRestaurantGuardResult {
  loading: boolean;
  error: string | null;
  ready: boolean;
  retry: () => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [500, 1000, 2000]; // Exponential backoff
const TIMEOUT_MS = 10000; // 10 second safety timeout

export const useRestaurantGuard = (): UseRestaurantGuardResult => {
  const { user, session, loading: authLoading } = useAuth();
  const { restaurant, loading: restaurantLoading, error: restaurantError, fetchRestaurant } = useRestaurantStore();
  const navigate = useNavigate();
  
  const [retryCount, setRetryCount] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const reset = useCallback(() => {
    setRetryCount(0);
    setLocalError(null);
    setHasTimedOut(false);
    setIsReady(false);
  }, []);

  const attemptFetch = useCallback(async () => {
    console.log('[useRestaurantGuard] 🚀 Attempting fetch, retry:', retryCount);
    try {
      await fetchRestaurant();
    } catch (error) {
      console.error('[useRestaurantGuard] ❌ Fetch failed:', error);
      
      if (retryCount < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[retryCount];
        console.log(`[useRestaurantGuard] 🔄 Retrying in ${delay}ms...`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, delay);
      } else {
        setLocalError('Falha ao carregar dados do restaurante após múltiplas tentativas');
      }
    }
  }, [fetchRestaurant, retryCount]);

  // Main effect: handle authentication and restaurant fetch
  useEffect(() => {
    // Reset ready state when dependencies change
    setIsReady(false);

    // Wait for auth to complete
    if (authLoading) {
      console.log('[useRestaurantGuard] ⏳ Waiting for auth...');
      return;
    }

    // No user or session - redirect to login
    if (!user || !session?.access_token) {
      console.log('[useRestaurantGuard] 🚪 No auth, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    // User authenticated but no restaurant loaded yet
    if (!restaurant && !restaurantLoading && !restaurantError && !localError && !hasTimedOut) {
      console.log('[useRestaurantGuard] 🔍 Authenticated, fetching restaurant...');
      attemptFetch();
      return;
    }

    // Restaurant loaded successfully
    if (restaurant && !restaurantLoading) {
      console.log('[useRestaurantGuard] ✅ Restaurant loaded, ready!');
      setIsReady(true);
      return;
    }

    // No restaurant after successful fetch - needs onboarding
    if (!restaurant && !restaurantLoading && retryCount >= MAX_RETRIES - 1) {
      console.log('[useRestaurantGuard] 🚪 No restaurant after retries, redirecting to onboarding');
      navigate('/onboarding', { replace: true });
      return;
    }
  }, [
    user, 
    session, 
    authLoading, 
    restaurant, 
    restaurantLoading, 
    restaurantError,
    localError,
    hasTimedOut,
    retryCount,
    attemptFetch,
    navigate
  ]);

  // Safety timeout
  useEffect(() => {
    if (authLoading || !user) return;

    const timeoutId = setTimeout(() => {
      if (!restaurant && !hasTimedOut) {
        console.error('[useRestaurantGuard] ⏱️ Timeout reached');
        setHasTimedOut(true);
        setLocalError('Tempo limite excedido ao carregar dados');
      }
    }, TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [authLoading, user, restaurant, hasTimedOut]);

  const retry = useCallback(() => {
    console.log('[useRestaurantGuard] 🔄 Manual retry triggered');
    reset();
    attemptFetch();
  }, [reset, attemptFetch]);

  const loading = authLoading || restaurantLoading || (!restaurant && !localError && !hasTimedOut);
  const error = localError || restaurantError;

  return {
    loading,
    error,
    ready: isReady,
    retry
  };
};

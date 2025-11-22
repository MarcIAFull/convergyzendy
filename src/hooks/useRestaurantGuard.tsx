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
    console.log('[useRestaurantGuard] 🚀 attemptFetch called', {
      retryCount,
      currentAttempt: retryCount + 1,
      maxRetries: MAX_RETRIES,
      timestamp: new Date().toISOString()
    });
    
    try {
      console.log('[useRestaurantGuard] 📞 Calling fetchRestaurant()...');
      await fetchRestaurant();
      console.log('[useRestaurantGuard] ✅ fetchRestaurant() completed successfully');
    } catch (error) {
      console.error('[useRestaurantGuard] ❌ fetchRestaurant() failed:', {
        error: error instanceof Error ? error.message : error,
        retryCount,
        willRetry: retryCount < MAX_RETRIES - 1
      });
      
      if (retryCount < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[retryCount];
        console.log(`[useRestaurantGuard] 🔄 Scheduling retry ${retryCount + 2} in ${delay}ms...`);
        setTimeout(() => {
          console.log('[useRestaurantGuard] ⏰ Executing retry, incrementing retry count');
          setRetryCount(prev => prev + 1);
        }, delay);
      } else {
        console.error('[useRestaurantGuard] 🚫 Max retries reached, setting error');
        setLocalError('Falha ao carregar dados do restaurante após múltiplas tentativas');
      }
    }
  }, [fetchRestaurant, retryCount]);

  // Main effect: handle authentication and restaurant fetch
  useEffect(() => {
    console.log('[useRestaurantGuard] 🔄 useEffect triggered with state:', {
      authLoading,
      hasUser: !!user,
      hasSession: !!session?.access_token,
      hasRestaurant: !!restaurant,
      restaurantLoading,
      restaurantError,
      localError,
      hasTimedOut,
      retryCount,
      isReady,
      timestamp: new Date().toISOString()
    });

    // Reset ready state when dependencies change
    setIsReady(false);

    // Wait for auth to complete
    if (authLoading) {
      console.log('[useRestaurantGuard] ⏳ BRANCH: Waiting for auth...');
      return;
    }

    // No user or session - redirect to login
    if (!user || !session?.access_token) {
      console.log('[useRestaurantGuard] 🚪 BRANCH: No auth, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    // User authenticated but no restaurant loaded yet
    if (!restaurant && !restaurantLoading && !restaurantError && !localError && !hasTimedOut) {
      console.log('[useRestaurantGuard] 🔍 BRANCH: Authenticated, fetching restaurant...', {
        willCallAttemptFetch: true,
        retryCount
      });
      attemptFetch();
      return;
    }

    // Restaurant loaded successfully
    if (restaurant && !restaurantLoading) {
      console.log('[useRestaurantGuard] ✅ BRANCH: Restaurant loaded, marking ready!', {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name
      });
      setIsReady(true);
      return;
    }

    // No restaurant after successful fetch - needs onboarding
    if (!restaurant && !restaurantLoading && retryCount >= MAX_RETRIES - 1) {
      console.log('[useRestaurantGuard] 🚪 BRANCH: No restaurant after retries, redirecting to onboarding');
      navigate('/onboarding', { replace: true });
      return;
    }

    console.log('[useRestaurantGuard] ⚠️ BRANCH: No condition matched, doing nothing', {
      restaurant: !!restaurant,
      restaurantLoading,
      retryCount,
      maxRetries: MAX_RETRIES
    });
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

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useRestaurantStore } from '@/stores/restaurantStore';

interface UseRestaurantGuardResult {
  loading: boolean;
  error: string | null;
  ready: boolean;
  retry: () => void;
  restaurant: any | null;
}

const TIMEOUT_MS = 10000; // 10 second safety timeout

export const useRestaurantGuard = (): UseRestaurantGuardResult => {
  const { user, session, loading: authLoading } = useAuth();
  const { restaurant, loading: restaurantLoading, error: restaurantError, fetchRestaurant } = useRestaurantStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const isOnboardingCreateMode = location.pathname === '/onboarding' && searchParams.get('mode') === 'create';
  
  const [localError, setLocalError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  
  // Control flag to ensure fetch happens only once
  const hasFetchedRef = useRef(false);

  console.log('[useRestaurantGuard] 🔄 Render with state:', {
    authLoading,
    hasUser: !!user,
    hasSession: !!session?.access_token,
    hasRestaurant: !!restaurant,
    restaurantLoading,
    restaurantError,
    localError,
    hasTimedOut,
    isReady,
    hasFetched: hasFetchedRef.current,
    timestamp: new Date().toISOString()
  });

  // Effect 1: Initialize hasFetched if restaurant already exists
  useEffect(() => {
    if (restaurant && !hasFetchedRef.current) {
      console.log('[useRestaurantGuard] ✅ INIT: Restaurant already exists, marking as fetched');
      hasFetchedRef.current = true;
    }
  }, [restaurant]);

  // Effect 2: Handle initial restaurant fetch (runs once when conditions are met)
  useEffect(() => {
    if (!authLoading && user && session?.access_token && !restaurant && !restaurantLoading && !hasFetchedRef.current) {
      console.log('[useRestaurantGuard] 🚀 FETCH: Initiating restaurant fetch (first time)');
      hasFetchedRef.current = true;
      fetchRestaurant();
    }
    // fetchRestaurant is intentionally NOT in dependencies to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, session?.access_token, restaurant, restaurantLoading]);

  // Effect 3: Handle navigation and ready state
  useEffect(() => {
    console.log('[useRestaurantGuard] 🧭 NAVIGATION: Evaluating state...');

    // Wait for auth to complete
    if (authLoading) {
      console.log('[useRestaurantGuard] ⏳ NAVIGATION: Waiting for auth...');
      return;
    }

    // No user or session - redirect to login
    if (!user || !session?.access_token) {
      console.log('[useRestaurantGuard] 🚪 NAVIGATION: No auth, redirecting to /login');
      navigate('/login', { replace: true });
      return;
    }

    // Still loading restaurant - wait
    if (restaurantLoading) {
      console.log('[useRestaurantGuard] ⏳ NAVIGATION: Loading restaurant...');
      return;
    }

    // Restaurant loaded successfully - mark as ready
    if (restaurant) {
      console.log('[useRestaurantGuard] ✅ NAVIGATION: Restaurant loaded, marking ready!', {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name
      });
      setIsReady(true);
      return;
    }

    // No restaurant after fetch - allow access to dashboard
    // User can import restaurant via Admin panel
    if (!restaurant && hasFetchedRef.current && !restaurantError) {
      console.log('[useRestaurantGuard] ✅ NAVIGATION: No restaurant, but allowing dashboard access');
      setIsReady(true);
      return;
    }

    console.log('[useRestaurantGuard] ⚙️ NAVIGATION: No action taken');
  }, [authLoading, user, session, restaurant, restaurantLoading, restaurantError, navigate, location.pathname]);

  // Effect 4: Safety timeout
  useEffect(() => {
    if (authLoading || !user) return;

    const timeoutId = setTimeout(() => {
      if (!restaurant && !hasTimedOut) {
        console.error('[useRestaurantGuard] ⏱️ TIMEOUT: Reached safety timeout');
        setHasTimedOut(true);
        setLocalError('Tempo limite excedido ao carregar dados');
      }
    }, TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [authLoading, user, restaurant, hasTimedOut]);

  // Manual retry function
  const retry = useCallback(() => {
    console.log('[useRestaurantGuard] 🔄 RETRY: Manual retry triggered');
    hasFetchedRef.current = false; // Reset fetch flag
    setLocalError(null);
    setHasTimedOut(false);
    setIsReady(false);
  }, []);

  const loading = authLoading || restaurantLoading || (!restaurant && !localError && !hasTimedOut);
  const error = localError || restaurantError;

  return {
    loading,
    error,
    ready: isReady,
    retry,
    restaurant
  };
};

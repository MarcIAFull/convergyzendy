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

const TIMEOUT_MS = 10000;

export const useRestaurantGuard = (): UseRestaurantGuardResult => {
  const { user, session, loading: authLoading } = useAuth();
  const { restaurant, loading: restaurantLoading, error: restaurantError, fetchRestaurant } = useRestaurantStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [localError, setLocalError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  
  const hasFetchedRef = useRef(false);
  const currentRestaurantIdRef = useRef<string | null>(null);

  // Track restaurant changes
  useEffect(() => {
    if (restaurant?.id && restaurant.id !== currentRestaurantIdRef.current) {
      currentRestaurantIdRef.current = restaurant.id;
      if (!isReady) setIsReady(true);
    }
    if (restaurant?.id && !isReady) setIsReady(true);
  }, [restaurant?.id, isReady]);

  // Initialize hasFetched if restaurant already exists
  useEffect(() => {
    if (restaurant && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
    }
  }, [restaurant]);

  // Handle initial restaurant fetch
  useEffect(() => {
    if (!authLoading && user && session?.access_token && !restaurant && !restaurantLoading && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchRestaurant();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, session?.access_token, restaurant, restaurantLoading]);

  // Handle navigation and ready state
  useEffect(() => {
    if (authLoading) return;

    if (!user || !session?.access_token) {
      navigate('/login', { replace: true });
      return;
    }

    if (restaurantLoading) return;

    if (restaurant) {
      setIsReady(true);
      return;
    }

    if (!restaurant && hasFetchedRef.current && !restaurantError) {
      setIsReady(true);
      return;
    }
  }, [authLoading, user, session, restaurant, restaurantLoading, restaurantError, navigate, location.pathname]);

  // Safety timeout
  useEffect(() => {
    if (authLoading || !user) return;

    const timeoutId = setTimeout(() => {
      if (!restaurant && !hasTimedOut) {
        setHasTimedOut(true);
        setLocalError('Tempo limite excedido ao carregar dados');
      }
    }, TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [authLoading, user, restaurant, hasTimedOut]);

  // Manual retry
  const retry = useCallback(() => {
    hasFetchedRef.current = false;
    currentRestaurantIdRef.current = null;
    setLocalError(null);
    setHasTimedOut(false);
    setIsReady(false);
  }, []);

  // Early exit for auth loading
  if (authLoading) {
    return { loading: true, error: null, ready: false, retry, restaurant: null };
  }

  const loading = restaurantLoading || (!restaurant && !localError && !hasTimedOut);
  const error = localError || restaurantError;

  return { loading, error, ready: isReady, retry, restaurant };
};

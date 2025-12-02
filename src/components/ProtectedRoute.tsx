import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useUserRestaurantsStore } from '@/stores/userRestaurantsStore';
import { getPendingInvitationToken } from '@/pages/AcceptInvitation';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const clearRestaurant = useRestaurantStore(state => state.clearRestaurant);
  const { restaurants, loading: restaurantsLoading, fetchUserRestaurants } = useUserRestaurantsStore();
  const [checkingRestaurants, setCheckingRestaurants] = useState(true);

  // Clear restaurant when user logs out
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('[ProtectedRoute] No user, clearing restaurant store');
      clearRestaurant();
    }
  }, [user, authLoading, clearRestaurant]);

  // Fetch user restaurants when authenticated
  useEffect(() => {
    if (!authLoading && user) {
      console.log('[ProtectedRoute] Fetching user restaurants');
      fetchUserRestaurants().finally(() => {
        setCheckingRestaurants(false);
      });
    } else if (!authLoading && !user) {
      setCheckingRestaurants(false);
    }
  }, [user, authLoading, fetchUserRestaurants]);

  // Show loading spinner while checking auth
  if (authLoading || (user && checkingRestaurants)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if there's a pending invitation - if so, redirect to accept it
  const pendingToken = getPendingInvitationToken();
  if (pendingToken) {
    return <Navigate to={`/accept-invitation/${pendingToken}`} replace />;
  }

  // If user has no restaurants, redirect to onboarding
  if (!restaurantsLoading && restaurants.length === 0) {
    // Don't redirect if already on onboarding
    if (location.pathname !== '/onboarding') {
      console.log('[ProtectedRoute] User has no restaurants, redirecting to onboarding');
      return <Navigate to="/onboarding" replace />;
    }
  }

  // User is authenticated and has restaurants (or is on onboarding), render protected content
  return <>{children}</>;
};

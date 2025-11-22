import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useEffect, useState } from 'react';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { restaurant, loading: restaurantLoading, fetchRestaurant } = useRestaurantStore();
  const location = useLocation();
  const [hasCheckedRestaurant, setHasCheckedRestaurant] = useState(false);

  useEffect(() => {
    if (user && !hasCheckedRestaurant) {
      fetchRestaurant().finally(() => setHasCheckedRestaurant(true));
    }
  }, [user, hasCheckedRestaurant, fetchRestaurant]);

  // Show loading spinner while checking auth
  if (authLoading || (user && !hasCheckedRestaurant)) {
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

  // Redirect to onboarding if authenticated but no restaurant
  if (user && hasCheckedRestaurant && !restaurant && !restaurantLoading) {
    return <Navigate to="/onboarding" replace />;
  }

  // Show loading while fetching restaurant
  if (restaurantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando restaurante...</p>
        </div>
      </div>
    );
  }

  // User is authenticated and has a restaurant
  return <>{children}</>;
};

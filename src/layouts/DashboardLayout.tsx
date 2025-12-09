import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { useRestaurantGuard } from "@/hooks/useRestaurantGuard";
import { useRestaurantStore } from "@/stores/restaurantStore";
import { ensureValidSession } from "@/integrations/supabase/client";
import {
  LogOut,
  Moon,
  Sun,
  Bell,
  BellOff,
} from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RestaurantSwitcher } from "@/components/RestaurantSwitcher";
import { useUserRestaurantsStore } from "@/stores/userRestaurantsStore";
import { useRestaurantSwitch } from "@/hooks/useRestaurantSwitch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Restaurant } from "@/types/database";

const STORAGE_KEY = 'zendy_active_restaurant';

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const { loading, error, ready, retry } = useRestaurantGuard();
  const { soundEnabled, toggleSound } = useNotifications();
  const { restaurants, fetchUserRestaurants } = useUserRestaurantsStore();
  const { restaurant: currentRestaurant } = useRestaurantStore();
  const { switchRestaurant } = useRestaurantSwitch();

  // Fetch user restaurants on mount
  useEffect(() => {
    fetchUserRestaurants();
  }, [fetchUserRestaurants]);

  // Inicializar restaurante ativo APENAS quando necessário
  // Não re-inicializar se já temos um restaurante válido
  useEffect(() => {
    // Skip if we already have a current restaurant
    if (currentRestaurant?.id) {
      console.log('[DashboardLayout] Already have restaurant, skipping initialization:', currentRestaurant.name);
      return;
    }
    
    if (restaurants.length > 0) {
      const savedId = localStorage.getItem(STORAGE_KEY);
      const savedRestaurant = savedId ? restaurants.find(r => r.id === savedId) : null;
      
      if (savedRestaurant) {
        console.log('[DashboardLayout] Restoring saved restaurant:', savedRestaurant.name);
        switchRestaurant(savedRestaurant as unknown as Restaurant);
      } else {
        console.log('[DashboardLayout] No valid saved restaurant, selecting first available');
        switchRestaurant(restaurants[0] as unknown as Restaurant);
      }
    }
  }, [restaurants, currentRestaurant?.id, switchRestaurant]);

  // Periodic session check to prevent expiration
  useEffect(() => {
    const checkSession = async () => {
      try {
        await ensureValidSession();
      } catch (error) {
        console.error('[DashboardLayout] Session check failed:', error);
      }
    };

    // Check session on mount
    checkSession();

    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados do restaurante...</p>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4 text-destructive">
            <svg
              className="h-16 w-16 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-foreground">Erro ao carregar dados</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="space-y-3">
            <Button onClick={retry} className="w-full">
              Tentar novamente
            </Button>
            <Button onClick={signOut} variant="outline" className="w-full">
              Fazer logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not ready - show loading instead of blank page
  // This prevents blank screen during restaurant switching or brief state changes
  if (!ready && !currentRestaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Preparando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-4">
              <RestaurantSwitcher />
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSound}
                  title={soundEnabled ? 'Desativar som' : 'Ativar som'}
                >
                  {soundEnabled ? (
                    <Bell className="h-5 w-5" />
                  ) : (
                    <BellOff className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={signOut}
                  title="Sair"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1">
            {!currentRestaurant && restaurants.length === 0 && (
              <Alert className="m-4 border-warning bg-warning/10">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Nenhum restaurante encontrado. Importe os dados da Pizzaria A Família no painel Admin.</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/admin')}
                    className="ml-4"
                  >
                    Ir para Admin
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {/* Key forces full re-render when restaurant changes */}
            <Outlet key={currentRestaurant?.id || 'no-restaurant'} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;

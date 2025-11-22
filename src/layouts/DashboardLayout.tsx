import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { useRestaurantStore } from "@/stores/restaurantStore";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  LogOut,
  Moon,
  Sun,
  MessageSquare,
  TestTube,
  Smartphone,
  Brain,
} from "lucide-react";

const DashboardLayout = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { restaurant, loading, fetchRestaurant } = useRestaurantStore();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load restaurant once on mount
  useEffect(() => {
    if (!hasInitialized) {
      console.log('[DashboardLayout] Initializing - fetching restaurant...');
      fetchRestaurant().finally(() => {
        setHasInitialized(true);
      });
    }
  }, [hasInitialized, fetchRestaurant]);

  // Redirect to onboarding if no restaurant after initialization
  useEffect(() => {
    if (hasInitialized && !loading && restaurant === null) {
      console.log('[DashboardLayout] No restaurant found, redirecting to onboarding');
      navigate('/onboarding', { replace: true });
    }
  }, [hasInitialized, loading, restaurant, navigate]);

  // Show loading state while initializing
  if (!hasInitialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando restaurante...</p>
        </div>
      </div>
    );
  }

  // Don't render if no restaurant (will redirect)
  if (!restaurant) {
    return null;
  }

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Menu", href: "/menu", icon: Package },
    { name: "Orders", href: "/orders", icon: Menu },
    { name: "Messages", href: "/messages", icon: MessageSquare },
    { name: "AI Configuration", href: "/ai-configuration", icon: Brain },
    { name: "Test WhatsApp", href: "/test-whatsapp", icon: TestTube },
    { name: "WhatsApp Connection", href: "/whatsapp-connection", icon: Smartphone },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-xl font-bold">Z</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Zendy</h1>
              <p className="text-xs text-muted-foreground">Delivery AI</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r bg-muted/30 min-h-[calc(100vh-4rem)]">
          <nav className="flex flex-col gap-1 p-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      isActive && "bg-secondary"
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

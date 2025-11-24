import { Outlet, Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { useRestaurantGuard } from "@/hooks/useRestaurantGuard";
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
  BarChart3,
  Users as UsersIcon,
} from "lucide-react";

const DashboardLayout = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const { loading, error, ready, retry } = useRestaurantGuard();

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

  // Not ready (will redirect automatically)
  if (!ready) {
    return null;
  }

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Menu", href: "/menu", icon: Package },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Customers", href: "/customers", icon: UsersIcon },
    { name: "Messages", href: "/messages", icon: MessageSquare },
    { name: "AI Configuration", href: "/ai-configuration", icon: Brain },
    { name: "Restaurant AI Settings", href: "/restaurant-ai-settings", icon: Brain },
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

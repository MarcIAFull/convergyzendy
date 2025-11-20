import { Outlet, Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { useRestaurantStore } from "@/stores/restaurantStore";
import { useEffect } from "react";
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
} from "lucide-react";

const DashboardLayout = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { fetchRestaurant } = useRestaurantStore();

  // Load restaurant on mount
  useEffect(() => {
    console.log('[DashboardLayout] Initializing - fetching restaurant');
    fetchRestaurant();
  }, [fetchRestaurant]);

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Menu", href: "/menu", icon: Package },
    { name: "Orders", href: "/orders", icon: Menu },
    { name: "Messages", href: "/messages", icon: MessageSquare },
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
            <Button variant="ghost" size="icon">
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

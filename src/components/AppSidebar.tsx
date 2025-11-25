import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Package,
  MapPin,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  Shield,
  UserPlus,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const { user } = useAuth();
  const { unreadOrders, unreadMessages } = useNotifications();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminRole();
  }, [user]);

  const checkAdminRole = async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const operationsRoutes = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, badge: unreadOrders },
    { title: "Menu", url: "/menu", icon: Package },
    { title: "Zonas de Entrega", url: "/delivery-zones", icon: MapPin },
    { title: "Clientes", url: "/customers", icon: Users },
  ];

  const communicationRoutes = [
    { title: "Mensagens", url: "/messages", icon: MessageSquare, badge: unreadMessages },
  ];

  const insightsRoutes = [
    { title: "Analytics", url: "/analytics", icon: BarChart3 },
  ];

  const adminRoutes = [
    { title: "Painel Admin", url: "/admin", icon: Shield },
    { title: "Gestão de Equipe", url: "/admin/team", icon: UserPlus },
    { title: "Configuração Global de IA", url: "/admin/ai-configuration", icon: Settings },
    { title: "AI Interaction Logs", url: "/admin/ai-logs", icon: FileText },
    { title: "System Check", url: "/admin/system-check", icon: Shield },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex flex-col items-center gap-2 p-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-lg font-bold">Z</span>
              </div>
              {open && (
                <div>
                  <h1 className="text-sm font-bold text-foreground">Zendy</h1>
                  <p className="text-xs text-muted-foreground">Delivery AI</p>
                </div>
              )}
            </div>
            {open && <SidebarTrigger />}
          </div>
          {!open && (
            <SidebarTrigger className="w-8 h-8" />
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Operations */}
        <SidebarGroup>
          <SidebarGroupLabel>Operações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsRoutes.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                      {open && item.badge && item.badge > 0 && (
                        <Badge variant="destructive" className="ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Communication */}
        <SidebarGroup>
          <SidebarGroupLabel>Comunicação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {communicationRoutes.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                      {open && item.badge && item.badge > 0 && (
                        <Badge variant="destructive" className="ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Insights */}
        <SidebarGroup>
          <SidebarGroupLabel>Insights</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {insightsRoutes.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/settings")}>
                  <NavLink to="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    {open && <span>Configurações</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin (only for admins) */}
        {isAdmin && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminRoutes.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {open && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

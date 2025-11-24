import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/layouts/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import MenuManagement from "@/pages/MenuManagement";
import OrderDetail from "@/pages/OrderDetail";
import Analytics from "@/pages/Analytics";
import Customers from "@/pages/Customers";
import SettingsUnified from "@/pages/SettingsUnified";
import Messages from "@/pages/Messages";
import AIConfiguration from "@/pages/AIConfiguration";
import Admin from "@/pages/Admin";
import SystemCheck from "@/pages/SystemCheck";
import DeliveryZones from "@/pages/DeliveryZones";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";
import PublicMenu from "@/pages/public/PublicMenu";
import PublicCart from "@/pages/public/PublicCart";
import PublicCheckout from "@/pages/public/PublicCheckout";
import PublicOrderConfirmed from "@/pages/public/PublicOrderConfirmed";
import TeamManagement from "@/pages/TeamManagement";
import AcceptInvitation from "@/pages/AcceptInvitation";
import { AdminRoute } from "@/components/AdminRoute";
import { HelmetProvider } from 'react-helmet-async';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="zendy-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HelmetProvider>
          <BrowserRouter>
            <AuthProvider>
              <NotificationProvider>
                <Routes>
                {/* Public Routes */}
                <Route path="/menu/:slug" element={<PublicMenu />} />
                <Route path="/menu/:slug/cart" element={<PublicCart />} />
                <Route path="/menu/:slug/checkout" element={<PublicCheckout />} />
                <Route path="/menu/:slug/order-confirmed/:orderId" element={<PublicOrderConfirmed />} />
                <Route path="/accept-invitation/:token" element={<AcceptInvitation />} />
                
                {/* Auth Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/onboarding" element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                } />
                
                {/* Protected Dashboard Routes */}
                <Route
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Operations */}
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/menu" element={<MenuManagement />} />
                  <Route path="/delivery-zones" element={<DeliveryZones />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/team" element={<TeamManagement />} />
                  <Route path="/orders/:id" element={<OrderDetail />} />
                  
                  {/* Communication */}
                  <Route path="/messages" element={<Messages />} />
                  
                  {/* Insights */}
                  <Route path="/analytics" element={<Analytics />} />
                  
                  {/* Settings (UNIFIED) */}
                  <Route path="/settings" element={<SettingsUnified />} />
                  
                  {/* Admin Routes (Protected by AdminRoute) */}
                  <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                  <Route path="/admin/ai-configuration" element={<AdminRoute><AIConfiguration /></AdminRoute>} />
                  <Route path="/admin/system-check" element={<AdminRoute><SystemCheck /></AdminRoute>} />
                </Route>
                
                {/* 404 Catch-All */}
                <Route path="*" element={<NotFound />} />
                </Routes>
              </NotificationProvider>
            </AuthProvider>
          </BrowserRouter>
        </HelmetProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

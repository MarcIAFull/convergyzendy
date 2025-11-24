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
import Settings from "@/pages/Settings";
import Messages from "@/pages/Messages";
import TestWhatsApp from "@/pages/TestWhatsApp";
import WhatsAppConnection from "@/pages/WhatsAppConnection";
import AIConfiguration from "@/pages/AIConfiguration";
import RestaurantAISettings from "@/pages/RestaurantAISettings";
import Admin from "@/pages/Admin";
import Subscription from "@/pages/Subscription";
import SystemCheck from "@/pages/SystemCheck";
import DeliveryZones from "@/pages/DeliveryZones";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";
import PublicMenu from "@/pages/public/PublicMenu";
import PublicCart from "@/pages/public/PublicCart";
import PublicCheckout from "@/pages/public/PublicCheckout";
import PublicOrderConfirmed from "@/pages/public/PublicOrderConfirmed";
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
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/menu" element={<MenuManagement />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/orders/:id" element={<OrderDetail />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/test-whatsapp" element={<TestWhatsApp />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/whatsapp-connection" element={<WhatsAppConnection />} />
                  <Route path="/ai-configuration" element={<AIConfiguration />} />
                  <Route path="/restaurant-ai-settings" element={<RestaurantAISettings />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/subscription" element={<Subscription />} />
                  <Route path="/system-check" element={<SystemCheck />} />
                  <Route path="/delivery-zones" element={<DeliveryZones />} />
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

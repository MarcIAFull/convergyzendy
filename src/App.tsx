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
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="zendy-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } />
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
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

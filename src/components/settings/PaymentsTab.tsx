import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  RefreshCw 
} from 'lucide-react';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StripeStatus {
  connected: boolean;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_complete: boolean;
  online_payments_enabled: boolean;
  connected_at: string | null;
  business_name?: string;
  error?: string;
}

export function PaymentsTab() {
  const { restaurant } = useRestaurantStore();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [togglingPayments, setTogglingPayments] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!restaurant?.id) return;
    
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/stripe-connect-status?restaurant_id=${restaurant.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.session?.access_token}`,
          },
        }
      );
      
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('[PaymentsTab] Error fetching status:', error);
      toast.error('Erro ao carregar status do Stripe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [restaurant?.id]);

  const parseStripeError = (errorMessage: string): string => {
    // Common Stripe Connect regional restrictions
    if (errorMessage.includes('cannot be created by platforms')) {
      const match = errorMessage.match(/accounts in (\w+) cannot be created by platforms in (\w+)/i);
      if (match) {
        const [, accountCountry, platformCountry] = match;
        return `Restrição regional do Stripe: Contas em ${accountCountry} não podem ser criadas por plataformas em ${platformCountry}. Entre em contato com o suporte Stripe para solicitar permissão.`;
      }
      return 'Restrição regional do Stripe Connect. Entre em contato com o suporte Stripe.';
    }
    if (errorMessage.includes('country')) {
      return 'Erro de país: O Stripe Connect tem restrições regionais. Verifique se seu país é suportado.';
    }
    return errorMessage;
  };

  const handleConnectStripe = async () => {
    if (!restaurant?.id) return;
    
    setConnecting(true);
    setConnectionError(null);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(
        'https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/stripe-connect-onboard',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            restaurant_id: restaurant.id,
            return_url: `${window.location.origin}/settings?tab=payments&connected=true`,
            refresh_url: `${window.location.origin}/settings?tab=payments&refresh=true`,
          }),
        }
      );
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        const errorMsg = data.error || 'Erro ao iniciar conexão';
        console.error('[PaymentsTab] Error connecting:', errorMsg);
        setConnectionError(parseStripeError(errorMsg));
        toast.error('Erro ao conectar com Stripe');
        return;
      }
      
      if (data.onboarding_url) {
        window.location.href = data.onboarding_url;
      } else {
        throw new Error('URL de onboarding não retornada');
      }
    } catch (error) {
      console.error('[PaymentsTab] Error connecting:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro ao conectar com Stripe';
      setConnectionError(parseStripeError(errorMsg));
      toast.error('Erro ao conectar com Stripe');
    } finally {
      setConnecting(false);
    }
  };

  const handleOpenDashboard = async () => {
    if (!restaurant?.id) return;
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(
        'https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/stripe-connect-dashboard',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({ restaurant_id: restaurant.id }),
        }
      );
      
      const data = await response.json();
      
      if (data.dashboard_url) {
        window.open(data.dashboard_url, '_blank');
      } else {
        throw new Error(data.error || 'Erro ao abrir dashboard');
      }
    } catch (error) {
      console.error('[PaymentsTab] Error opening dashboard:', error);
      toast.error('Erro ao abrir dashboard do Stripe');
    }
  };

  const handleToggleOnlinePayments = async (enabled: boolean) => {
    if (!restaurant?.id) return;
    
    setTogglingPayments(true);
    try {
      const { error } = await supabase
        .from('restaurant_settings')
        .update({ online_payments_enabled: enabled })
        .eq('restaurant_id', restaurant.id);

      if (error) throw error;

      setStatus((prev) => prev ? { ...prev, online_payments_enabled: enabled } : null);
      toast.success(enabled ? 'Pagamentos online ativados' : 'Pagamentos online desativados');
    } catch (error) {
      console.error('[PaymentsTab] Error toggling payments:', error);
      toast.error('Erro ao atualizar configuração');
    } finally {
      setTogglingPayments(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Stripe Connect
              </CardTitle>
              <CardDescription>
                Conecte sua conta Stripe para receber pagamentos online
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStatus}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          {!status?.connected ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Você ainda não conectou uma conta Stripe. Conecte para aceitar pagamentos online.
                </AlertDescription>
              </Alert>
              
              {connectionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p>{connectionError}</p>
                    <a 
                      href="https://support.stripe.com/contact" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline hover:no-underline"
                    >
                      Contatar Suporte Stripe
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </AlertDescription>
                </Alert>
              )}
              
              <Button onClick={handleConnectStripe} disabled={connecting}>
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Conectar Stripe
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Connected Status */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Conta Conectada</span>
                    {status.onboarding_complete && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Ativa
                      </Badge>
                    )}
                  </div>
                  {status.business_name && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {status.business_name}
                    </p>
                  )}
                  {status.stripe_account_id && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {status.stripe_account_id}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenDashboard}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </div>

              {/* Account Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {status.charges_enabled ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-sm font-medium">Receber Pagamentos</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {status.charges_enabled ? 'Habilitado' : 'Complete o onboarding'}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {status.payouts_enabled ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-sm font-medium">Transferências</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {status.payouts_enabled ? 'Habilitado' : 'Verifique dados bancários'}
                  </p>
                </div>
              </div>

              {/* Onboarding incomplete warning */}
              {!status.onboarding_complete && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Complete o processo de verificação do Stripe para começar a receber pagamentos.
                    <Button 
                      variant="link" 
                      className="p-0 h-auto ml-2" 
                      onClick={handleConnectStripe}
                    >
                      Completar verificação
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Online Payments Toggle */}
              {status.charges_enabled && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="online-payments" className="text-base font-medium">
                      Aceitar Pagamentos Online
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Clientes podem pagar online no checkout do menu
                    </p>
                  </div>
                  <Switch
                    id="online-payments"
                    checked={status.online_payments_enabled}
                    onCheckedChange={handleToggleOnlinePayments}
                    disabled={togglingPayments}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            1. <strong>Conecte sua conta Stripe</strong> - Você será redirecionado para criar ou conectar uma conta
          </p>
          <p>
            2. <strong>Complete a verificação</strong> - O Stripe precisa verificar seus dados para pagamentos
          </p>
          <p>
            3. <strong>Ative pagamentos online</strong> - Clientes verão a opção "Pagar Online" no checkout
          </p>
          <p>
            4. <strong>Receba diretamente</strong> - Os pagamentos vão direto para sua conta Stripe
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

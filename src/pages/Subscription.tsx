import { useEffect, useState } from 'react';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useTenantStore } from '@/stores/tenantStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Settings2, BarChart3, AlertCircle } from 'lucide-react';
import TenantSettingsForm from '@/components/admin/TenantSettingsForm';
import UsageStats from '@/components/admin/UsageStats';

const Subscription = () => {
  const { restaurant } = useRestaurantStore();
  const { subscription, loading: subLoading, fetchSubscription } = useSubscriptionStore();
  const { settings, loading: tenantLoading, fetchSettings } = useTenantStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (restaurant?.id) {
      fetchSubscription(restaurant.id);
      fetchSettings(restaurant.id);
    }
  }, [restaurant?.id, fetchSubscription, fetchSettings]);

  const loading = subLoading || tenantLoading;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'trialing': return 'bg-blue-500';
      case 'past_due': return 'bg-yellow-500';
      case 'canceled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Subscrição e Configurações</h1>
          <p className="text-muted-foreground">Gerir plano e configurações do restaurante</p>
        </div>
        {subscription && (
          <Badge className={getStatusColor(subscription.status)}>
            {subscription.status.toUpperCase()}
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <Building2 className="w-4 h-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 className="w-4 h-4 mr-2" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="usage">
            <BarChart3 className="w-4 h-4 mr-2" />
            Utilização
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Plano Atual</CardTitle>
                <CardDescription>Subscrição ativa</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subscription?.plan_name || 'Nenhum'}</div>
                {subscription && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Renovação: {new Date(subscription.current_period_end).toLocaleDateString('pt-PT')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pedidos</CardTitle>
                <CardDescription>Utilização mensal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {subscription?.orders_used || 0} / {subscription?.orders_limit || '∞'}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {subscription?.orders_limit 
                    ? `${Math.round(((subscription.orders_used || 0) / subscription.orders_limit) * 100)}% usado`
                    : 'Ilimitado'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Utilizadores</CardTitle>
                <CardDescription>Limite de contas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  1 / {subscription?.users_limit || 1}
                </div>
                <p className="text-sm text-muted-foreground mt-2">Contas ativas</p>
              </CardContent>
            </Card>
          </div>

          {subscription?.status === 'trialing' && subscription.trial_end && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Período de teste termina em {new Date(subscription.trial_end).toLocaleDateString('pt-PT')}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <TenantSettingsForm 
            settings={settings} 
            restaurantId={restaurant?.id || ''} 
          />
        </TabsContent>

        <TabsContent value="usage">
          <UsageStats restaurantId={restaurant?.id || ''} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Subscription;

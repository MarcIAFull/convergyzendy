import { useEffect } from 'react';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useTokenUsageStore } from '@/stores/tokenUsageStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CreditCard, 
  Coins, 
  Users, 
  Calendar, 
  AlertTriangle, 
  TrendingUp,
  Zap,
  HelpCircle,
  ArrowUpRight,
  DollarSign
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export function SubscriptionTab() {
  const { restaurant } = useRestaurantStore();
  const { subscription, loading: subLoading, fetchSubscription } = useSubscriptionStore();
  const { 
    dailyUsage, 
    currentPeriod, 
    todayUsage, 
    loading: tokenLoading, 
    fetchDailyUsage, 
    fetchCurrentPeriod,
    fetchTodayUsage 
  } = useTokenUsageStore();

  useEffect(() => {
    if (restaurant?.id) {
      fetchSubscription(restaurant.id);
      fetchCurrentPeriod(restaurant.id);
      fetchDailyUsage(restaurant.id, 30);
      fetchTodayUsage(restaurant.id);
    }
  }, [restaurant?.id, fetchSubscription, fetchCurrentPeriod, fetchDailyUsage, fetchTodayUsage]);

  const loading = subLoading || tokenLoading;

  // Status colors
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'trialing': return 'secondary';
      case 'past_due': return 'destructive';
      case 'canceled': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'trialing': return 'Período de Teste';
      case 'past_due': return 'Pagamento Pendente';
      case 'canceled': return 'Cancelado';
      default: return status;
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-destructive';
    if (percent >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressTextColor = (percent: number) => {
    if (percent >= 90) return 'text-destructive';
    if (percent >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const chartData = dailyUsage.map(d => ({
    date: format(new Date(d.date), 'dd/MM', { locale: pt }),
    tokens: d.total_tokens,
    interactions: d.total_interactions,
    cost: d.estimated_cost_usd,
  }));

  if (loading && !subscription && !currentPeriod) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const tokenPercent = currentPeriod?.percentUsed || 0;
  const ordersPercent = subscription ? Math.round(((subscription.orders_used || 0) / (subscription.orders_limit || 100)) * 100) : 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* === SECÇÃO 1: RESUMO DO PLANO === */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">
                    Plano {subscription?.plan_name || 'Starter'}
                  </CardTitle>
                  <CardDescription>
                    {subscription?.current_period_end 
                      ? `Renova em ${format(new Date(subscription.current_period_end), "d 'de' MMMM", { locale: pt })}`
                      : 'Sem subscrição ativa'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {subscription && (
                  <Badge variant={getStatusBadgeVariant(subscription.status)}>
                    {getStatusLabel(subscription.status)}
                  </Badge>
                )}
                {subscription?.status === 'trialing' && (
                  <Button size="sm" className="gap-1">
                    Ativar Plano Pago
                    <ArrowUpRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Alerta de trial */}
        {subscription?.status === 'trialing' && subscription.trial_end && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              O período de teste termina em{' '}
              <strong>{format(new Date(subscription.trial_end), "d 'de' MMMM 'de' yyyy", { locale: pt })}</strong>.
              Active um plano pago para continuar a usar todas as funcionalidades.
            </AlertDescription>
          </Alert>
        )}

        {/* === SECÇÃO 2: CARTÕES DE UTILIZAÇÃO === */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Tokens */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Tokens de IA</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Tokens são unidades de processamento da IA. Cada mensagem do WhatsApp consome tokens para gerar respostas inteligentes.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(currentPeriod?.tokensUsed || 0)}
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}/ {formatNumber(currentPeriod?.tokensLimit || 500000)}
                </span>
              </div>
              <Progress 
                value={tokenPercent} 
                className={`mt-3 h-2`}
              />
              <div className={`text-xs mt-2 font-medium ${getProgressTextColor(tokenPercent)}`}>
                {tokenPercent}% utilizado
                {tokenPercent >= 80 && (
                  <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-xs">
                    Aumentar limite
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pedidos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {subscription?.orders_used || 0}
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}/ {subscription?.orders_limit || '∞'}
                </span>
              </div>
              <Progress 
                value={ordersPercent} 
                className="mt-3 h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {subscription?.orders_limit 
                  ? `${ordersPercent}% do limite mensal`
                  : 'Pedidos ilimitados'}
              </p>
            </CardContent>
          </Card>

          {/* Equipa */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equipa</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                1
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}/ {subscription?.users_limit || 3}
                </span>
              </div>
              <Progress 
                value={Math.round((1 / (subscription?.users_limit || 3)) * 100)} 
                className="mt-3 h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Contas de utilizador ativas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* === SECÇÃO 3: CONSUMO DE HOJE === */}
        {todayUsage && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Consumo Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <div className="text-2xl font-bold">{formatNumber(todayUsage.tokens)}</div>
                  <p className="text-sm text-muted-foreground">tokens</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{todayUsage.interactions}</div>
                  <p className="text-sm text-muted-foreground">interações</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">${todayUsage.cost.toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">custo estimado</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{currentPeriod?.daysRemaining || 0}</div>
                  <p className="text-sm text-muted-foreground">dias restantes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === SECÇÃO 4: PROJEÇÃO E CUSTO === */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projeção Mensal</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(currentPeriod?.projectedMonthlyTokens || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                tokens estimados até ao fim do período
              </p>
              {currentPeriod && currentPeriod.projectedMonthlyTokens > currentPeriod.tokensLimit && (
                <Badge variant="destructive" className="mt-2 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Pode exceder limite
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Custo Estimado</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Valor de referência baseado nos preços do GPT-4o mini. Este custo está incluído no seu plano.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${currentPeriod?.estimatedCostUsd.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                este período (incluído no plano)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* === SECÇÃO 5: GRÁFICO DE CONSUMO === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumo Diário</CardTitle>
            <CardDescription>Tokens utilizados nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'tokens' ? formatNumber(value) : 
                      name === 'cost' ? `$${value.toFixed(2)}` : value,
                      name === 'tokens' ? 'Tokens' : 
                      name === 'cost' ? 'Custo' : 'Interações'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="tokens" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                <div className="text-center">
                  <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Sem dados de consumo ainda</p>
                  <p className="text-xs mt-1">Os dados aparecem após as primeiras interações com a IA</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* === SECÇÃO 6: HISTÓRICO DETALHADO === */}
        {dailyUsage.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico Detalhado</CardTitle>
              <CardDescription>Consumo por dia nos últimos 14 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Data</th>
                      <th className="text-right py-2 font-medium">Tokens</th>
                      <th className="text-right py-2 font-medium">Interações</th>
                      <th className="text-right py-2 font-medium">Média/Int</th>
                      <th className="text-right py-2 font-medium">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dailyUsage].reverse().slice(0, 14).map((day) => (
                      <tr key={day.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2">
                          {format(new Date(day.date), "dd 'de' MMM", { locale: pt })}
                        </td>
                        <td className="text-right py-2 font-medium">{formatNumber(day.total_tokens)}</td>
                        <td className="text-right py-2">{day.total_interactions}</td>
                        <td className="text-right py-2 text-muted-foreground">
                          {formatNumber(Math.round(day.avg_tokens_per_interaction || 0))}
                        </td>
                        <td className="text-right py-2">${day.estimated_cost_usd.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}

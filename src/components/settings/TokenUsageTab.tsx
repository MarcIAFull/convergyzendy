import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useTokenUsageStore } from '@/stores/tokenUsageStore';
import { Coins, TrendingUp, Calendar, DollarSign, Zap, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TokenUsageTab() {
  const { restaurant } = useRestaurantStore();
  const { 
    dailyUsage, 
    currentPeriod, 
    todayUsage, 
    loading, 
    fetchDailyUsage, 
    fetchCurrentPeriod,
    fetchTodayUsage 
  } = useTokenUsageStore();

  useEffect(() => {
    if (restaurant?.id) {
      fetchCurrentPeriod(restaurant.id);
      fetchDailyUsage(restaurant.id, 30);
      fetchTodayUsage(restaurant.id);
    }
  }, [restaurant?.id]);

  if (loading && !currentPeriod) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const getStatusColor = (percent: number) => {
    if (percent >= 90) return 'text-destructive';
    if (percent >= 75) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-destructive';
    if (percent >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const chartData = dailyUsage.map(d => ({
    date: format(new Date(d.date), 'dd/MM', { locale: ptBR }),
    tokens: d.total_tokens,
    interactions: d.total_interactions,
    cost: d.estimated_cost_usd,
  }));

  return (
    <div className="space-y-6">
      {/* Header com status atual */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Uso do período */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens do Período</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {currentPeriod ? (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(currentPeriod.tokensUsed)}
                </div>
                <p className="text-xs text-muted-foreground">
                  de {formatNumber(currentPeriod.tokensLimit)} limite
                </p>
                <Progress 
                  value={currentPeriod.percentUsed} 
                  className={`mt-2 h-2 ${getProgressColor(currentPeriod.percentUsed)}`}
                />
                <div className={`text-xs mt-1 font-medium ${getStatusColor(currentPeriod.percentUsed)}`}>
                  {currentPeriod.percentUsed}% utilizado
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Sem assinatura ativa</div>
            )}
          </CardContent>
        </Card>

        {/* Custo estimado */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Estimado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${currentPeriod?.estimatedCostUsd.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              este período
            </p>
          </CardContent>
        </Card>

        {/* Projeção mensal */}
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
              tokens estimados
            </p>
            {currentPeriod && currentPeriod.projectedMonthlyTokens > currentPeriod.tokensLimit && (
              <Badge variant="destructive" className="mt-2 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Pode exceder limite
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Dias restantes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dias Restantes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentPeriod?.daysRemaining || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              até renovação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Uso de hoje */}
      {todayUsage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de consumo diário */}
      <Card>
        <CardHeader>
          <CardTitle>Consumo Diário</CardTitle>
          <CardDescription>Tokens utilizados nos últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
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
                <Tooltip 
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
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Sem dados de consumo ainda
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de consumo detalhado */}
      {dailyUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico Detalhado</CardTitle>
            <CardDescription>Consumo por dia</CardDescription>
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
                    <tr key={day.id} className="border-b border-border/50">
                      <td className="py-2">
                        {format(new Date(day.date), "dd 'de' MMM", { locale: ptBR })}
                      </td>
                      <td className="text-right py-2">{formatNumber(day.total_tokens)}</td>
                      <td className="text-right py-2">{day.total_interactions}</td>
                      <td className="text-right py-2">
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
  );
}

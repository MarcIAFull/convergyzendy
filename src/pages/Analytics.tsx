import { useEffect } from 'react';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  ShoppingCart, 
  DollarSign, 
  Users, 
  Target,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight,
  Package
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

const Analytics = () => {
  const { restaurant } = useRestaurantGuard();
  const { data, loading, dateRange, fetchAnalytics, setDateRange } = useAnalyticsStore();

  useEffect(() => {
    if (restaurant?.id) {
      fetchAnalytics(restaurant.id, dateRange);
    }
  }, [restaurant?.id, dateRange, fetchAnalytics]);

  const handleRangeChange = (range: 'week' | 'month' | 'all') => {
    setDateRange(range);
    if (restaurant?.id) {
      fetchAnalytics(restaurant.id, range);
    }
  };

  if (loading || !data) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    trendValue 
  }: { 
    title: string; 
    value: string; 
    icon: any; 
    trend?: 'up' | 'down'; 
    trendValue?: string;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardDescription className="text-sm font-medium">{title}</CardDescription>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 mt-2 text-sm ${trend === 'up' ? 'text-success' : 'text-destructive'}`}>
            {trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            <span>{trendValue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Performance insights and business metrics
          </p>
        </div>
        <Tabs value={dateRange} onValueChange={(v) => handleRangeChange(v as any)}>
          <TabsList>
            <TabsTrigger value="week">7 Days</TabsTrigger>
            <TabsTrigger value="month">30 Days</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={`€${data.totalRevenue.toFixed(2)}`}
          icon={DollarSign}
        />
        <MetricCard
          title="Total Orders"
          value={data.totalOrders.toString()}
          icon={ShoppingCart}
        />
        <MetricCard
          title="Average Ticket"
          value={`€${data.averageTicket.toFixed(2)}`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Total Customers"
          value={data.totalCustomers.toString()}
          icon={Users}
        />
      </div>

      {/* Revenue Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
          <CardDescription>Daily revenue and order volume</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data.dailyRevenue}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-muted-foreground"
                tickFormatter={(value) => new Date(value).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
              />
              <YAxis yAxisId="left" className="text-muted-foreground" />
              <YAxis yAxisId="right" orientation="right" className="text-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString('pt-PT')}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="revenue" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Revenue (€)"
                dot={{ fill: 'hsl(var(--primary))' }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="orders" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                name="Orders"
                dot={{ fill: 'hsl(var(--secondary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Top Selling Products
            </CardTitle>
            <CardDescription>Best performers by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.topProducts.slice(0, 5).map((product, index) => (
                <div key={product.product_id} className="flex items-center gap-4">
                  <Badge variant="secondary" className="w-8 h-8 flex items-center justify-center rounded-full">
                    {index + 1}
                  </Badge>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{product.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.total_quantity} units sold
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">€{product.total_revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {data.topProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No products data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Conversion & Recovery Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
            <CardDescription>Conversion and recovery statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Conversion Rate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Cart → Order Conversion</span>
                <span className="text-2xl font-bold text-primary">{data.conversionRate.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary" 
                  style={{ width: `${Math.min(data.conversionRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Recovery Stats */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCcw className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Recovery Attempts</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Attempts</p>
                  <p className="text-2xl font-bold text-foreground">{data.recoveryStats.total_attempts}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Successful</p>
                  <p className="text-2xl font-bold text-success">{data.recoveryStats.successful_recoveries}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recovery Rate</p>
                  <p className="text-2xl font-bold text-primary">{data.recoveryStats.recovery_rate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recovered Revenue</p>
                  <p className="text-2xl font-bold text-success">€{data.recoveryStats.total_recovered_revenue.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;

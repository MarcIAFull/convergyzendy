import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOrderStore } from '@/stores/orderStore';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { OrderDetailsPanel } from '@/components/OrderDetailsPanel';
import { useTimeAgo, isOrderUrgent } from '@/hooks/useTimeAgo';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import type { OrderWithDetails } from '@/types/database';
import { Search, Filter, Clock, Euro, Package, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { restaurant } = useRestaurantGuard();
  const { orders, loading, fetchOrders, updateOrderStatus, subscribeToOrders } = useOrderStore();
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (restaurant?.id) {
      fetchOrders(restaurant.id);
      const unsubscribe = subscribeToOrders(restaurant.id);
      return () => unsubscribe();
    }
  }, [restaurant?.id, fetchOrders, subscribeToOrders]);

  // Auto-select first order when orders load
  useEffect(() => {
    if (orders.length > 0 && !selectedOrder) {
      setSelectedOrder(orders[0]);
    }
  }, [orders, selectedOrder]);

  const activeOrders = orders.filter(
    order => ['new', 'preparing', 'out_for_delivery'].includes(order.status)
  );

  const historicalOrders = orders.filter(
    order => ['completed', 'cancelled'].includes(order.status)
  );

  const filterOrders = (ordersList: OrderWithDetails[]) => {
    if (!searchQuery) return ordersList;
    
    const query = searchQuery.toLowerCase();
    return ordersList.filter(order => 
      order.id.toLowerCase().includes(query) ||
      order.user_phone.includes(query) ||
      order.delivery_address.toLowerCase().includes(query) ||
      order.customer?.name?.toLowerCase().includes(query)
    );
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'Novo',
      preparing: 'Preparando',
      out_for_delivery: 'Em Entrega',
      completed: 'Concluído',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      preparing: 'bg-warning/10 text-warning',
      out_for_delivery: 'bg-info/10 text-info',
      completed: 'bg-success/10 text-success',
      cancelled: 'bg-destructive/10 text-destructive',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getStatusBorderColor = (status: string) => {
    const borderColors: Record<string, string> = {
      new: 'border-blue-500',
      preparing: 'border-warning',
      out_for_delivery: 'border-info',
      completed: 'border-success',
      cancelled: 'border-destructive',
    };
    return borderColors[status] || 'border-border';
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderWithDetails['status']) => {
    await updateOrderStatus(orderId, newStatus);
  };

  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  // OrderCard Component
  const OrderCard = ({ order, isSelected }: { order: OrderWithDetails; isSelected: boolean }) => {
    const timeAgo = useTimeAgo(order.created_at);
    const isUrgent = isOrderUrgent(order);
    const customerName = order.customer?.name || order.user_phone.split(' ')[0] || 'Cliente';

    return (
      <Card 
        className={cn(
          "mb-3 cursor-pointer transition-all duration-300 hover:shadow-md",
          isSelected && `border-l-4 ${getStatusBorderColor(order.status)} bg-accent/50 scale-[1.01]`,
          isUrgent && "ring-2 ring-destructive"
        )}
        onClick={() => setSelectedOrder(order)}
      >
        <CardContent className="p-4">
          {/* Badges superiores */}
          <div className="flex items-center gap-2 mb-3">
            {isUrgent && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Urgente
              </Badge>
            )}
            {order.order_notes && (
              <Badge variant="outline" className="text-xs">
                📋 Obs
              </Badge>
            )}
          </div>

          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-base">
                  #{order.id.slice(0, 8).toUpperCase()}
                </span>
                <Badge className={cn("text-xs", getStatusColor(order.status))}>
                  {getStatusLabel(order.status)}
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground">{customerName}</p>
              <p className="text-xs text-muted-foreground">{order.user_phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className={cn(isUrgent && "text-destructive font-semibold")}>
                {timeAgo}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              <span>{order.items.length} {order.items.length === 1 ? 'item' : 'itens'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <span className="font-bold text-lg">€{order.total_amount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Skeleton className="h-96" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Pedidos</h1>
        
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar pedido..." 
              className="pl-9 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order List */}
        <div className="lg:col-span-1">
          <Card>
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="w-full grid grid-cols-2 rounded-none border-b bg-transparent p-0">
                <TabsTrigger 
                  value="active" 
                  className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
                >
                  Ativos ({activeOrders.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="history"
                  className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
                >
                  Histórico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-0">
                <div className="h-[calc(100vh-240px)] overflow-auto">
                  <div className="p-4">
                    {filterOrders(activeOrders).length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>Nenhum pedido ativo</p>
                      </div>
                    ) : (
                      filterOrders(activeOrders).map(order => (
                        <OrderCard 
                          key={order.id} 
                          order={order} 
                          isSelected={selectedOrder?.id === order.id}
                        />
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <div className="h-[calc(100vh-240px)] overflow-auto">
                  <div className="p-4">
                    {filterOrders(historicalOrders).length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>Nenhum pedido no histórico</p>
                      </div>
                    ) : (
                      filterOrders(historicalOrders).map(order => (
                        <OrderCard 
                          key={order.id} 
                          order={order} 
                          isSelected={selectedOrder?.id === order.id}
                        />
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Right Column - Order Details */}
        <div className="lg:col-span-2">
          <div className="h-[calc(100vh-140px)]">
            <OrderDetailsPanel
              order={selectedOrder}
              onStatusChange={handleStatusChange}
              onContactCustomer={openWhatsApp}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

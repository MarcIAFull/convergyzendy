import { useEffect, useState } from 'react';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useOrderStore } from '@/stores/orderStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Filter, Clock } from 'lucide-react';
import { OrderWithDetails } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { OrderDetailsPanel } from '@/components/OrderDetailsPanel';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const { restaurant } = useRestaurantStore();
  const { orders, loading, fetchOrders, updateOrderStatus, subscribeToOrders } = useOrderStore();
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

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
    
    return ordersList.filter(order => 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.user_phone.includes(searchQuery) ||
      order.delivery_address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new':
        return 'Novo';
      case 'preparing':
        return 'Em Preparação';
      case 'out_for_delivery':
        return 'Em Entrega';
      case 'completed':
        return 'Pronto';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'preparing':
        return 'bg-warning/10 text-warning';
      case 'out_for_delivery':
        return 'bg-info/10 text-info';
      case 'completed':
        return 'bg-success/10 text-success';
      case 'cancelled':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'border-blue-500';
      case 'preparing':
        return 'border-warning';
      case 'out_for_delivery':
        return 'border-info';
      case 'completed':
        return 'border-success';
      case 'cancelled':
        return 'border-destructive';
      default:
        return 'border-border';
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: 'new' | 'preparing' | 'out_for_delivery' | 'completed' | 'cancelled') => {
    await updateOrderStatus(orderId, newStatus);
    
    toast({
      title: "Pedido atualizado",
      description: `Status alterado para ${getStatusLabel(newStatus)}`,
    });
  };

  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  const OrderCard = ({ order }: { order: OrderWithDetails }) => {
    const isSelected = selectedOrder?.id === order.id;
    
    return (
      <Card 
        className={cn(
          "mb-3 cursor-pointer transition-all hover:shadow-md",
          isSelected && `border-l-4 ${getStatusBorderColor(order.status)} bg-accent/50`
        )}
        onClick={() => setSelectedOrder(order)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg">
                #{order.id.slice(0, 2).toUpperCase()}
              </h3>
              <p className="text-sm text-muted-foreground">
                {order.user_phone.split(' ')[0] || 'Cliente'}
              </p>
            </div>
            <Badge className={cn("text-xs font-semibold", getStatusColor(order.status))}>
              {getStatusLabel(order.status).toUpperCase()}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Clock className="h-3.5 w-3.5" />
            <span>{new Date(order.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="font-bold text-lg">€{Number(order.total_amount).toFixed(2)}</span>
            <span className="text-sm text-muted-foreground">
              {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
            </span>
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
                <ScrollArea className="h-[calc(100vh-240px)]">
                  <div className="p-4">
                    {filterOrders(activeOrders).length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>Nenhum pedido ativo</p>
                      </div>
                    ) : (
                      filterOrders(activeOrders).map(order => (
                        <OrderCard key={order.id} order={order} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <ScrollArea className="h-[calc(100vh-240px)]">
                  <div className="p-4">
                    {filterOrders(historicalOrders).length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>Nenhum pedido no histórico</p>
                      </div>
                    ) : (
                      filterOrders(historicalOrders).map(order => (
                        <OrderCard key={order.id} order={order} />
                      ))
                    )}
                  </div>
                </ScrollArea>
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
};

export default Dashboard;

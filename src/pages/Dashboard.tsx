import { useEffect, useState } from 'react';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useOrderStore } from '@/stores/orderStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Clock, Truck, CheckCircle, Phone, DollarSign, Eye } from 'lucide-react';
import { OrderWithDetails } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { OrderDetailsDrawer } from '@/components/OrderDetailsDrawer';

const Dashboard = () => {
  const { restaurant } = useRestaurantStore();
  const { orders, loading, fetchOrders, updateOrderStatus, subscribeToOrders } = useOrderStore();
  const [activeTab, setActiveTab] = useState('all');
  const [isConnected, setIsConnected] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();


  useEffect(() => {
    if (restaurant?.id) {
      fetchOrders(restaurant.id);
      
      // Set up real-time subscription
      const unsubscribe = subscribeToOrders(restaurant.id);
      setIsConnected(true);
      
      return () => {
        unsubscribe();
        setIsConnected(false);
      };
    }
  }, [restaurant?.id, fetchOrders, subscribeToOrders]);

  const getOrdersByStatus = (status: string) => {
    return orders.filter(order => order.status === status);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-primary/10 text-primary hover:bg-primary/20';
      case 'preparing':
        return 'bg-warning/10 text-warning hover:bg-warning/20';
      case 'out_for_delivery':
        return 'bg-info/10 text-info hover:bg-info/20';
      case 'completed':
        return 'bg-success/10 text-success hover:bg-success/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Package className="h-4 w-4" />;
      case 'preparing':
        return <Clock className="h-4 w-4" />;
      case 'out_for_delivery':
        return <Truck className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new':
        return 'New';
      case 'preparing':
        return 'Preparing';
      case 'out_for_delivery':
        return 'Out for Delivery';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: 'new' | 'preparing' | 'out_for_delivery' | 'completed' | 'cancelled') => {
    await updateOrderStatus(orderId, newStatus);
    
    toast({
      title: "Order updated",
      description: `Order status changed to ${getStatusLabel(newStatus)}`,
    });
  };

  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  const handleViewOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  };

  const OrderCard = ({ order }: { order: OrderWithDetails }) => (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {getStatusIcon(order.status)}
              Order #{order.id.slice(0, 8)}
            </CardTitle>
            <CardDescription className="mt-1">
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(order.status)}>
            {getStatusLabel(order.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{order.user_phone}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span className="font-semibold text-foreground">€{Number(order.total_amount).toFixed(2)}</span>
          </div>
        </div>

        <div className="text-sm">
          <p className="text-muted-foreground mb-1">Delivery Address:</p>
          <p className="text-foreground">{order.delivery_address}</p>
        </div>

        <div className="text-sm">
          <p className="text-muted-foreground mb-1">Items:</p>
          <div className="space-y-1">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-foreground">
                <span>{item.quantity}x {item.product.name}</span>
                <span>€{(Number(item.product.price) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm">
          <p className="text-muted-foreground">Payment: <span className="text-foreground capitalize">{order.payment_method}</span></p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewOrder(order)}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
          {order.status === 'new' && (
            <Button
              size="sm"
              onClick={() => handleStatusChange(order.id, 'preparing')}
              className="flex-1"
            >
              Start Preparing
            </Button>
          )}
          {order.status === 'preparing' && (
            <Button
              size="sm"
              onClick={() => handleStatusChange(order.id, 'out_for_delivery')}
              className="flex-1"
            >
              Send for Delivery
            </Button>
          )}
          {order.status === 'out_for_delivery' && (
            <Button
              size="sm"
              onClick={() => handleStatusChange(order.id, 'completed')}
              className="flex-1"
            >
              Mark Completed
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const OrderSection = ({ status, title, icon }: { status: string; title: string; icon: React.ReactNode }) => {
    const statusOrders = getOrdersByStatus(status);
    
    return (
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            {icon}
            {title}
            <Badge variant="secondary" className="ml-auto">
              {statusOrders.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="p-4">
              {statusOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No orders in this status
                </div>
              ) : (
                statusOrders.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Orders Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage your restaurant orders in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-muted'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Live updates active' : 'Connecting...'}
          </span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Orders</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="preparing">Preparing</TabsTrigger>
          <TabsTrigger value="out_for_delivery">Out for Delivery</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <OrderSection
              status="new"
              title="New Orders"
              icon={<Package className="h-5 w-5" />}
            />
            <OrderSection
              status="preparing"
              title="Preparing"
              icon={<Clock className="h-5 w-5" />}
            />
            <OrderSection
              status="out_for_delivery"
              title="Out for Delivery"
              icon={<Truck className="h-5 w-5" />}
            />
            <OrderSection
              status="completed"
              title="Completed"
              icon={<CheckCircle className="h-5 w-5" />}
            />
          </div>
        </TabsContent>

        <TabsContent value="new" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <OrderSection
              status="new"
              title="New Orders"
              icon={<Package className="h-5 w-5" />}
            />
          </div>
        </TabsContent>

        <TabsContent value="preparing" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <OrderSection
              status="preparing"
              title="Preparing"
              icon={<Clock className="h-5 w-5" />}
            />
          </div>
        </TabsContent>

        <TabsContent value="out_for_delivery" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <OrderSection
              status="out_for_delivery"
              title="Out for Delivery"
              icon={<Truck className="h-5 w-5" />}
            />
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <OrderSection
              status="completed"
              title="Completed"
              icon={<CheckCircle className="h-5 w-5" />}
            />
          </div>
        </TabsContent>
      </Tabs>

      <OrderDetailsDrawer
        order={selectedOrder}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onStatusChange={handleStatusChange}
        onContactCustomer={openWhatsApp}
      />
    </div>
  );
};

export default Dashboard;

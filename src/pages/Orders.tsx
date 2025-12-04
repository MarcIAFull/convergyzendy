import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOrderStore } from '@/stores/orderStore';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { OrderDetailsDrawer } from '@/components/OrderDetailsDrawer';
import { useTimeAgo, isOrderUrgent } from '@/hooks/useTimeAgo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OrderWithDetails } from '@/types/database';
import { Search, Clock, AlertCircle, Eye, Phone, Package, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Orders() {
  const { restaurant } = useRestaurantGuard();
  const { orders, loading, fetchOrders, updateOrderStatus, subscribeToOrders } = useOrderStore();
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (restaurant?.id) {
      fetchOrders(restaurant.id);
      const unsubscribe = subscribeToOrders(restaurant.id);
      return () => unsubscribe();
    }
  }, [restaurant?.id, fetchOrders, subscribeToOrders]);

  const filterOrders = (ordersList: OrderWithDetails[]) => {
    let filtered = ordersList;
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.id.toLowerCase().includes(query) ||
        order.user_phone.includes(query) ||
        order.delivery_address.toLowerCase().includes(query) ||
        order.customer?.name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
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
      new: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      preparing: 'bg-warning/10 text-warning border-warning/20',
      out_for_delivery: 'bg-info/10 text-info border-info/20',
      completed: 'bg-success/10 text-success border-success/20',
      cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderWithDetails['status']) => {
    await updateOrderStatus(orderId, newStatus);
  };

  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  const handleViewOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  };

  const filteredOrders = filterOrders(orders);

  // Statistics
  const stats = {
    total: orders.length,
    new: orders.filter(o => o.status === 'new').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    outForDelivery: orders.filter(o => o.status === 'out_for_delivery').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };

  if (loading && orders.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Gestão de Pedidos</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ShoppingBag className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Novos</p>
                <p className="text-2xl font-bold">{stats.new}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Preparando</p>
                <p className="text-2xl font-bold">{stats.preparing}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Package className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Entrega</p>
                <p className="text-2xl font-bold">{stats.outForDelivery}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Package className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por ID, telefone, endereço ou cliente..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="new">Novos</SelectItem>
                <SelectItem value="preparing">Preparando</SelectItem>
                <SelectItem value="out_for_delivery">Em Entrega</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'} encontrado{filteredOrders.length !== 1 && 's'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <OrderTableRow 
                      key={order.id} 
                      order={order} 
                      onView={handleViewOrder}
                      onContact={openWhatsApp}
                      getStatusLabel={getStatusLabel}
                      getStatusColor={getStatusColor}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Order Details Drawer */}
      <OrderDetailsDrawer
        order={selectedOrder}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onStatusChange={handleStatusChange}
        onContactCustomer={openWhatsApp}
      />
    </div>
  );
}

// Separate component for table row to use hooks
function OrderTableRow({ 
  order, 
  onView, 
  onContact,
  getStatusLabel,
  getStatusColor 
}: { 
  order: OrderWithDetails; 
  onView: (order: OrderWithDetails) => void;
  onContact: (phone: string) => void;
  getStatusLabel: (status: string) => string;
  getStatusColor: (status: string) => string;
}) {
  const timeAgo = useTimeAgo(order.created_at);
  const isUrgent = isOrderUrgent(order);
  const customerName = order.customer?.name || 'Cliente';

  return (
    <TableRow className={cn(isUrgent && "bg-destructive/5")}>
      <TableCell>
        <div className="flex items-center gap-2">
          {isUrgent && <AlertCircle className="h-4 w-4 text-destructive" />}
          <span className="font-mono font-medium">
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{customerName}</p>
          <p className="text-sm text-muted-foreground">{order.user_phone}</p>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm max-w-[200px] truncate" title={order.delivery_address}>
          {order.delivery_address}
        </p>
      </TableCell>
      <TableCell>
        <span className="text-sm">{order.items.length} {order.items.length === 1 ? 'item' : 'itens'}</span>
      </TableCell>
      <TableCell>
        <span className="font-semibold">€{order.total_amount.toFixed(2)}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("text-xs", getStatusColor(order.status))}>
          {getStatusLabel(order.status)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <p className={cn(isUrgent && "text-destructive font-medium")}>{timeAgo}</p>
          <p className="text-muted-foreground text-xs">
            {format(new Date(order.created_at), "dd/MM HH:mm", { locale: ptBR })}
          </p>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onContact(order.user_phone)}
            title="Contatar cliente"
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onView(order)}
            title="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

import { useState, useEffect } from 'react';
import { useOrderStore } from '@/stores/orderStore';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { OrdersList } from '@/components/orders/OrdersList';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { OrdersKanban } from '@/components/orders/OrdersKanban';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { OrderWithDetails } from '@/types/database';
import { Search, Filter, List, Table2, Kanban, Clock, Package, ShoppingBag } from 'lucide-react';

type ViewMode = 'list' | 'table' | 'kanban';

export default function Dashboard() {
  const { restaurant } = useRestaurantGuard();
  const { orders, loading, fetchOrders, updateOrderStatus, subscribeToOrders } = useOrderStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('orders-view-mode');
    return (saved as ViewMode) || 'list';
  });

  useEffect(() => {
    if (restaurant?.id) {
      fetchOrders(restaurant.id);
      const unsubscribe = subscribeToOrders(restaurant.id);
      return () => unsubscribe();
    }
  }, [restaurant?.id, fetchOrders, subscribeToOrders]);

  useEffect(() => {
    localStorage.setItem('orders-view-mode', viewMode);
  }, [viewMode]);

  const handleStatusChange = async (orderId: string, newStatus: OrderWithDetails['status']) => {
    await updateOrderStatus(orderId, newStatus);
  };

  // Statistics
  const stats = {
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
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-foreground">Pedidos</h1>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* View Switcher */}
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(value) => value && setViewMode(value as ViewMode)}
            className="bg-muted p-1 rounded-lg"
          >
            <ToggleGroupItem value="list" aria-label="Lista" className="data-[state=on]:bg-background">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Tabela" className="data-[state=on]:bg-background">
              <Table2 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Kanban" className="data-[state=on]:bg-background">
              <Kanban className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar pedido..." 
              className="pl-9 w-48 sm:w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
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

      {/* View Content */}
      {viewMode === 'list' && (
        <OrdersList
          orders={orders}
          onStatusChange={handleStatusChange}
          searchQuery={searchQuery}
        />
      )}
      
      {viewMode === 'table' && (
        <OrdersTable
          orders={orders}
          onStatusChange={handleStatusChange}
          searchQuery={searchQuery}
        />
      )}
      
      {viewMode === 'kanban' && (
        <OrdersKanban
          orders={orders}
          onStatusChange={handleStatusChange}
          searchQuery={searchQuery}
        />
      )}
    </div>
  );
}

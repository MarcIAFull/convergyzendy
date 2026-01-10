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
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { OrderWithDetails } from '@/types/database';
import { Search, Filter, List, Table2, Kanban, Clock, Package, ShoppingBag, X } from 'lucide-react';

type ViewMode = 'list' | 'table' | 'kanban';
type StatusFilter = 'all' | 'new' | 'preparing' | 'out_for_delivery' | 'completed';
type SourceFilter = 'all' | 'whatsapp' | 'web';
type PeriodFilter = 'all' | 'today' | 'week' | 'month';

interface Filters {
  status: StatusFilter;
  source: SourceFilter;
  period: PeriodFilter;
}

export default function Dashboard() {
  const { restaurant } = useRestaurantGuard();
  const { orders, loading, fetchOrders, updateOrderStatus, subscribeToOrders } = useOrderStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('orders-view-mode');
    return (saved as ViewMode) || 'list';
  });
  const [filters, setFilters] = useState<Filters>(() => {
    const saved = localStorage.getItem('orders-filters');
    return saved ? JSON.parse(saved) : { status: 'all', source: 'all', period: 'all' };
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

  useEffect(() => {
    localStorage.setItem('orders-filters', JSON.stringify(filters));
  }, [filters]);

  const handleStatusChange = async (orderId: string, newStatus: OrderWithDetails['status']) => {
    await updateOrderStatus(orderId, newStatus);
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    // Status filter
    if (filters.status !== 'all' && order.status !== filters.status) return false;
    
    // Source filter - check if order has source field or infer from other fields
    if (filters.source !== 'all') {
      const orderSource = (order as any).source;
      if (orderSource) {
        const isWeb = orderSource === 'web';
        if (filters.source === 'web' && !isWeb) return false;
        if (filters.source === 'whatsapp' && isWeb) return false;
      }
    }
    
    // Period filter
    if (filters.period !== 'all') {
      const orderDate = new Date(order.created_at);
      const now = new Date();
      if (filters.period === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (orderDate < today) return false;
      } else if (filters.period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (orderDate < weekAgo) return false;
      } else if (filters.period === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (orderDate < monthAgo) return false;
      }
    }
    
    return true;
  });

  // Statistics (from filtered orders)
  const stats = {
    new: filteredOrders.filter(o => o.status === 'new').length,
    preparing: filteredOrders.filter(o => o.status === 'preparing').length,
    outForDelivery: filteredOrders.filter(o => o.status === 'out_for_delivery').length,
    completed: filteredOrders.filter(o => o.status === 'completed').length,
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== 'all').length;

  const clearFilters = () => {
    setFilters({ status: 'all', source: 'all', period: 'all' });
  };

  if (loading && orders.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Pedidos</h1>
        
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
            <ToggleGroupItem value="table" aria-label="Tabela" className="data-[state=on]:bg-background hidden sm:flex">
              <Table2 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Kanban" className="data-[state=on]:bg-background hidden sm:flex">
              <Kanban className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Search */}
          <div className="relative flex-1 min-w-[150px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar pedido..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Filter className="h-4 w-4" />
                {activeFiltersCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center justify-between">
                Filtros
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-1 text-xs">
                    <X className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuLabel className="text-xs text-muted-foreground">Estado</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={filters.status === 'all'} onCheckedChange={() => setFilters(f => ({ ...f, status: 'all' }))}>
                Todos ({orders.length})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filters.status === 'new'} onCheckedChange={() => setFilters(f => ({ ...f, status: 'new' }))}>
                Novos ({orders.filter(o => o.status === 'new').length})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filters.status === 'preparing'} onCheckedChange={() => setFilters(f => ({ ...f, status: 'preparing' }))}>
                Preparando ({orders.filter(o => o.status === 'preparing').length})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filters.status === 'out_for_delivery'} onCheckedChange={() => setFilters(f => ({ ...f, status: 'out_for_delivery' }))}>
                Em Entrega ({orders.filter(o => o.status === 'out_for_delivery').length})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filters.status === 'completed'} onCheckedChange={() => setFilters(f => ({ ...f, status: 'completed' }))}>
                Concluídos ({orders.filter(o => o.status === 'completed').length})
              </DropdownMenuCheckboxItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Origem</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={filters.source === 'all'} onCheckedChange={() => setFilters(f => ({ ...f, source: 'all' }))}>
                Todas
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filters.source === 'whatsapp'} onCheckedChange={() => setFilters(f => ({ ...f, source: 'whatsapp' }))}>
                WhatsApp
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filters.source === 'web'} onCheckedChange={() => setFilters(f => ({ ...f, source: 'web' }))}>
                Web
              </DropdownMenuCheckboxItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Período</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={filters.period === 'all'} onCheckedChange={() => setFilters(f => ({ ...f, period: 'all' }))}>
                Todo o período
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filters.period === 'today'} onCheckedChange={() => setFilters(f => ({ ...f, period: 'today' }))}>
                Hoje
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filters.period === 'week'} onCheckedChange={() => setFilters(f => ({ ...f, period: 'week' }))}>
                Última semana
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filters.period === 'month'} onCheckedChange={() => setFilters(f => ({ ...f, period: 'month' }))}>
                Último mês
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          orders={filteredOrders}
          onStatusChange={handleStatusChange}
          searchQuery={searchQuery}
        />
      )}
      
      {viewMode === 'table' && (
        <OrdersTable
          orders={filteredOrders}
          onStatusChange={handleStatusChange}
          searchQuery={searchQuery}
        />
      )}
      
      {viewMode === 'kanban' && (
        <OrdersKanban
          orders={filteredOrders}
          onStatusChange={handleStatusChange}
          searchQuery={searchQuery}
        />
      )}
    </div>
  );
}

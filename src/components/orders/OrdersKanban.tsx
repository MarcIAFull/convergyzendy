import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OrderDetailsDrawer } from '@/components/OrderDetailsDrawer';
import { useTimeAgo, isOrderUrgent } from '@/hooks/useTimeAgo';
import type { OrderWithDetails } from '@/types/database';
import { AlertCircle, Clock, Package, CheckCircle, XCircle, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrdersKanbanProps {
  orders: OrderWithDetails[];
  onStatusChange: (orderId: string, newStatus: OrderWithDetails['status']) => Promise<void>;
  searchQuery: string;
}

const KANBAN_COLUMNS = [
  { id: 'new', title: 'Novos', icon: Package, color: 'bg-blue-500', borderColor: 'border-blue-500' },
  { id: 'preparing', title: 'Preparando', icon: Clock, color: 'bg-warning', borderColor: 'border-warning' },
  { id: 'out_for_delivery', title: 'Em Entrega', icon: Package, color: 'bg-info', borderColor: 'border-info' },
  { id: 'completed', title: 'Concluídos', icon: CheckCircle, color: 'bg-success', borderColor: 'border-success' },
  { id: 'cancelled', title: 'Cancelados', icon: XCircle, color: 'bg-destructive', borderColor: 'border-destructive' },
];

export function OrdersKanban({ orders, onStatusChange, searchQuery }: OrdersKanbanProps) {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const filteredOrders = filterOrders(orders);

  const getOrdersByStatus = (status: string) => {
    return filteredOrders.filter(order => order.status === status);
  };

  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  const handleViewOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((column) => {
          const columnOrders = getOrdersByStatus(column.id);
          const Icon = column.icon;
          
          return (
            <div key={column.id} className="flex-shrink-0 w-72">
              <Card className={cn("h-full", `border-t-4 ${column.borderColor}`)}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", column.color.replace('bg-', 'text-'))} />
                      {column.title}
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {columnOrders.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <ScrollArea className="h-[calc(100vh-320px)]">
                    <div className="space-y-2 pr-2">
                      {columnOrders.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          Nenhum pedido
                        </div>
                      ) : (
                        columnOrders.map(order => (
                          <KanbanCard
                            key={order.id}
                            order={order}
                            onView={handleViewOrder}
                            onContact={openWhatsApp}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      <OrderDetailsDrawer
        order={selectedOrder}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onStatusChange={onStatusChange}
        onContactCustomer={openWhatsApp}
      />
    </>
  );
}

function KanbanCard({ 
  order, 
  onView, 
  onContact 
}: { 
  order: OrderWithDetails;
  onView: (order: OrderWithDetails) => void;
  onContact: (phone: string) => void;
}) {
  const timeAgo = useTimeAgo(order.created_at);
  const isUrgent = isOrderUrgent(order);
  const customerName = order.customer?.name || 'Cliente';

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
        isUrgent && "ring-2 ring-destructive"
      )}
      onClick={() => onView(order)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1">
            {isUrgent && <AlertCircle className="h-3 w-3 text-destructive" />}
            <span className="font-mono text-xs font-medium">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onContact(order.user_phone);
            }}
          >
            <Phone className="h-3 w-3" />
          </Button>
        </div>
        
        <p className="font-medium text-sm truncate">{customerName}</p>
        <p className="text-xs text-muted-foreground truncate">{order.user_phone}</p>
        
        <div className="mt-2 pt-2 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
          </span>
          <span className="font-semibold text-sm">€{order.total_amount.toFixed(2)}</span>
        </div>
        
        <p className={cn(
          "text-xs mt-1",
          isUrgent ? "text-destructive font-medium" : "text-muted-foreground"
        )}>
          {timeAgo}
        </p>
      </CardContent>
    </Card>
  );
}

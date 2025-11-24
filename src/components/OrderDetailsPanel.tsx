import { OrderWithDetails } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Phone, 
  MapPin, 
  CreditCard,
  Printer,
  Bike
} from 'lucide-react';
import { format } from 'date-fns';

interface OrderDetailsPanelProps {
  order: OrderWithDetails | null;
  onStatusChange: (orderId: string, newStatus: 'new' | 'preparing' | 'out_for_delivery' | 'completed' | 'cancelled') => void;
  onContactCustomer: (phone: string) => void;
}

export function OrderDetailsPanel({
  order,
  onStatusChange,
  onContactCustomer,
}: OrderDetailsPanelProps) {
  if (!order) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-muted-foreground text-lg">Selecione um pedido</div>
          <p className="text-sm text-muted-foreground mt-2">
            Clique em um pedido da lista para ver os detalhes
          </p>
        </div>
      </Card>
    );
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new':
        return 'NOVO';
      case 'preparing':
        return 'PREPARANDO';
      case 'out_for_delivery':
        return 'EM ENTREGA';
      case 'completed':
        return 'CONCLUÍDO';
      case 'cancelled':
        return 'CANCELADO';
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

  const calculateItemTotal = (item: typeof order.items[0]) => {
    const productTotal = Number(item.product.price) * item.quantity;
    const addonsTotal = item.addons.reduce((sum, addon) => sum + Number(addon.price), 0) * item.quantity;
    return productTotal + addonsTotal;
  };

  const subtotal = order.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <CardTitle className="text-3xl font-bold">
              #{order.id.slice(0, 2).toUpperCase()}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Recebido em {format(new Date(order.created_at), 'dd/MM/yyyy, HH:mm:ss')}
            </p>
          </div>
          <Badge className={getStatusColor(order.status) + " text-xs font-bold px-3 py-1"}>
            {getStatusLabel(order.status)}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Printer className="h-4 w-4 mr-2" />
          </Button>
          
          {order.status === 'preparing' && (
            <Button 
              size="sm" 
              className="flex-1 bg-success hover:bg-success/90 text-white"
              onClick={() => onStatusChange(order.id, 'out_for_delivery')}
            >
              Pronto p/ Entrega
            </Button>
          )}
          
          {order.status === 'new' && (
            <Button 
              size="sm" 
              className="flex-1 bg-success hover:bg-success/90 text-white"
              onClick={() => onStatusChange(order.id, 'preparing')}
            >
              Iniciar Preparo
            </Button>
          )}

          {(order.status === 'new' || order.status === 'preparing') && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => onStatusChange(order.id, 'cancelled')}
            >
              Cancelar
            </Button>
          )}

          {order.status === 'out_for_delivery' && (
            <Button 
              size="sm" 
              className="flex-1 bg-success hover:bg-success/90 text-white"
              onClick={() => onStatusChange(order.id, 'completed')}
            >
              Concluir
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Content */}
      <ScrollArea className="flex-1">
        <CardContent className="p-6 space-y-6">
          {/* Customer Info */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-semibold">João Silva</p>
                <p className="text-sm text-muted-foreground">{order.user_phone}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Endereço de Entrega</p>
                <p className="font-medium text-sm mt-1">{order.delivery_address}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Pagamento</p>
                <p className="font-semibold capitalize">{order.payment_method}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Bike className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">Motoboy Responsável</p>
                <Select defaultValue="none">
                  <SelectTrigger>
                    <SelectValue placeholder="-- Nenhum --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Nenhum --</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Order Items */}
          <div>
            <table className="w-full">
              <thead>
                <tr className="text-sm text-muted-foreground border-b">
                  <th className="text-left pb-2 font-medium">ITEM</th>
                  <th className="text-center pb-2 font-medium">QTD</th>
                  <th className="text-right pb-2 font-medium">PREÇO</th>
                  <th className="text-right pb-2 font-medium">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.items.map((item, idx) => (
                  <tr key={idx} className="text-sm">
                    <td className="py-3">
                      <div>
                        <p className="font-medium">{item.product.name}</p>
                        {item.addons.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {item.addons.map((addon, addonIdx) => (
                              <p key={addonIdx} className="text-xs text-muted-foreground">
                                + {addon.name}
                              </p>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs text-destructive mt-1">
                            Obs: {item.notes}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-3">{item.quantity}</td>
                    <td className="text-right py-3">€{Number(item.product.price).toFixed(2)}</td>
                    <td className="text-right py-3 font-semibold">€{calculateItemTotal(item).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa de Entrega</span>
              <span>€{(Number(order.total_amount) - subtotal).toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>€{Number(order.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}

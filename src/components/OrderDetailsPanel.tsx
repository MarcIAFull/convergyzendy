import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PrintableOrder } from '@/components/PrintableOrder';
import { toast } from '@/hooks/use-toast';
import type { OrderWithDetails } from '@/types/database';
import { 
  Phone, 
  MapPin, 
  CreditCard,
  Package,
  Printer,
  MessageSquare,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderDetailsPanelProps {
  order: OrderWithDetails | null;
  onStatusChange: (id: string, status: OrderWithDetails['status']) => Promise<void>;
  onContactCustomer: (phone: string) => void;
}

export function OrderDetailsPanel({ order, onStatusChange, onContactCustomer }: OrderDetailsPanelProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleStatusChange = async (newStatus: typeof order.status) => {
    if (!order) return;
    
    setIsUpdatingStatus(true);
    try {
      await onStatusChange(order.id, newStatus);
      toast({
        title: "✅ Pedido atualizado",
        description: `Status alterado para ${getStatusLabel(newStatus)}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Erro ao atualizar",
        description: "Tente novamente",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCancelOrder = async () => {
    await handleStatusChange('cancelled');
    setShowCancelDialog(false);
  };

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
    const labels: Record<string, string> = {
      new: 'Novo',
      preparing: 'Preparando',
      out_for_delivery: 'Saiu p/ Entrega',
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

  const calculateItemTotal = (item: typeof order.items[0]) => {
    const basePrice = item.product.price * item.quantity;
    const addonsPrice = item.addons.reduce((sum, addon) => sum + addon.price, 0) * item.quantity;
    return basePrice + addonsPrice;
  };

  const subtotal = order.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const deliveryFee = order.total_amount - subtotal;
  const customerName = order.customer?.name || 'Cliente sem cadastro';

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-2xl font-bold">
              Pedido #{order.id.slice(0, 8).toUpperCase()}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <Badge className={getStatusColor(order.status)}>
            {getStatusLabel(order.status)}
          </Badge>
        </div>

        {/* Botões de ação principais */}
        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => onContactCustomer(order.user_phone)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto space-y-6">
        {/* Informações do Cliente */}
        <div className="flex items-start gap-3">
          <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-semibold text-lg">{customerName}</p>
            <p className="text-sm text-muted-foreground">{order.user_phone}</p>
          </div>
        </div>

        <Separator />

        {/* Observações do Pedido */}
        {order.order_notes && (
          <>
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">Observações do Pedido</p>
                  <p className="text-sm">{order.order_notes}</p>
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Endereço de Entrega */}
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Endereço de Entrega</p>
            <p className="font-medium text-sm mt-1">{order.delivery_address}</p>
          </div>
        </div>

        <Separator />

        {/* Pagamento */}
        <div className="flex items-start gap-3">
          <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Método de Pagamento</p>
            <p className="font-semibold capitalize">{order.payment_method}</p>
          </div>
        </div>

        <Separator />

        {/* Lista de Itens */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Itens do Pedido</h3>
          </div>
          
          <div className="space-y-3">
            {order.items.map((item, idx) => {
              const itemTotal = calculateItemTotal(item);
              
              return (
                <div key={idx} className="flex gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-base">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.quantity}x €{item.product.price.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-bold text-lg">€{itemTotal.toFixed(2)}</p>
                    </div>
                    
                    {item.addons.length > 0 && (
                      <div className="mt-3 pl-4 border-l-2 border-primary/30 space-y-1">
                        {item.addons.map((addon) => (
                          <p key={addon.id} className="text-sm text-muted-foreground">
                            + {addon.name} <span className="font-medium">(€{addon.price.toFixed(2)})</span>
                          </p>
                        ))}
                      </div>
                    )}
                    
                    {item.notes && (
                      <div className="mt-3 p-3 bg-warning/10 border border-warning/20 rounded-md">
                        <p className="text-sm">
                          <span className="font-semibold">Obs:</span> {item.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Totais */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">€{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Taxa de Entrega</span>
            <span className="font-medium">€{deliveryFee.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-xl font-bold">
            <span>Total</span>
            <span>€{order.total_amount.toFixed(2)}</span>
          </div>
        </div>

        <Separator />

        {/* Botões de Ação */}
        <div className="space-y-2">
          {order.status === 'new' && (
            <Button 
              size="sm" 
              className="w-full bg-success hover:bg-success/90 text-white"
              onClick={() => handleStatusChange('preparing')}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Atualizando...</>
              ) : (
                'Iniciar Preparo'
              )}
            </Button>
          )}
          
          {order.status === 'preparing' && (
            <Button 
              size="sm" 
              className="w-full bg-info hover:bg-info/90 text-white"
              onClick={() => handleStatusChange('out_for_delivery')}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Atualizando...</>
              ) : (
                'Pronto p/ Entrega'
              )}
            </Button>
          )}
          
          {order.status === 'out_for_delivery' && (
            <Button 
              size="sm" 
              className="w-full bg-success hover:bg-success/90 text-white"
              onClick={() => handleStatusChange('completed')}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Atualizando...</>
              ) : (
                'Concluir Entrega'
              )}
            </Button>
          )}

          {(order.status === 'new' || order.status === 'preparing') && (
            <Button 
              variant="destructive" 
              size="sm"
              className="w-full"
              onClick={() => setShowCancelDialog(true)}
              disabled={isUpdatingStatus}
            >
              Cancelar Pedido
            </Button>
          )}
        </div>
      </CardContent>

      {/* PrintableOrder component */}
      <PrintableOrder order={order} />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o pedido #{order.id.slice(0, 8).toUpperCase()}?
              Esta ação não pode ser desfeita. O cliente será notificado via WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className="bg-destructive hover:bg-destructive/90"
            >
              Sim, Cancelar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

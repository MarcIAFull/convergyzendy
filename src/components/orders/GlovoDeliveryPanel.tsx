import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Truck, 
  Loader2, 
  MapPin, 
  Phone, 
  Clock, 
  ExternalLink,
  RefreshCw,
  XCircle,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useGlovoStore } from '@/stores/glovoStore';
import { useRestaurantStore } from '@/stores/restaurantStore';
import type { GlovoDelivery, GlovoDeliveryStatus } from '@/types/glovo';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
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

interface GlovoDeliveryPanelProps {
  orderId: string;
  deliveryAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  customerName?: string;
  customerPhone?: string;
  orderDescription?: string;
  onDeliveryCreated?: () => void;
}

const statusLabels: Record<GlovoDeliveryStatus, string> = {
  CREATED: 'Criado',
  ACCEPTED: 'Aceite',
  WAITING_FOR_PICKUP: 'Aguarda Recolha',
  PICKED: 'Recolhido',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
};

const statusColors: Record<GlovoDeliveryStatus, string> = {
  CREATED: 'bg-blue-500/10 text-blue-600',
  ACCEPTED: 'bg-info/10 text-info',
  WAITING_FOR_PICKUP: 'bg-warning/10 text-warning',
  PICKED: 'bg-primary/10 text-primary',
  DELIVERED: 'bg-success/10 text-success',
  CANCELLED: 'bg-destructive/10 text-destructive',
  EXPIRED: 'bg-muted text-muted-foreground',
};

export function GlovoDeliveryPanel({
  orderId,
  deliveryAddress,
  deliveryLatitude,
  deliveryLongitude,
  customerName,
  customerPhone,
  orderDescription,
  onDeliveryCreated,
}: GlovoDeliveryPanelProps) {
  const { restaurant } = useRestaurantStore();
  const {
    config,
    currentQuote,
    deliveries,
    isLoading,
    error,
    fetchConfig,
    getQuote,
    createDelivery,
    cancelDelivery,
    refreshDeliveryStatus,
    fetchDeliveryForOrder,
    clearQuote,
    clearError,
  } = useGlovoStore();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const delivery = deliveries[orderId];

  useEffect(() => {
    if (restaurant?.id) {
      fetchConfig(restaurant.id);
      fetchDeliveryForOrder(restaurant.id, orderId);
    }
  }, [restaurant?.id, orderId]);

  // Auto-refresh delivery status every 30 seconds if in transit
  useEffect(() => {
    if (!delivery || !restaurant?.id) return;
    
    const activeStatuses: GlovoDeliveryStatus[] = ['CREATED', 'ACCEPTED', 'WAITING_FOR_PICKUP', 'PICKED'];
    if (!activeStatuses.includes(delivery.status as GlovoDeliveryStatus)) return;

    const interval = setInterval(() => {
      refreshDeliveryStatus(restaurant.id, delivery.tracking_number);
    }, 30000);

    return () => clearInterval(interval);
  }, [delivery?.status, delivery?.tracking_number, restaurant?.id]);

  // If Glovo not configured or not enabled, don't show
  if (!config?.enabled) {
    return null;
  }

  const handleGetQuote = async () => {
    if (!restaurant?.id || !deliveryLatitude || !deliveryLongitude) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Endereço de entrega incompleto. Verifique as coordenadas.',
      });
      return;
    }

    await getQuote(restaurant.id, orderId, {
      latitude: deliveryLatitude,
      longitude: deliveryLongitude,
      address: deliveryAddress,
    });
  };

  const handleCreateDelivery = async () => {
    if (!restaurant?.id || !currentQuote) return;

    const result = await createDelivery(restaurant.id, {
      quoteId: currentQuote.quoteId,
      orderId,
      customerName: customerName || 'Cliente',
      customerPhone: customerPhone || '',
      deliveryAddress: {
        latitude: deliveryLatitude!,
        longitude: deliveryLongitude!,
        address: deliveryAddress,
      },
      orderDescription,
    });

    if (result) {
      toast({
        title: '🚴 Estafeta solicitado!',
        description: `Tracking: ${result.tracking_number}`,
      });
      onDeliveryCreated?.();
    }
  };

  const handleCancelDelivery = async () => {
    if (!restaurant?.id || !delivery) return;

    const success = await cancelDelivery(restaurant.id, delivery.tracking_number);
    setShowCancelDialog(false);

    if (success) {
      toast({
        title: 'Entrega cancelada',
        description: 'O pedido de entrega Glovo foi cancelado.',
      });
      // Refresh to get updated status
      fetchDeliveryForOrder(restaurant.id, orderId);
    }
  };

  const handleRefresh = async () => {
    if (!restaurant?.id || !delivery) return;
    setIsRefreshing(true);
    await refreshDeliveryStatus(restaurant.id, delivery.tracking_number);
    await fetchDeliveryForOrder(restaurant.id, orderId);
    setIsRefreshing(false);
  };

  const canCancel = delivery && ['CREATED', 'ACCEPTED', 'WAITING_FOR_PICKUP'].includes(delivery.status);

  return (
    <Card className="border-warning/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-5 w-5 text-warning" />
            Glovo On-Demand
          </CardTitle>
          {delivery && (
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* No delivery yet - Show quote flow */}
        {!delivery && (
          <>
            {!currentQuote ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Solicite um estafeta Glovo para entregar este pedido.
                </p>
                <Button
                  onClick={handleGetQuote}
                  disabled={isLoading || !deliveryLatitude || !deliveryLongitude}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      A obter orçamento...
                    </>
                  ) : (
                    <>
                      <Truck className="h-4 w-4 mr-2" />
                      Solicitar Orçamento
                    </>
                  )}
                </Button>
                {!deliveryLatitude && (
                  <p className="text-xs text-destructive">
                    ⚠️ Coordenadas de entrega não disponíveis
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Preço estimado</span>
                    <span className="text-xl font-bold">
                      €{currentQuote.price.toFixed(2)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Entrega estimada
                    </span>
                    <span>
                      {format(currentQuote.estimatedDelivery, 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Orçamento válido até {format(currentQuote.expiresAt, 'HH:mm')}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearQuote} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateDelivery} disabled={isLoading} className="flex-1">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        A criar...
                      </>
                    ) : (
                      'Confirmar Pedido'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Delivery exists - Show status */}
        {delivery && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge className={statusColors[delivery.status as GlovoDeliveryStatus]}>
                {statusLabels[delivery.status as GlovoDeliveryStatus] || delivery.status}
              </Badge>
              <span className="text-sm font-mono text-muted-foreground">
                {delivery.tracking_number}
              </span>
            </div>

            {/* Courier info */}
            {delivery.courier_name && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                    🚴
                  </div>
                  <div>
                    <p className="font-medium text-sm">{delivery.courier_name}</p>
                    {delivery.courier_phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {delivery.courier_phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ETA */}
            {delivery.estimated_delivery_at && delivery.status !== 'DELIVERED' && delivery.status !== 'CANCELLED' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  ETA
                </span>
                <span className="font-medium">
                  {format(new Date(delivery.estimated_delivery_at), 'HH:mm', { locale: ptBR })}
                </span>
              </div>
            )}

            {/* Delivered timestamp */}
            {delivery.delivered_at && (
              <div className="flex items-center gap-2 text-success text-sm">
                <CheckCircle className="h-4 w-4" />
                Entregue às {format(new Date(delivery.delivered_at), 'HH:mm', { locale: ptBR })}
              </div>
            )}

            {/* Cancelled info */}
            {delivery.status === 'CANCELLED' && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="h-4 w-4" />
                {delivery.cancellation_reason || 'Cancelado'}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {delivery.tracking_link && (
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <a href={delivery.tracking_link} target="_blank" rel="noopener noreferrer">
                    <MapPin className="h-4 w-4 mr-1" />
                    Ver no Mapa
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              )}
              
              {canCancel && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
              )}
            </div>

            {/* Fee info */}
            {(delivery.quote_price || delivery.final_fee) && (
              <div className="text-xs text-muted-foreground pt-2 border-t">
                Taxa: €{(delivery.final_fee || delivery.quote_price)?.toFixed(2)}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar entrega Glovo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja cancelar esta entrega? O estafeta será notificado e pode haver taxas de cancelamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelDelivery} className="bg-destructive hover:bg-destructive/90">
              Sim, Cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

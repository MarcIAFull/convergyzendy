import { OrderWithDetails } from '@/types/database';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Package, 
  Clock, 
  Truck, 
  CheckCircle, 
  Phone, 
  MapPin, 
  CreditCard,
  DollarSign,
  X
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface OrderDetailsDrawerProps {
  order: OrderWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, newStatus: 'new' | 'preparing' | 'out_for_delivery' | 'completed' | 'cancelled') => void;
  onContactCustomer: (phone: string) => void;
}

export function OrderDetailsDrawer({
  order,
  open,
  onOpenChange,
  onStatusChange,
  onContactCustomer,
}: OrderDetailsDrawerProps) {
  if (!order) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-primary/10 text-primary';
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Package className="h-5 w-5" />;
      case 'preparing':
        return <Clock className="h-5 w-5" />;
      case 'out_for_delivery':
        return <Truck className="h-5 w-5" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5" />;
      case 'cancelled':
        return <X className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new':
        return 'New Order';
      case 'preparing':
        return 'Preparing';
      case 'out_for_delivery':
        return 'Out for Delivery';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const calculateItemTotal = (item: typeof order.items[0]) => {
    const productTotal = Number(item.product.price) * item.quantity;
    const addonsTotal = item.addons.reduce((sum, addon) => sum + Number(addon.price), 0) * item.quantity;
    return productTotal + addonsTotal;
  };

  const subtotal = order.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DrawerTitle className="text-2xl flex items-center gap-3">
                {getStatusIcon(order.status)}
                Order #{order.id.slice(0, 8).toUpperCase()}
              </DrawerTitle>
              <DrawerDescription className="mt-2 flex items-center gap-4">
                <span>{format(new Date(order.created_at), 'PPp')}</span>
                <span className="text-muted-foreground">•</span>
                <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
              </DrawerDescription>
            </div>
            <Badge className={getStatusColor(order.status)}>
              {getStatusLabel(order.status)}
            </Badge>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{order.user_phone}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onContactCustomer(order.user_phone)}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Contact
                  </Button>
                </div>

                <Separator />

                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Delivery Address</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {order.delivery_address}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Payment:</span>
                  <Badge variant="outline" className="capitalize">
                    {order.payment_method}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Items</CardTitle>
                <CardDescription>
                  {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item, idx) => (
                    <div key={idx}>
                      {idx > 0 && <Separator className="mb-4" />}
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                                {item.quantity}
                              </Badge>
                              <span className="font-medium">{item.product.name}</span>
                            </div>
                            {item.product.description && (
                              <p className="text-sm text-muted-foreground mt-1 ml-8">
                                {item.product.description}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-sm text-muted-foreground italic mt-1 ml-8">
                                Note: {item.notes}
                              </p>
                            )}
                          </div>
                          <span className="font-semibold text-nowrap ml-4">
                            €{(Number(item.product.price) * item.quantity).toFixed(2)}
                          </span>
                        </div>

                        {item.addons.length > 0 && (
                          <div className="ml-8 space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Add-ons:</p>
                            {item.addons.map((addon, addonIdx) => (
                              <div key={addonIdx} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">+ {addon.name}</span>
                                <span className="text-muted-foreground">
                                  €{(Number(addon.price) * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-between text-sm font-medium ml-8 pt-1">
                          <span>Item Total:</span>
                          <span>€{calculateItemTotal(item).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Order Total */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Order Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>€{subtotal.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">€{Number(order.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DrawerFooter className="border-t">
          <div className="flex gap-2 flex-wrap">
            {order.status === 'new' && (
              <>
                <Button
                  className="flex-1"
                  onClick={() => {
                    onStatusChange(order.id, 'preparing');
                    onOpenChange(false);
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Start Preparing
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    onStatusChange(order.id, 'cancelled');
                    onOpenChange(false);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
            
            {order.status === 'preparing' && (
              <>
                <Button
                  className="flex-1"
                  onClick={() => {
                    onStatusChange(order.id, 'out_for_delivery');
                    onOpenChange(false);
                  }}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Send for Delivery
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onStatusChange(order.id, 'new');
                  }}
                >
                  Back to New
                </Button>
              </>
            )}
            
            {order.status === 'out_for_delivery' && (
              <>
                <Button
                  className="flex-1"
                  onClick={() => {
                    onStatusChange(order.id, 'completed');
                    onOpenChange(false);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Completed
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onStatusChange(order.id, 'preparing');
                  }}
                >
                  Back to Preparing
                </Button>
              </>
            )}

            {(order.status === 'completed' || order.status === 'cancelled') && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            )}
          </div>
          
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart } from 'lucide-react';
import type { CartWithItems } from '@/types/conversation';

interface LiveCartProps {
  cart: CartWithItems;
}

export function LiveCart({ cart }: LiveCartProps) {
  const calculateItemTotal = (item: any) => {
    const basePrice = item.product.price * item.quantity;
    const addonsPrice = item.addons.reduce((sum: number, addon: any) => sum + addon.price, 0) * item.quantity;
    return basePrice + addonsPrice;
  };

  const total = cart.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Carrinho Atual
          </CardTitle>
          <Badge variant="default" className="bg-success text-success-foreground animate-pulse">
            LIVE
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {cart.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carrinho vazio</p>
        ) : (
          <>
            {cart.items.map((item, idx) => (
              <div key={idx} className="border-b border-border pb-2 last:border-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {item.quantity}x {item.product.name}
                    </p>
                    {item.addons.length > 0 && (
                      <div className="ml-4 mt-1 space-y-0.5">
                        {item.addons.map((addon) => (
                          <p key={addon.id} className="text-xs text-muted-foreground">
                            + {addon.name} (+€{addon.price.toFixed(2)})
                          </p>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Obs: {item.notes}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold">
                    €{calculateItemTotal(item).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <p className="font-semibold">Total Estimado</p>
                <p className="text-lg font-bold text-primary">€{total.toFixed(2)}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

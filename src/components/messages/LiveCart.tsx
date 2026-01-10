import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Send, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { CartWithItems } from '@/types/conversation';
import { useState } from 'react';

interface LiveCartProps {
  cart: CartWithItems;
  restaurantId?: string;
  customerPhone?: string;
}

export function LiveCart({ cart, restaurantId, customerPhone }: LiveCartProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const calculateItemTotal = (item: any) => {
    const basePrice = item.product.price * item.quantity;
    const addonsPrice = item.addons.reduce((sum: number, addon: any) => sum + addon.price, 0) * item.quantity;
    return basePrice + addonsPrice;
  };

  const total = cart.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSendCheckoutLink = async () => {
    if (!restaurantId || !customerPhone) {
      toast({
        variant: 'destructive',
        title: '❌ Erro',
        description: 'Dados insuficientes para enviar o link',
      });
      return;
    }

    setIsSending(true);
    try {
      // Get restaurant slug
      const { data: settings } = await supabase
        .from('restaurant_settings')
        .select('slug')
        .eq('restaurant_id', restaurantId)
        .single();

      if (!settings?.slug) {
        throw new Error('Menu público não configurado');
      }

      const checkoutUrl = `${window.location.origin}/menu/${settings.slug}/checkout`;
      const message = `🛒 Finalize seu pedido aqui:\n${checkoutUrl}`;

      const { error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          restaurantId,
          customerPhone,
          messageText: message,
        },
      });

      if (error) throw error;

      toast({
        title: '✅ Link enviado',
        description: 'Link de checkout enviado com sucesso',
      });
    } catch (error: any) {
      console.error('Error sending checkout link:', error);
      toast({
        variant: 'destructive',
        title: '❌ Erro ao enviar',
        description: error.message || 'Não foi possível enviar o link',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Carrinho</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {itemCount} {itemCount === 1 ? 'item' : 'itens'}
          </Badge>
        </div>
        <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px] px-1.5 py-0 animate-pulse">
          LIVE
        </Badge>
      </div>

      {/* Items */}
      <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
        {cart.items.map((item, idx) => (
          <div key={idx} className="text-sm">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {item.quantity}x {item.product.name}
                </p>
                {item.addons.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">
                    + {item.addons.map(a => a.name).join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-muted-foreground italic truncate">
                    {item.notes}
                  </p>
                )}
              </div>
              <span className="text-sm font-medium ml-2 flex-shrink-0">
                €{calculateItemTotal(item).toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Total</span>
          <span className="text-base font-bold text-primary">€{total.toFixed(2)}</span>
        </div>
        
        {restaurantId && customerPhone && (
          <Button 
            size="sm" 
            className="w-full" 
            onClick={handleSendCheckoutLink}
            disabled={isSending}
          >
            {isSending ? (
              <>Enviando...</>
            ) : (
              <>
                <Send className="h-3 w-3 mr-1.5" />
                Enviar Link de Checkout
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

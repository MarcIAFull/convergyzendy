import { useNavigate, useParams } from 'react-router-dom';
import { usePublicCartStore } from '@/stores/publicCartStore';
import { usePublicMenuStore } from '@/stores/publicMenuStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect } from 'react';

export default function PublicCart() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { items, getSubtotal, updateItemQuantity, removeItem, clearCart } = usePublicCartStore();
  const { menuData, fetchMenuBySlug } = usePublicMenuStore();

  useEffect(() => {
    if (slug && !menuData) {
      fetchMenuBySlug(slug);
    }
  }, [slug]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const subtotal = getSubtotal();
  const deliveryFee = menuData?.restaurant.delivery_fee || 0;
  const total = subtotal + deliveryFee;

  const handleContinueToCheckout = () => {
    if (!menuData?.settings.checkout_whatsapp_enabled && !menuData?.settings.checkout_web_enabled) {
      return;
    }

    if (menuData.settings.checkout_web_enabled) {
      navigate(`/menu/${slug}/checkout`);
    } else {
      // WhatsApp checkout
      const message = formatWhatsAppMessage();
      const phone = menuData.restaurant.phone.replace(/\D/g, '');
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  const formatWhatsAppMessage = () => {
    if (!menuData) return '';

    const itemsList = items
      .map((item) => {
        const addonsText = item.selectedAddons.length > 0
          ? `\n  + ${item.selectedAddons.map((a) => a.name).join(', ')}`
          : '';
        const notesText = item.notes ? `\n  Obs: ${item.notes}` : '';
        return `• ${item.quantity}x ${item.product.name} - ${formatPrice(item.totalPrice)}${addonsText}${notesText}`;
      })
      .join('\n');

    return `🍕 *Novo Pedido - ${menuData.restaurant.name}*

📋 *Itens:*
${itemsList}

💰 *Subtotal:* ${formatPrice(subtotal)}
🚚 *Taxa de Entrega:* ${formatPrice(deliveryFee)}
💵 *Total:* ${formatPrice(total)}

Gostaria de finalizar o pedido! 😊`;
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <ShoppingBag className="w-24 h-24 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Carrinho vazio</h2>
        <p className="text-muted-foreground mb-6 text-center">
          Adicione produtos ao carrinho para continuar
        </p>
        <Button onClick={() => navigate(`/menu/${slug}`)} className="bg-orange hover:bg-orange/90">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Menu
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/menu/${slug}`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-xl font-bold">Carrinho</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-4 mb-6">
          {items.map((item, index) => (
            <Card key={`${item.product.id}-${index}`} className="p-4">
              <div className="flex gap-4">
                {item.product.image_url && (
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                )}
                
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">
                    {item.product.name}
                  </h3>
                  
                  {item.selectedAddons.length > 0 && (
                    <p className="text-sm text-muted-foreground mb-1">
                      + {item.selectedAddons.map((a) => a.name).join(', ')}
                    </p>
                  )}
                  
                  {item.notes && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Obs: {item.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateItemQuantity(
                            item.product.id,
                            item.selectedAddons.map((a) => a.id),
                            item.quantity - 1
                          )
                        }
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="font-semibold w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateItemQuantity(
                            item.product.id,
                            item.selectedAddons.map((a) => a.id),
                            item.quantity + 1
                          )
                        }
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-primary">
                        {formatPrice(item.totalPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive self-start"
                  onClick={() =>
                    removeItem(item.product.id, item.selectedAddons.map((a) => a.id))
                  }
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6 sticky bottom-4">
          <div className="space-y-3">
            <div className="flex justify-between text-foreground">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            
            <div className="flex justify-between text-foreground">
              <span>Taxa de Entrega</span>
              <span>{formatPrice(deliveryFee)}</span>
            </div>

            <Separator />

            <div className="flex justify-between text-xl font-bold text-foreground">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>

            <Button
              onClick={handleContinueToCheckout}
              className="w-full bg-orange hover:bg-orange/90"
              size="lg"
            >
              {menuData?.settings.checkout_web_enabled
                ? 'Finalizar Pedido'
                : 'Continuar no WhatsApp'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

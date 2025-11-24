import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePublicCartStore } from '@/stores/publicCartStore';
import { usePublicMenuStore } from '@/stores/publicMenuStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function PublicCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { items, getSubtotal, clearCart } = usePublicCartStore();
  const { menuData } = usePublicMenuStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    delivery_address: '',
    delivery_instructions: '',
    payment_method: 'cash' as 'cash' | 'card' | 'pix' | 'mbway' | 'multibanco',
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const subtotal = getSubtotal();
  const deliveryFee = menuData?.restaurant.delivery_fee || 0;
  const total = subtotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!menuData || items.length === 0) return;

    setLoading(true);

    try {
      // 1. Criar cart
      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .insert({
          restaurant_id: menuData.restaurant.id,
          user_phone: formData.customer_phone,
          status: 'active',
        })
        .select()
        .single();

      if (cartError || !cart) throw new Error('Erro ao criar carrinho');

      // 2. Criar cart_items
      const cartItems = items.map((item) => ({
        cart_id: cart.id,
        product_id: item.product.id,
        quantity: item.quantity,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('cart_items')
        .insert(cartItems);

      if (itemsError) throw new Error('Erro ao adicionar items ao carrinho');

      // 3. Criar web_order
      const { data: webOrder, error: orderError } = await supabase
        .from('web_orders')
        .insert({
          restaurant_id: menuData.restaurant.id,
          cart_id: cart.id,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_email: formData.customer_email || null,
          delivery_address: formData.delivery_address,
          delivery_instructions: formData.delivery_instructions || null,
          items: items.map((item) => ({
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: item.quantity,
            unit_price: item.product.price,
            addons: item.selectedAddons.map((a) => ({
              id: a.id,
              name: a.name,
              price: a.price,
            })),
            notes: item.notes,
            total: item.totalPrice,
          })),
          subtotal,
          delivery_fee: deliveryFee,
          total_amount: total,
          payment_method: formData.payment_method,
          source: 'web',
        })
        .select()
        .single();

      if (orderError || !webOrder) throw new Error('Erro ao criar pedido');

      // Limpar carrinho
      clearCart();

      toast({
        title: 'Pedido realizado com sucesso!',
        description: 'Você receberá uma confirmação em breve.',
      });

      navigate(`/menu/${slug}/order-confirmed/${webOrder.id}`);
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      toast({
        title: 'Erro ao criar pedido',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    navigate(`/menu/${slug}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/menu/${slug}/cart`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-xl font-bold">Finalizar Pedido</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Dados de Contato</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  required
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Seu nome"
                />
              </div>

              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  placeholder="+351 900 000 000"
                />
              </div>

              <div>
                <Label htmlFor="email">Email (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  placeholder="seu@email.com"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Endereço de Entrega</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="address">Endereço *</Label>
                <Input
                  id="address"
                  required
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  placeholder="Rua, número, complemento"
                />
              </div>

              <div>
                <Label htmlFor="instructions">Instruções de entrega</Label>
                <Textarea
                  id="instructions"
                  value={formData.delivery_instructions}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_instructions: e.target.value })
                  }
                  placeholder="Apartamento, andar, ponto de referência..."
                  rows={3}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Forma de Pagamento</h2>
            
            <RadioGroup
              value={formData.payment_method}
              onValueChange={(value: any) => setFormData({ ...formData, payment_method: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="cursor-pointer">Dinheiro</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="cursor-pointer">Cartão na entrega</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mbway" id="mbway" />
                <Label htmlFor="mbway" className="cursor-pointer">MBWay</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="multibanco" id="multibanco" />
                <Label htmlFor="multibanco" className="cursor-pointer">Multibanco</Label>
              </div>
            </RadioGroup>
          </Card>

          <Card className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between text-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              
              <div className="flex justify-between text-foreground">
                <span>Taxa de Entrega</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>

              <div className="flex justify-between text-xl font-bold text-foreground pt-3 border-t">
                <span>Total</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
            </div>
          </Card>

          <Button
            type="submit"
            className="w-full bg-orange hover:bg-orange/90"
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              `Confirmar Pedido · ${formatPrice(total)}`
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

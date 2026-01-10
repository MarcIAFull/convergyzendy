import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePublicCartStore } from '@/stores/publicCartStore';
import { usePublicMenuStore } from '@/stores/publicMenuStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Loader2, AlertCircle, Clock, MapPin as MapPinIcon, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AddressInput } from '@/components/delivery/AddressInput';
import { useGeocoding } from '@/hooks/useGeocoding';
import { useGoogleMapsApiKey } from '@/hooks/useGoogleMapsApiKey';
import { DeliveryZoneMap } from '@/components/delivery/DeliveryZoneMap';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CouponInput, AppliedCoupon } from '@/components/public/CouponInput';
import { Badge } from '@/components/ui/badge';

export default function PublicCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { items, getSubtotal, clearCart } = usePublicCartStore();
  const { menuData } = usePublicMenuStore();
  const { toast } = useToast();
  const { apiKey } = useGoogleMapsApiKey();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    delivery_address: '',
    delivery_instructions: '',
    payment_method: 'cash' as 'cash' | 'card' | 'mbway' | 'multibanco' | 'stripe',
  });
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryValidation, setDeliveryValidation] = useState<any>(null);
  const [validatingDelivery, setValidatingDelivery] = useState(false);
  const { validateDeliveryAddress } = useGeocoding();
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);

  // Check if Stripe is enabled for this restaurant
  useEffect(() => {
    const checkStripeStatus = async () => {
      if (!menuData?.restaurant?.id) return;
      
      const { data } = await supabase
        .from('restaurant_settings')
        .select('online_payments_enabled, stripe_charges_enabled')
        .eq('restaurant_id', menuData.restaurant.id)
        .single();
      
      setStripeEnabled(data?.online_payments_enabled && data?.stripe_charges_enabled);
    };
    
    checkStripeStatus();
  }, [menuData?.restaurant?.id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const handleAddressGeocoded = async (result: { lat: number; lng: number; formatted_address: string }) => {
    setAddressCoords({ lat: result.lat, lng: result.lng });
    setFormData(prev => ({ ...prev, delivery_address: result.formatted_address }));

    if (menuData?.restaurant) {
      setValidatingDelivery(true);
      const subtotal = getSubtotal();
      const validation = await validateDeliveryAddress(
        menuData.restaurant.id,
        result.lat,
        result.lng,
        subtotal
      );
      setValidatingDelivery(false);

      if (validation) {
        setDeliveryValidation(validation);
        if (!validation.valid) {
          toast({
            title: 'Endereço inválido',
            description: validation.error || 'Endereço fora da área de entrega',
            variant: 'destructive'
          });
        }
      }
    }
  };

  const subtotal = getSubtotal();
  const deliveryFee = menuData?.restaurant.delivery_fee || 0;
  const calculatedDeliveryFee = deliveryValidation?.delivery_fee ?? deliveryFee;
  const discount = appliedCoupon?.discount_amount || 0;
  const total = subtotal + calculatedDeliveryFee - discount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!menuData || items.length === 0) return;

    setLoading(true);

    try {
      // Create cart
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

      // Add cart items
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

      // Create web order
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
          delivery_lat: addressCoords?.lat || null,
          delivery_lng: addressCoords?.lng || null,
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
          delivery_fee: calculatedDeliveryFee,
          discount_amount: discount,
          coupon_id: appliedCoupon?.id || null,
          coupon_code: appliedCoupon?.code || null,
          total_amount: total,
          payment_method: formData.payment_method,
          payment_status: formData.payment_method === 'stripe' ? 'pending' : 'pending_delivery',
          source: 'web',
        })
        .select()
        .single();

      if (orderError || !webOrder) throw new Error('Erro ao criar pedido');

      // If Stripe payment, redirect to checkout
      if (formData.payment_method === 'stripe') {
        try {
          const response = await fetch(
            'https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/create-payment-session',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                web_order_id: webOrder.id,
                success_url: `${window.location.origin}/menu/${slug}/order-confirmed/${webOrder.id}`,
                cancel_url: `${window.location.origin}/menu/${slug}/checkout?cancelled=true`,
              }),
            }
          );

          const sessionData = await response.json();

          if (sessionData.checkout_url) {
            // Redirect to Stripe Checkout
            window.location.href = sessionData.checkout_url;
            return;
          } else {
            throw new Error(sessionData.error || 'Erro ao criar sessão de pagamento');
          }
        } catch (stripeError) {
          console.error('[Checkout] Stripe error:', stripeError);
          // Delete the order since payment failed
          await supabase.from('web_orders').delete().eq('id', webOrder.id);
          throw new Error('Erro ao processar pagamento online. Tente outro método.');
        }
      }

      // For non-Stripe payments, notify restaurant and redirect
      console.log('[Checkout] Order created, sending WhatsApp notification...', webOrder.id);
      
      try {
        const notifyResponse = await fetch(
          'https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/notify-web-order',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              order_id: webOrder.id,
              restaurant_id: menuData.restaurant.id 
            }),
          }
        );
        
        const notifyResult = await notifyResponse.json();
        console.log('[Checkout] WhatsApp notification result:', notifyResult);
        
        if (!notifyResponse.ok) {
          console.error('[Checkout] WhatsApp notification failed:', notifyResult);
        }
      } catch (notifyError) {
        console.error('[Checkout] Failed to send WhatsApp notification:', notifyError);
      }

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
              <AddressInput
                value={formData.delivery_address}
                onChange={(value) => setFormData({ ...formData, delivery_address: value })}
                onGeocoded={handleAddressGeocoded}
                required
              />

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

            {validatingDelivery && (
              <Alert className="mt-4">
                <AlertDescription className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  Validando endereço de entrega...
                </AlertDescription>
              </Alert>
            )}

            {deliveryValidation && !deliveryValidation.valid && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {deliveryValidation.error}
                </AlertDescription>
              </Alert>
            )}

            {deliveryValidation && deliveryValidation.valid && (
              <Alert className="mt-4 border-green-500 bg-green-50">
                <AlertDescription className="space-y-2">
                  <div className="flex items-center gap-2 text-green-700">
                    <MapPinIcon className="h-4 w-4" />
                    <span className="font-medium">Endereço dentro da área de entrega</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-green-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Entrega em ~{deliveryValidation.estimated_time_minutes} min</span>
                    </div>
                    <span>•</span>
                    <span>Distância: {deliveryValidation.distance_km.toFixed(1)} km</span>
                    {deliveryValidation.zone && (
                      <>
                        <span>•</span>
                        <span>Zona: {deliveryValidation.zone.name}</span>
                      </>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {addressCoords && menuData?.restaurant.latitude && menuData?.restaurant.longitude && apiKey && (
              <div className="mt-4">
                <DeliveryZoneMap
                  center={[menuData.restaurant.latitude, menuData.restaurant.longitude]}
                  deliveryAddress={addressCoords}
                  height="300px"
                  apiKey={apiKey}
                />
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Forma de Pagamento</h2>
            
            <RadioGroup
              value={formData.payment_method}
              onValueChange={(value: any) => setFormData({ ...formData, payment_method: value })}
            >
              {stripeEnabled && (
                <div className="flex items-center space-x-2 p-3 border rounded-lg bg-primary/5 border-primary/20">
                  <RadioGroupItem value="stripe" id="stripe" />
                  <Label htmlFor="stripe" className="cursor-pointer flex items-center gap-2 flex-1">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span>Pagar Online</span>
                    <Badge variant="secondary" className="ml-auto">Recomendado</Badge>
                  </Label>
                </div>
              )}
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

          {/* Coupon Section */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Cupom de Desconto</h2>
            
            {menuData?.restaurant?.id && (
              <CouponInput
                restaurantId={menuData.restaurant.id}
                customerPhone={formData.customer_phone}
                subtotal={subtotal}
                onCouponApplied={setAppliedCoupon}
                appliedCoupon={appliedCoupon}
              />
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Resumo do Pedido</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between text-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              
              <div className="flex justify-between text-foreground">
                <span>Taxa de Entrega</span>
                <span>{formatPrice(calculatedDeliveryFee)}</span>
              </div>

              {appliedCoupon && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto ({appliedCoupon.code})</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}

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
            disabled={loading || (deliveryValidation && !deliveryValidation.valid) || validatingDelivery}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : validatingDelivery ? (
              'Validando endereço...'
            ) : formData.payment_method === 'stripe' ? (
              `Pagar Online · ${formatPrice(total)}`
            ) : (
              `Confirmar Pedido · ${formatPrice(total)}`
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

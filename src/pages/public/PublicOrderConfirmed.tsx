import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { WebOrder } from '@/types/public-menu';

export default function PublicOrderConfirmed() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<WebOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('web_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <p className="text-muted-foreground">Pedido não encontrado</p>
          <Button
            onClick={() => navigate(`/menu/${slug}`)}
            className="mt-4 bg-orange hover:bg-orange/90"
          >
            Voltar ao Menu
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <CheckCircle2 className="w-20 h-20 text-success mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Pedido Confirmado!</h1>
          <p className="text-muted-foreground">
            Seu pedido foi recebido e está sendo preparado
          </p>
        </div>

        <div className="bg-muted rounded-lg p-4 mb-6 text-left">
          <div className="flex justify-between mb-2">
            <span className="text-muted-foreground">Pedido</span>
            <span className="font-mono font-bold">#{order.id.slice(0, 8)}</span>
          </div>
          
          <div className="flex justify-between mb-2">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-semibold">{order.customer_name}</span>
          </div>

          <div className="flex justify-between mb-2">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold text-primary text-lg">
              {formatPrice(order.total_amount)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Pagamento</span>
            <span className="capitalize">{order.payment_method}</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Você receberá atualizações sobre seu pedido em breve
          </p>

          <Button
            onClick={() => navigate(`/menu/${slug}`)}
            className="w-full bg-orange hover:bg-orange/90"
          >
            Fazer Novo Pedido
          </Button>
        </div>
      </Card>
    </div>
  );
}

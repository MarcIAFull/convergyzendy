import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Onboarding = () => {
  const { user } = useAuth();
  const { fetchRestaurant } = useRestaurantStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Restaurant form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Você precisa estar autenticado');
      navigate('/login');
      return;
    }

    setLoading(true);

    try {
      // Create restaurant
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name,
          phone,
          address,
          delivery_fee: 0,
          is_open: true,
        })
        .select()
        .single();

      if (restaurantError) throw restaurantError;

      // Create restaurant owner mapping
      const { error: ownerError } = await supabase
        .from('restaurant_owners')
        .insert({
          user_id: user.id,
          restaurant_id: restaurant.id,
          role: 'owner',
        });

      if (ownerError) throw ownerError;

      toast.success('Restaurante criado com sucesso!');
      
      // Refresh restaurant data
      await fetchRestaurant();
      
      // Navigate to dashboard
      navigate('/');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error(error.message || 'Erro ao criar restaurante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Bem-vindo ao Zendy!</CardTitle>
          <CardDescription>
            Vamos configurar seu restaurante em alguns passos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Restaurante *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ex: Pizzaria do João"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone WhatsApp *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Ex: 5511999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Formato: código do país + DDD + número (sem espaços ou caracteres especiais)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço *</Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="Ex: Rua Principal, 123 - Centro"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/login')}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Restaurante
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;

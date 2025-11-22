import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Store } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const restaurantSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  phone: z.string()
    .trim()
    .regex(/^[0-9]{10,15}$/, 'Telefone inválido. Use apenas números (ex: 5511999999999)'),
  address: z.string()
    .trim()
    .min(5, 'Endereço deve ter pelo menos 5 caracteres')
    .max(200, 'Endereço deve ter no máximo 200 caracteres'),
  deliveryFee: z.number()
    .min(0, 'Taxa de entrega não pode ser negativa')
    .max(100, 'Taxa de entrega muito alta'),
});

type RestaurantFormData = z.infer<typeof restaurantSchema>;

interface RestaurantInfoStepProps {
  onComplete: (data: RestaurantFormData) => Promise<void>;
}

const RestaurantInfoStep = ({ onComplete }: RestaurantInfoStepProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      deliveryFee: 0,
    },
  });

  const onSubmit = async (data: RestaurantFormData) => {
    setError(null);
    setLoading(true);

    try {
      await onComplete(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar restaurante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Store className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Informações do Restaurante</h3>
          <p className="text-sm text-muted-foreground">
            Dados básicos do seu estabelecimento
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Restaurante *</Label>
          <Input
            id="name"
            placeholder="Ex: Pizzaria do João"
            {...register('name')}
            disabled={loading}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone WhatsApp *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="5511999999999"
            {...register('phone')}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Formato: código do país + DDD + número (sem espaços ou caracteres especiais)
          </p>
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Endereço *</Label>
          <Input
            id="address"
            placeholder="Rua Principal, 123 - Centro"
            {...register('address')}
            disabled={loading}
          />
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="deliveryFee">Taxa de Entrega (R$)</Label>
          <Input
            id="deliveryFee"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register('deliveryFee', { valueAsNumber: true })}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Deixe 0 se a entrega for grátis
          </p>
          {errors.deliveryFee && (
            <p className="text-sm text-destructive">{errors.deliveryFee.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={loading} className="min-w-32">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continuar
        </Button>
      </div>
    </form>
  );
};

export default RestaurantInfoStep;

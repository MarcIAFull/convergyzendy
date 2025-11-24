import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Store, Clock, DollarSign, Loader2 } from 'lucide-react';
import type { OpeningHours } from '@/types/database';

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const dayHoursSchema = z.object({
  open: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  close: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  closed: z.boolean().optional(),
});

const restaurantSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Restaurant name is required').max(100, 'Name too long'),
  phone: z.string().trim().min(9, 'Phone number must be at least 9 characters').max(20, 'Phone number too long'),
  address: z.string().trim().min(5, 'Address is required').max(200, 'Address too long'),
  delivery_fee: z.coerce.number().min(0, 'Delivery fee must be positive').max(100, 'Delivery fee too high'),
  opening_hours: z.object({
    monday: dayHoursSchema,
    tuesday: dayHoursSchema,
    wednesday: dayHoursSchema,
    thursday: dayHoursSchema,
    friday: dayHoursSchema,
    saturday: dayHoursSchema,
    sunday: dayHoursSchema,
  }),
});

type RestaurantSettingsFormValues = z.infer<typeof restaurantSettingsSchema>;

const daysOfWeek = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

export function RestaurantTab() {
  const { restaurant, loading, updateRestaurant } = useRestaurantStore();
  const { toast } = useToast();

  const form = useForm<RestaurantSettingsFormValues>({
    resolver: zodResolver(restaurantSettingsSchema),
    defaultValues: {
      name: '',
      phone: '',
      address: '',
      delivery_fee: 0,
      opening_hours: {
        monday: { open: '09:00', close: '22:00', closed: false },
        tuesday: { open: '09:00', close: '22:00', closed: false },
        wednesday: { open: '09:00', close: '22:00', closed: false },
        thursday: { open: '09:00', close: '22:00', closed: false },
        friday: { open: '09:00', close: '22:00', closed: false },
        saturday: { open: '09:00', close: '22:00', closed: false },
        sunday: { open: '09:00', close: '22:00', closed: false },
      },
    },
  });

  useEffect(() => {
    if (restaurant) {
      form.reset({
        name: restaurant.name,
        phone: restaurant.phone,
        address: restaurant.address,
        delivery_fee: Number(restaurant.delivery_fee),
        opening_hours: restaurant.opening_hours as OpeningHours,
      });
    }
  }, [restaurant, form]);

  const onSubmit = async (values: RestaurantSettingsFormValues) => {
    try {
      await updateRestaurant({
        name: values.name,
        phone: values.phone,
        address: values.address,
        delivery_fee: values.delivery_fee,
        opening_hours: values.opening_hours as any,
      });

      toast({
        title: "Configurações salvas",
        description: "As informações do restaurante foram atualizadas.",
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
            <CardDescription>
              Dados principais do seu restaurante
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Restaurante</FormLabel>
                  <FormControl>
                    <Input placeholder="Meu Restaurante" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="+351 912 345 678" {...field} />
                  </FormControl>
                  <FormDescription>
                    Incluir código do país para integração WhatsApp
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Morada</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua Example, 123, Lisboa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="delivery_fee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Taxa de Entrega (€)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="3.50"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Taxa fixa adicionada a todos os pedidos
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horários de Funcionamento
            </CardTitle>
            <CardDescription>
              Configure os horários de abertura para cada dia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {daysOfWeek.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label className="text-base font-medium">{label}</Label>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`opening_hours.${key}.open`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Abertura</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            disabled={form.watch(`opening_hours.${key}.closed`)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`opening_hours.${key}.close`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecho</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            disabled={form.watch(`opening_hours.${key}.closed`)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {key !== 'sunday' && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={loading}
          >
            Resetar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Alterações
          </Button>
        </div>
      </form>
    </Form>
  );
}

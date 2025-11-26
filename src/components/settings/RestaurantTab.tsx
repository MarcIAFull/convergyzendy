import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useGeocoding } from '@/hooks/useGeocoding';
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
import { Store, Clock, DollarSign, Loader2, MapPin } from 'lucide-react';
import type { OpeningHours } from '@/types/database';

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const dayHoursSchema = z.object({
  open: z.string(),
  close: z.string(),
  closed: z.boolean().optional(),
}).refine((data) => {
  // If the day is closed, don't validate time formats
  if (data.closed) return true;
  // If not closed, validate HH:MM format
  return timeRegex.test(data.open) && timeRegex.test(data.close);
}, {
  message: 'Invalid time format (HH:MM)',
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
  const { geocodeAddress, loading: geocodingLoading } = useGeocoding();
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
      const openingHours = restaurant.opening_hours as OpeningHours;
      
      // Normalize hours - ensure default values for closed days
      const normalizedHours: OpeningHours = {
        monday: {
          open: openingHours.monday?.open || '09:00',
          close: openingHours.monday?.close || '22:00',
          closed: openingHours.monday?.closed || false,
        },
        tuesday: {
          open: openingHours.tuesday?.open || '09:00',
          close: openingHours.tuesday?.close || '22:00',
          closed: openingHours.tuesday?.closed || false,
        },
        wednesday: {
          open: openingHours.wednesday?.open || '09:00',
          close: openingHours.wednesday?.close || '22:00',
          closed: openingHours.wednesday?.closed || false,
        },
        thursday: {
          open: openingHours.thursday?.open || '09:00',
          close: openingHours.thursday?.close || '22:00',
          closed: openingHours.thursday?.closed || false,
        },
        friday: {
          open: openingHours.friday?.open || '09:00',
          close: openingHours.friday?.close || '22:00',
          closed: openingHours.friday?.closed || false,
        },
        saturday: {
          open: openingHours.saturday?.open || '09:00',
          close: openingHours.saturday?.close || '22:00',
          closed: openingHours.saturday?.closed || false,
        },
        sunday: {
          open: openingHours.sunday?.open || '09:00',
          close: openingHours.sunday?.close || '22:00',
          closed: openingHours.sunday?.closed || false,
        },
      };
      
      form.reset({
        name: restaurant.name,
        phone: restaurant.phone,
        address: restaurant.address,
        delivery_fee: Number(restaurant.delivery_fee),
        opening_hours: normalizedHours,
      });
    }
  }, [restaurant, form]);

  const onSubmit = async (values: RestaurantSettingsFormValues) => {
    console.log('[RestaurantTab] Submitting values:', values);
    try {
      // Geocode address if it changed
      let latitude = restaurant?.latitude;
      let longitude = restaurant?.longitude;

      if (values.address !== restaurant?.address) {
        console.log('[RestaurantTab] Address changed, geocoding...');
        toast({
          title: "A geocodificar endereço...",
          description: "Por favor aguarde.",
        });

        const geoResult = await geocodeAddress(values.address);
        
        if (geoResult) {
          latitude = geoResult.lat;
          longitude = geoResult.lng;
          console.log('[RestaurantTab] Geocoding successful:', { latitude, longitude });
          toast({
            title: "Endereço geocodificado!",
            description: `Localização encontrada com precisão: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          });
        } else {
          console.warn('[RestaurantTab] Geocoding failed, saving without coordinates');
          toast({
            title: "Aviso",
            description: "Não foi possível geocodificar automaticamente. Use código postal + cidade para melhores resultados.",
            variant: "destructive",
          });
        }
      }

      await updateRestaurant({
        name: values.name,
        phone: values.phone,
        address: values.address,
        delivery_fee: values.delivery_fee,
        opening_hours: values.opening_hours as any,
        latitude,
        longitude,
      });

      if (latitude && longitude) {
        toast({
          title: "Configurações salvas",
          description: "Endereço geocodificado com sucesso! As zonas de entrega serão atualizadas.",
        });
      } else {
        toast({
          title: "Configurações salvas",
          description: values.address !== restaurant?.address 
            ? "Não foi possível geocodificar o endereço automaticamente."
            : "As informações foram atualizadas.",
        });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      // Detect session expiration
      if (errorMessage.includes('Sessão expirada') || errorMessage.includes('Invalid Refresh Token')) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente para continuar.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao salvar",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
        console.error('[RestaurantTab] Validation errors:', errors);
        toast({
          title: "Erro de validação",
          description: "Verifique os campos do formulário",
          variant: "destructive",
        });
      })} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Editando: {restaurant?.name || 'Carregando...'}
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
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Morada
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Rua das Flores 123, 8125-248 Quarteira" {...field} />
                  </FormControl>
                  <FormDescription>
                    <span className="font-medium">Importante:</span> Para geocodificação precisa, inclua código postal e cidade
                    <br />
                    <span className="text-xs text-muted-foreground">
                      Exemplo: Rua das Flores 123, 8125-248 Quarteira
                    </span>
                  </FormDescription>
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
          <Button type="submit" disabled={loading || geocodingLoading}>
            {(loading || geocodingLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Alterações
          </Button>
        </div>
      </form>
    </Form>
  );
}

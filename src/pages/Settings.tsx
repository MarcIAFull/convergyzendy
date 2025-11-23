import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
import { Store, Clock, DollarSign, Bot, Loader2 } from 'lucide-react';
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
  is_open: z.boolean(),
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
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

const Settings = () => {
  const { restaurant, loading, fetchRestaurant, createRestaurant, updateRestaurant } = useRestaurantStore();
  const { toast } = useToast();

  const form = useForm<RestaurantSettingsFormValues>({
    resolver: zodResolver(restaurantSettingsSchema),
    defaultValues: {
      name: '',
      phone: '',
      address: '',
      delivery_fee: 0,
      is_open: true,
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
        is_open: restaurant.is_open,
        opening_hours: restaurant.opening_hours as OpeningHours,
      });
    }
  }, [restaurant, form]);

  const onSubmit = async (values: RestaurantSettingsFormValues) => {
    console.log('[Settings] Form submitted:', { hasRestaurant: !!restaurant, values });
    
    try {
      if (restaurant) {
        // Update existing restaurant
        console.log('[Settings] Updating existing restaurant:', restaurant.id);
        await updateRestaurant({
          name: values.name,
          phone: values.phone,
          address: values.address,
          delivery_fee: values.delivery_fee,
          is_open: values.is_open,
          opening_hours: values.opening_hours as any,
        });
        
        console.log('[Settings] Restaurant updated successfully');
        toast({
          title: "Settings saved",
          description: "Your restaurant settings have been updated successfully.",
        });
      } else {
        // Create new restaurant
        console.log('[Settings] Creating new restaurant');
        await createRestaurant({
          name: values.name,
          phone: values.phone,
          address: values.address,
          delivery_fee: values.delivery_fee,
          is_open: values.is_open,
          opening_hours: values.opening_hours as any,
        });
        
        console.log('[Settings] Restaurant created successfully, reloading...');
        toast({
          title: "Restaurant created",
          description: "Your restaurant has been created successfully.",
        });
        
        // Reload restaurant data after creation
        await fetchRestaurant();
      }
    } catch (error) {
      console.error('[Settings] Failed to save settings:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save settings";
      toast({
        title: "Error saving settings",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (loading && !restaurant) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Restaurant Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your restaurant information and opening hours
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Update your restaurant's basic details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restaurant Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Restaurant" {...field} />
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
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+351 912 345 678" {...field} />
                    </FormControl>
                    <FormDescription>
                      Include country code for WhatsApp integration
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
                    <FormLabel>Address</FormLabel>
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
                      Delivery Fee (€)
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
                      Fixed delivery fee added to all orders
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Opening Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Opening Hours
              </CardTitle>
              <CardDescription>
                Set your restaurant's operating hours for each day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {daysOfWeek.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">{label}</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`opening_hours.${key}.open`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Opening Time</FormLabel>
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
                          <FormLabel>Closing Time</FormLabel>
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

          {/* AI Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Ordering Agent
              </CardTitle>
              <CardDescription>
                Enable or disable the AI-powered WhatsApp ordering system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="is_open"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Activate AI Agent</FormLabel>
                      <FormDescription>
                        When enabled, customers can place orders via WhatsApp
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={loading}
            >
              Reset
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default Settings;

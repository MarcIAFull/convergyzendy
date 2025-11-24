import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTenantStore } from '@/stores/tenantStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type TenantSettings = Tables<'tenant_settings'>;

interface TenantSettingsFormProps {
  settings: TenantSettings | null;
  restaurantId: string;
}

const TenantSettingsForm = ({ settings, restaurantId }: TenantSettingsFormProps) => {
  const { updateSettings, createSettings, loading } = useTenantStore();
  
  const form = useForm({
    defaultValues: {
      locale: settings?.locale || 'pt-PT',
      currency: settings?.currency || 'EUR',
      timezone: settings?.timezone || 'Europe/Lisbon',
      primary_color: settings?.primary_color || '#000000',
      custom_logo_url: settings?.custom_logo_url || '',
      custom_favicon_url: settings?.custom_favicon_url || '',
      email_from_name: settings?.email_from_name || '',
      email_reply_to: settings?.email_reply_to || '',
      sms_sender_name: settings?.sms_sender_name || '',
      custom_css: settings?.custom_css || '',
      subdomain: settings?.subdomain || '',
      custom_domain: settings?.custom_domain || '',
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        locale: settings.locale || 'pt-PT',
        currency: settings.currency || 'EUR',
        timezone: settings.timezone || 'Europe/Lisbon',
        primary_color: settings.primary_color || '#000000',
        custom_logo_url: settings.custom_logo_url || '',
        custom_favicon_url: settings.custom_favicon_url || '',
        email_from_name: settings.email_from_name || '',
        email_reply_to: settings.email_reply_to || '',
        sms_sender_name: settings.sms_sender_name || '',
        custom_css: settings.custom_css || '',
        subdomain: settings.subdomain || '',
        custom_domain: settings.custom_domain || '',
      });
    }
  }, [settings, form]);

  const onSubmit = async (values: any) => {
    try {
      if (settings) {
        await updateSettings(settings.id, values);
        toast.success('Configurações atualizadas com sucesso');
      } else {
        await createSettings({ ...values, restaurant_id: restaurantId });
        toast.success('Configurações criadas com sucesso');
      }
    } catch (error) {
      toast.error('Erro ao guardar configurações');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Localização e Região</CardTitle>
            <CardDescription>Configurações de idioma, moeda e fuso horário</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="locale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Idioma</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pt-PT">Português (Portugal)</SelectItem>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moeda</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="BRL">BRL (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fuso Horário</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Europe/Lisbon">Europe/Lisbon (WET)</SelectItem>
                      <SelectItem value="America/Sao_Paulo">America/Sao_Paulo (BRT)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personalização</CardTitle>
            <CardDescription>Marca e aparência visual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="primary_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor Primária</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input type="color" {...field} className="w-20 h-10" />
                      <Input {...field} placeholder="#000000" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="custom_logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Logotipo</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="custom_favicon_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Favicon</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="custom_css"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CSS Personalizado</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={6} className="font-mono text-sm" />
                  </FormControl>
                  <FormDescription>CSS adicional para personalização avançada</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comunicação</CardTitle>
            <CardDescription>Configurações de email e SMS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email_from_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Remetente (Email)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Meu Restaurante" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email_reply_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email de Resposta</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="contato@restaurante.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sms_sender_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Remetente (SMS)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="RestauranteXYZ" maxLength={11} />
                  </FormControl>
                  <FormDescription>Máximo 11 caracteres</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domínio</CardTitle>
            <CardDescription>Configuração de domínio personalizado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="subdomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subdomínio</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input {...field} placeholder="meu-restaurante" />
                      <span className="text-muted-foreground">.app.com</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="custom_domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domínio Personalizado</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="pedidos.meurestaurante.com" />
                  </FormControl>
                  <FormDescription>
                    Requer configuração de DNS
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? 'A guardar...' : 'Guardar Configurações'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default TenantSettingsForm;

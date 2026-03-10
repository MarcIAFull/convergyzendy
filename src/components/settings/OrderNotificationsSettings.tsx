import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { Loader2, Save, Bell, BellOff, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface NotificationConfig {
  enabled: boolean;
  message: string;
}

type NotificationsMap = Record<string, NotificationConfig>;

const STATUS_LABELS: Record<string, { label: string; emoji: string; description: string; isTemplate?: boolean }> = {
  new_order_restaurant: {
    label: 'Novo Pedido (Restaurante)',
    emoji: '🛒',
    description: 'Mensagem enviada ao restaurante quando um novo pedido web é criado',
    isTemplate: false,
  },
  new_order_customer: {
    label: 'Confirmação (Cliente)',
    emoji: '✅',
    description: 'Mensagem de confirmação enviada ao cliente após o pedido',
    isTemplate: false,
  },
  preparing: {
    label: 'Em Preparação',
    emoji: '👨‍🍳',
    description: 'Quando o pedido começa a ser preparado',
  },
  out_for_delivery: {
    label: 'Saiu para Entrega',
    emoji: '🚚',
    description: 'Quando o pedido sai para entrega',
  },
  completed: {
    label: 'Concluído / Entregue',
    emoji: '🎉',
    description: 'Quando o pedido é marcado como concluído',
  },
  cancelled: {
    label: 'Cancelado',
    emoji: '❌',
    description: 'Quando o pedido é cancelado',
  },
};

const DEFAULT_NOTIFICATIONS: NotificationsMap = {
  new_order_restaurant: { enabled: true, message: '(Mensagem automática com detalhes do pedido — não editável)' },
  new_order_customer: { enabled: true, message: '(Mensagem automática de confirmação — não editável)' },
  preparing: { enabled: true, message: '👨‍🍳 Olá {{customer_name}}! Seu pedido *#{{order_id}}* está sendo preparado! ⏳' },
  out_for_delivery: { enabled: true, message: '🚚 {{customer_name}}, seu pedido *#{{order_id}}* saiu para entrega! 📍' },
  completed: { enabled: true, message: '🎉 {{customer_name}}, seu pedido *#{{order_id}}* foi entregue! Obrigado! ❤️' },
  cancelled: { enabled: true, message: '❌ {{customer_name}}, seu pedido *#{{order_id}}* foi cancelado. Entre em contato para mais informações.' },
};

const STATUS_ORDER = ['new_order_restaurant', 'new_order_customer', 'preparing', 'out_for_delivery', 'completed', 'cancelled'];

export function OrderNotificationsSettings() {
  const { toast } = useToast();
  const { restaurant } = useRestaurantStore();
  const [notifications, setNotifications] = useState<NotificationsMap>(DEFAULT_NOTIFICATIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurant?.id) return;
    fetchSettings();
  }, [restaurant?.id]);

  const fetchSettings = async () => {
    if (!restaurant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_ai_settings')
        .select('order_notifications')
        .eq('restaurant_id', restaurant.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.order_notifications) {
        // Merge with defaults to ensure all statuses exist
        const merged = { ...DEFAULT_NOTIFICATIONS };
        const saved = data.order_notifications as unknown as NotificationsMap;
        for (const key of STATUS_ORDER) {
          if (saved[key]) {
            merged[key] = saved[key];
          }
        }
        setNotifications(merged);
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (status: string, enabled: boolean) => {
    setNotifications(prev => ({
      ...prev,
      [status]: { ...prev[status], enabled },
    }));
  };

  const handleMessageChange = (status: string, message: string) => {
    setNotifications(prev => ({
      ...prev,
      [status]: { ...prev[status], message },
    }));
  };

  const handleSave = async () => {
    if (!restaurant?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurant_ai_settings')
        .update({ order_notifications: notifications as unknown as any })
        .eq('restaurant_id', restaurant.id);

      if (error) throw error;

      toast({
        title: '✅ Configurações salvas',
        description: 'As notificações de pedidos foram atualizadas.',
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setNotifications(DEFAULT_NOTIFICATIONS);
  };

  const renderPreview = (message: string) => {
    return message
      .replace(/\{\{customer_name\}\}/g, 'João')
      .replace(/\{\{order_id\}\}/g, 'A1B2C3D4');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações Automáticas de Pedidos
        </CardTitle>
        <CardDescription>
          Configure as mensagens enviadas automaticamente via WhatsApp quando o estado de um pedido muda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Variáveis disponíveis: <code className="bg-muted px-1 rounded text-xs">{'{{customer_name}}'}</code> e <code className="bg-muted px-1 rounded text-xs">{'{{order_id}}'}</code>
          </AlertDescription>
        </Alert>

        {STATUS_ORDER.map(status => {
          const config = notifications[status];
          const meta = STATUS_LABELS[status];
          return (
            <div key={status} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{meta.emoji}</span>
                  <div>
                    <h4 className="font-medium text-sm">{meta.label}</h4>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={config.enabled ? 'default' : 'secondary'} className="text-xs">
                    {config.enabled ? <Bell className="h-3 w-3 mr-1" /> : <BellOff className="h-3 w-3 mr-1" />}
                    {config.enabled ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) => handleToggle(status, checked)}
                  />
                </div>
              </div>

              {config.enabled && meta.isTemplate !== false && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea
                      value={config.message}
                      onChange={(e) => handleMessageChange(status, e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Pré-visualização:</p>
                    <p className="text-sm">{renderPreview(config.message)}</p>
                  </div>
                </>
              )}
              {config.enabled && meta.isTemplate === false && (
                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-xs text-muted-foreground">
                    Esta mensagem é gerada automaticamente com os detalhes do pedido (itens, total, endereço, etc.) e não pode ser editada.
                  </p>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={handleReset} size="sm">
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Info } from 'lucide-react';
import { RestaurantAISettings, TONE_OPTIONS, UPSELL_OPTIONS } from '@/types/restaurant-ai-settings';

export function AIPersonalizationTab() {
  const { restaurant } = useRestaurantStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<RestaurantAISettings | null>(null);

  useEffect(() => {
    if (restaurant?.id) {
      loadSettings();
    }
  }, [restaurant?.id]);

  const loadSettings = async () => {
    if (!restaurant?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurant_ai_settings')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as RestaurantAISettings);
      } else {
        const { data: newSettings, error: createError } = await supabase
          .from('restaurant_ai_settings')
          .insert({
            restaurant_id: restaurant.id,
            tone: 'friendly',
            upsell_aggressiveness: 'medium',
            max_additional_questions_before_checkout: 2,
            language: 'pt-BR'
          })
          .select()
          .single();

        if (createError) throw createError;
        setSettings(newSettings as RestaurantAISettings);
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar configurações de IA',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings || !restaurant?.id) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('restaurant_ai_settings')
        .update({
          tone: settings.tone,
          greeting_message: settings.greeting_message,
          closing_message: settings.closing_message,
          upsell_aggressiveness: settings.upsell_aggressiveness,
          max_additional_questions_before_checkout: settings.max_additional_questions_before_checkout,
          language: settings.language
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Configurações de IA atualizadas',
      });
    } catch (error) {
      console.error('Error saving AI settings:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao salvar configurações',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof RestaurantAISettings>(
    key: K,
    value: RestaurantAISettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Estas configurações personalizam como a IA interage com seus clientes. 
          As configurações técnicas dos agentes são geridas por administradores.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Personalidade do Assistente</CardTitle>
          <CardDescription>
            Defina como a IA se comunica com os seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tone">Tom de Voz</Label>
            <Select
              value={settings.tone}
              onValueChange={(value) => updateSetting('tone', value as any)}
            >
              <SelectTrigger id="tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="greeting">Mensagem de Saudação (Opcional)</Label>
            <Textarea
              id="greeting"
              placeholder="Olá! Bem-vindo ao nosso restaurante..."
              value={settings.greeting_message || ''}
              onChange={(e) => updateSetting('greeting_message', e.target.value || null)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Se vazio, a IA usará uma saudação baseada no tom de voz
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closing">Mensagem de Despedida (Opcional)</Label>
            <Textarea
              id="closing"
              placeholder="Obrigado pelo seu pedido! Até breve..."
              value={settings.closing_message || ''}
              onChange={(e) => updateSetting('closing_message', e.target.value || null)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Se vazio, a IA usará uma despedida baseada no tom de voz
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estratégia de Vendas</CardTitle>
          <CardDescription>
            Configure como a IA sugere produtos adicionais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="upsell">Agressividade de Upsell</Label>
            <Select
              value={settings.upsell_aggressiveness}
              onValueChange={(value) => updateSetting('upsell_aggressiveness', value as any)}
            >
              <SelectTrigger id="upsell">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPSELL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="max-questions">Máximo de Perguntas Antes do Checkout</Label>
              <span className="text-sm font-medium">{settings.max_additional_questions_before_checkout}</span>
            </div>
            <Slider
              id="max-questions"
              min={0}
              max={5}
              step={1}
              value={[settings.max_additional_questions_before_checkout]}
              onValueChange={([value]) => updateSetting('max_additional_questions_before_checkout', value)}
            />
            <p className="text-xs text-muted-foreground">
              Número máximo de perguntas adicionais que a IA pode fazer antes de oferecer finalizar o pedido
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Idioma</CardTitle>
          <CardDescription>
            Configure o idioma das interações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Idioma</Label>
            <Select
              value={settings.language}
              onValueChange={(value) => updateSetting('language', value)}
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                <SelectItem value="pt-PT">Português (Portugal)</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={loadSettings}
          disabled={saving}
        >
          Reverter
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar Alterações
        </Button>
      </div>
    </div>
  );
}

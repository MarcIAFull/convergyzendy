import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';
import { RecoveryConfig } from '@/types/restaurant-ai-settings';

const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  enabled: false,
  types: {
    cart_abandoned: {
      enabled: true,
      delay_minutes: 30,
      max_attempts: 2,
      message_template: "Olá {{customer_name}}! 👋 Notei que deixaste {{items_count}} item(ns) no carrinho. Ainda queres finalizar o pedido? Estou aqui para ajudar! 😊"
    },
    conversation_paused: {
      enabled: true,
      delay_minutes: 15,
      max_attempts: 1,
      message_template: "Olá! 👋 Ficou alguma dúvida? Estou aqui para continuar o teu pedido! 😊"
    },
    customer_inactive: {
      enabled: false,
      delay_days: 30,
      max_attempts: 1,
      message_template: "{{customer_name}}! 😊 Sentimos a tua falta! Que tal repetir aquele pedido? Temos novidades no cardápio! 🍕✨"
    }
  }
};

interface RecoveryMessagesSettingsProps {
  config: RecoveryConfig | null;
  onChange: (config: RecoveryConfig) => void;
}

export function RecoveryMessagesSettings({ config: rawConfig, onChange }: RecoveryMessagesSettingsProps) {
  const config = rawConfig || DEFAULT_RECOVERY_CONFIG;

  const updateConfig = (path: string[], value: any) => {
    const newConfig = JSON.parse(JSON.stringify(config));
    let current = newConfig;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    onChange(newConfig);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <CardTitle>Mensagens de Recuperação</CardTitle>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig(['enabled'], checked)}
          />
        </div>
        <CardDescription>
          Recupere automaticamente conversas abandonadas, carrinhos e clientes inativos (WhatsApp e menu público)
        </CardDescription>
      </CardHeader>

      {config.enabled && (
        <CardContent className="space-y-6">
          {/* Cart Abandoned */}
          <RecoveryTypeSection
            icon="🛒"
            title="Carrinho Abandonado"
            description="Cliente adicionou itens mas não finalizou (WhatsApp ou menu público)"
            enabled={config.types.cart_abandoned.enabled}
            onEnabledChange={(v) => updateConfig(['types', 'cart_abandoned', 'enabled'], v)}
            borderColor="border-primary/20"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Aguardar (minutos)</Label>
                <Input type="number" value={config.types.cart_abandoned.delay_minutes}
                  onChange={(e) => updateConfig(['types', 'cart_abandoned', 'delay_minutes'], parseInt(e.target.value) || 30)}
                  className="mt-1" min={5} max={120} />
              </div>
              <div>
                <Label className="text-xs">Tentativas máximas</Label>
                <Input type="number" value={config.types.cart_abandoned.max_attempts}
                  onChange={(e) => updateConfig(['types', 'cart_abandoned', 'max_attempts'], parseInt(e.target.value) || 2)}
                  className="mt-1" min={1} max={3} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea value={config.types.cart_abandoned.message_template}
                onChange={(e) => updateConfig(['types', 'cart_abandoned', 'message_template'], e.target.value)}
                className="mt-1 min-h-[80px] text-sm" />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis: <code className="bg-muted px-1 rounded">{'{{customer_name}}'}</code>,{' '}
                <code className="bg-muted px-1 rounded">{'{{items_count}}'}</code>,{' '}
                <code className="bg-muted px-1 rounded">{'{{cart_value}}'}</code>
              </p>
            </div>
          </RecoveryTypeSection>

          {/* Conversation Paused */}
          <RecoveryTypeSection
            icon="💬"
            title="Conversa Pausada"
            description="Cliente iniciou mas não continuou a conversa"
            enabled={config.types.conversation_paused.enabled}
            onEnabledChange={(v) => updateConfig(['types', 'conversation_paused', 'enabled'], v)}
            borderColor="border-accent/20"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Aguardar (minutos)</Label>
                <Input type="number" value={config.types.conversation_paused.delay_minutes}
                  onChange={(e) => updateConfig(['types', 'conversation_paused', 'delay_minutes'], parseInt(e.target.value) || 15)}
                  className="mt-1" min={5} max={60} />
              </div>
              <div>
                <Label className="text-xs">Tentativas máximas</Label>
                <Input type="number" value={config.types.conversation_paused.max_attempts}
                  onChange={(e) => updateConfig(['types', 'conversation_paused', 'max_attempts'], parseInt(e.target.value) || 1)}
                  className="mt-1" min={1} max={3} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea value={config.types.conversation_paused.message_template}
                onChange={(e) => updateConfig(['types', 'conversation_paused', 'message_template'], e.target.value)}
                className="mt-1 min-h-[80px] text-sm" />
              <p className="text-xs text-muted-foreground mt-1">
                Variável: <code className="bg-muted px-1 rounded">{'{{customer_name}}'}</code>
              </p>
            </div>
          </RecoveryTypeSection>

          {/* Customer Inactive */}
          <RecoveryTypeSection
            icon="😴"
            title="Cliente Inativo"
            description="Cliente não interage há muito tempo"
            enabled={config.types.customer_inactive.enabled}
            onEnabledChange={(v) => updateConfig(['types', 'customer_inactive', 'enabled'], v)}
            borderColor="border-muted"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Aguardar (dias)</Label>
                <Input type="number" value={config.types.customer_inactive.delay_days}
                  onChange={(e) => updateConfig(['types', 'customer_inactive', 'delay_days'], parseInt(e.target.value) || 30)}
                  className="mt-1" min={7} max={90} />
              </div>
              <div>
                <Label className="text-xs">Tentativas máximas</Label>
                <Input type="number" value={config.types.customer_inactive.max_attempts}
                  onChange={(e) => updateConfig(['types', 'customer_inactive', 'max_attempts'], parseInt(e.target.value) || 1)}
                  className="mt-1" min={1} max={3} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea value={config.types.customer_inactive.message_template}
                onChange={(e) => updateConfig(['types', 'customer_inactive', 'message_template'], e.target.value)}
                className="mt-1 min-h-[80px] text-sm" />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis: <code className="bg-muted px-1 rounded">{'{{customer_name}}'}</code>,{' '}
                <code className="bg-muted px-1 rounded">{'{{preferred_item}}'}</code>
              </p>
            </div>
          </RecoveryTypeSection>

          <div className="pt-4 border-t">
            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <p className="text-sm font-medium">📋 Como funciona:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Mensagens enviadas apenas no horário comercial (9h-22h)</li>
                <li>Sistema verifica automaticamente a cada 15 minutos</li>
                <li>Inclui carrinhos do WhatsApp e pedidos incompletos do menu público</li>
                <li>Clientes que respondem são marcados como "recuperados"</li>
                <li>Não envia se cliente já tem atividade recente</li>
              </ul>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface RecoveryTypeSectionProps {
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  borderColor: string;
  children: React.ReactNode;
}

function RecoveryTypeSection({ icon, title, description, enabled, onEnabledChange, borderColor, children }: RecoveryTypeSectionProps) {
  return (
    <div className={`space-y-4 border-l-2 ${borderColor} pl-4`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{icon} {title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && <div className="space-y-3">{children}</div>}
    </div>
  );
}

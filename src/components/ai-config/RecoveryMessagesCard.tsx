import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import { Agent } from '@/types/agent';

interface RecoveryMessagesCardProps {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function RecoveryMessagesCard({ agent, onUpdate }: RecoveryMessagesCardProps) {
  const [expanded, setExpanded] = useState(false);

  const config = (agent.recovery_config || {
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
  }) as any;

  const updateConfig = (path: string[], value: any) => {
    const newConfig = JSON.parse(JSON.stringify(config));
    let current = newConfig;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    onUpdate({ recovery_config: newConfig });
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <MessageCircle className="h-4 w-4" />
            <CardTitle>Mensagens de Recuperação</CardTitle>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig(['enabled'], checked)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <CardDescription>
          Recupere automaticamente conversas abandonadas, carrinhos e clientes inativos
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          {/* Cart Abandoned */}
          <div className="space-y-4 border-l-2 border-primary/20 pl-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">🛒 Carrinho Abandonado</h4>
                <p className="text-xs text-muted-foreground">
                  Cliente adicionou itens mas não finalizou
                </p>
              </div>
              <Switch
                checked={config.types.cart_abandoned.enabled}
                onCheckedChange={(checked) => updateConfig(['types', 'cart_abandoned', 'enabled'], checked)}
              />
            </div>

            {config.types.cart_abandoned.enabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Aguardar (minutos)</Label>
                    <Input
                      type="number"
                      value={config.types.cart_abandoned.delay_minutes}
                      onChange={(e) => updateConfig(['types', 'cart_abandoned', 'delay_minutes'], parseInt(e.target.value))}
                      className="mt-1"
                      min={5}
                      max={120}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tentativas máximas</Label>
                    <Input
                      type="number"
                      value={config.types.cart_abandoned.max_attempts}
                      onChange={(e) => updateConfig(['types', 'cart_abandoned', 'max_attempts'], parseInt(e.target.value))}
                      className="mt-1"
                      min={1}
                      max={3}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    value={config.types.cart_abandoned.message_template}
                    onChange={(e) => updateConfig(['types', 'cart_abandoned', 'message_template'], e.target.value)}
                    className="mt-1 min-h-[80px] text-sm"
                    placeholder="Use: {{customer_name}}, {{items_count}}, {{cart_value}}"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variáveis: <code className="bg-muted px-1 rounded">{'{{customer_name}}'}</code>,{' '}
                    <code className="bg-muted px-1 rounded">{'{{items_count}}'}</code>,{' '}
                    <code className="bg-muted px-1 rounded">{'{{cart_value}}'}</code>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Conversation Paused */}
          <div className="space-y-4 border-l-2 border-accent/20 pl-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">💬 Conversa Pausada</h4>
                <p className="text-xs text-muted-foreground">
                  Cliente iniciou mas não continuou a conversa
                </p>
              </div>
              <Switch
                checked={config.types.conversation_paused.enabled}
                onCheckedChange={(checked) => updateConfig(['types', 'conversation_paused', 'enabled'], checked)}
              />
            </div>

            {config.types.conversation_paused.enabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Aguardar (minutos)</Label>
                    <Input
                      type="number"
                      value={config.types.conversation_paused.delay_minutes}
                      onChange={(e) => updateConfig(['types', 'conversation_paused', 'delay_minutes'], parseInt(e.target.value))}
                      className="mt-1"
                      min={5}
                      max={60}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tentativas máximas</Label>
                    <Input
                      type="number"
                      value={config.types.conversation_paused.max_attempts}
                      onChange={(e) => updateConfig(['types', 'conversation_paused', 'max_attempts'], parseInt(e.target.value))}
                      className="mt-1"
                      min={1}
                      max={3}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    value={config.types.conversation_paused.message_template}
                    onChange={(e) => updateConfig(['types', 'conversation_paused', 'message_template'], e.target.value)}
                    className="mt-1 min-h-[80px] text-sm"
                    placeholder="Use: {{customer_name}}"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variável: <code className="bg-muted px-1 rounded">{'{{customer_name}}'}</code>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Customer Inactive */}
          <div className="space-y-4 border-l-2 border-muted pl-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">😴 Cliente Inativo</h4>
                <p className="text-xs text-muted-foreground">
                  Cliente não interage há muito tempo
                </p>
              </div>
              <Switch
                checked={config.types.customer_inactive.enabled}
                onCheckedChange={(checked) => updateConfig(['types', 'customer_inactive', 'enabled'], checked)}
              />
            </div>

            {config.types.customer_inactive.enabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Aguardar (dias)</Label>
                    <Input
                      type="number"
                      value={config.types.customer_inactive.delay_days}
                      onChange={(e) => updateConfig(['types', 'customer_inactive', 'delay_days'], parseInt(e.target.value))}
                      className="mt-1"
                      min={7}
                      max={90}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tentativas máximas</Label>
                    <Input
                      type="number"
                      value={config.types.customer_inactive.max_attempts}
                      onChange={(e) => updateConfig(['types', 'customer_inactive', 'max_attempts'], parseInt(e.target.value))}
                      className="mt-1"
                      min={1}
                      max={3}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    value={config.types.customer_inactive.message_template}
                    onChange={(e) => updateConfig(['types', 'customer_inactive', 'message_template'], e.target.value)}
                    className="mt-1 min-h-[80px] text-sm"
                    placeholder="Use: {{customer_name}}, {{preferred_item}}"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variáveis: <code className="bg-muted px-1 rounded">{'{{customer_name}}'}</code>,{' '}
                    <code className="bg-muted px-1 rounded">{'{{preferred_item}}'}</code>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <p className="text-sm font-medium">📋 Como funciona:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Mensagens são enviadas apenas no horário comercial (9h-22h)</li>
                <li>Sistema verifica automaticamente a cada 15 minutos</li>
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
import { Agent, DEFAULT_INTENTS, AVAILABLE_TOOLS } from '@/types/agent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OrchestrationRulesEditorProps {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

const INTENT_DESCRIPTIONS: Record<string, string> = {
  browse_product: 'Cliente quer ver produtos específicos ou navegar no menu',
  browse_menu: 'Cliente quer ver todo o menu ou uma categoria',
  confirm_item: 'Cliente confirma que quer um produto específico',
  provide_address: 'Cliente fornece endereço de entrega',
  provide_payment: 'Cliente escolhe forma de pagamento',
  finalize: 'Cliente quer finalizar o pedido',
  ask_question: 'Cliente tem dúvidas sobre produtos, entrega, etc',
  collect_customer_data: 'Necessário coletar nome ou outros dados do cliente',
  manage_pending_items: 'Gerenciar itens pendentes antes de adicionar ao carrinho',
  confirm_pending_items: 'Cliente confirma todos os itens pendentes',
  modify_cart: 'Cliente quer alterar algo no carrinho',
  unclear: 'Intenção não clara, precisa de clarificação'
};

export function OrchestrationRulesEditor({ agent, onUpdate }: OrchestrationRulesEditorProps) {
  const intents = agent.orchestration_config?.intents || {};

  const handleIntentUpdate = (intentName: string, field: 'decision_hint' | 'allowed_tools', value: string | string[]) => {
    const currentIntent = intents[intentName] || { allowed_tools: [], decision_hint: '' };
    
    const updatedIntents = {
      ...intents,
      [intentName]: {
        ...currentIntent,
        [field]: value
      }
    };

    onUpdate({
      orchestration_config: {
        ...agent.orchestration_config,
        intents: updatedIntents
      }
    });
  };

  const handleToolToggle = (intentName: string, toolName: string, checked: boolean) => {
    const currentIntent = intents[intentName] || { allowed_tools: [], decision_hint: '' };
    const currentTools = currentIntent.allowed_tools || [];
    
    const updatedTools = checked
      ? [...currentTools, toolName]
      : currentTools.filter(t => t !== toolName);

    handleIntentUpdate(intentName, 'allowed_tools', updatedTools);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Regras de Orquestração</CardTitle>
            <CardDescription>
              Configure quais ferramentas podem ser usadas para cada intenção do cliente
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  O orquestrador classifica a intenção do cliente e escolhe as ferramentas permitidas.
                  Isso garante que a IA use apenas as ações apropriadas para cada situação.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-6">
            {DEFAULT_INTENTS.map(intent => {
              const intentConfig = intents[intent] || { allowed_tools: [], decision_hint: '' };
              
              return (
                <div key={intent} className="border rounded-lg p-4 space-y-4">
                  {/* Intent Header */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">{intent}</Label>
                      <Badge variant="outline" className="text-xs">
                        {intentConfig.allowed_tools?.length || 0} ferramentas
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {INTENT_DESCRIPTIONS[intent]}
                    </p>
                  </div>

                  {/* Decision Hint */}
                  <div className="space-y-2">
                    <Label className="text-sm">Dica de Decisão</Label>
                    <Textarea 
                      value={intentConfig.decision_hint || ''}
                      onChange={(e) => handleIntentUpdate(intent, 'decision_hint', e.target.value)}
                      placeholder="Quando esta intenção deve ser classificada? Ex: 'Use quando cliente mencionar múltiplos produtos'"
                      rows={2}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ajude o orquestrador a entender quando classificar esta intenção
                    </p>
                  </div>

                  {/* Allowed Tools */}
                  <div className="space-y-2">
                    <Label className="text-sm">Ferramentas Permitidas</Label>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {AVAILABLE_TOOLS.map(tool => {
                        const isAllowed = intentConfig.allowed_tools?.includes(tool.name) || false;
                        
                        return (
                          <div key={tool.name} className="flex items-start space-x-2">
                            <Checkbox
                              id={`${intent}-${tool.name}`}
                              checked={isAllowed}
                              onCheckedChange={(checked) => 
                                handleToolToggle(intent, tool.name, checked as boolean)
                              }
                            />
                            <div className="grid gap-1 leading-none">
                              <label
                                htmlFor={`${intent}-${tool.name}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {tool.label}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {tool.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
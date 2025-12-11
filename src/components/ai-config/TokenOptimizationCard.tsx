import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, Zap, Info } from 'lucide-react';
import { Agent, TokenOptimizationConfig } from '@/types/agent';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface TokenOptimizationCardProps {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

// Default max tokens per intent
const DEFAULT_MAX_TOKENS_BY_INTENT: Record<string, number> = {
  greeting: 150,
  browse_menu: 350,
  browse_product: 350,
  confirm_item: 300,
  manage_pending_items: 400,
  provide_address: 300,
  provide_payment: 250,
  finalize: 500,
  needs_human: 200,
  unclear: 200,
  security_threat: 100,
  prefilled_order: 400,
};

const DEFAULT_OPTIMIZATION_CONFIG: TokenOptimizationConfig = {
  max_tokens_by_intent: DEFAULT_MAX_TOKENS_BY_INTENT,
  history_window_size: 5,
  history_inbound_limit: 3,
  history_outbound_limit: 2,
  history_message_truncate_length: 80,
};

export function TokenOptimizationCard({ agent, onUpdate }: TokenOptimizationCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Get current optimization config from behavior_config
  const optimizationConfig: TokenOptimizationConfig = agent.behavior_config?.token_optimization || DEFAULT_OPTIMIZATION_CONFIG;

  const handleIntentTokenChange = (intent: string, value: number) => {
    const newMaxTokens = {
      ...optimizationConfig.max_tokens_by_intent,
      [intent]: value
    };
    
    onUpdate({
      behavior_config: {
        ...agent.behavior_config,
        token_optimization: {
          ...optimizationConfig,
          max_tokens_by_intent: newMaxTokens
        }
      }
    });
  };

  const handleConfigChange = (key: string, value: number) => {
    onUpdate({
      behavior_config: {
        ...agent.behavior_config,
        token_optimization: {
          ...optimizationConfig,
          [key]: value
        }
      }
    });
  };

  const totalEstimatedSavings = "35-45%";

  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Zap className="h-4 w-4 text-green-500" />
          <CardTitle>Otimização de Tokens</CardTitle>
          <Badge variant="outline" className="ml-2 border-green-500/50 text-green-600">
            Economia: {totalEstimatedSavings}
          </Badge>
        </div>
        <CardDescription>
          Configurações para reduzir consumo de tokens sem perder qualidade
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          {/* History Window Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">Janela de Histórico</h4>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Limita quantas mensagens anteriores são enviadas ao modelo. Menos mensagens = menos tokens.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Msgs Cliente (inbound)</Label>
                <Input
                  type="number"
                  value={optimizationConfig.history_inbound_limit}
                  onChange={(e) => handleConfigChange('history_inbound_limit', parseInt(e.target.value))}
                  min={1}
                  max={10}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Msgs Agente (outbound)</Label>
                <Input
                  type="number"
                  value={optimizationConfig.history_outbound_limit}
                  onChange={(e) => handleConfigChange('history_outbound_limit', parseInt(e.target.value))}
                  min={1}
                  max={10}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Truncar após (chars)</Label>
                <Input
                  type="number"
                  value={optimizationConfig.history_message_truncate_length}
                  onChange={(e) => handleConfigChange('history_message_truncate_length', parseInt(e.target.value))}
                  min={50}
                  max={500}
                  step={10}
                />
              </div>
            </div>
          </div>

          {/* Max Tokens per Intent */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">Max Tokens por Intent</h4>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Limita o tamanho da resposta baseado no tipo de intent. Intents simples precisam de menos tokens.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {Object.entries(optimizationConfig.max_tokens_by_intent || DEFAULT_MAX_TOKENS_BY_INTENT).map(([intent, tokens]) => (
                <div key={intent} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{intent}</Label>
                  <Input
                    type="number"
                    value={tokens as number}
                    onChange={(e) => handleIntentTokenChange(intent, parseInt(e.target.value))}
                    min={50}
                    max={1000}
                    step={50}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <h5 className="font-medium mb-2">Estratégias Implementadas:</h5>
            <ul className="space-y-1 text-muted-foreground">
              <li>✅ <strong>Fase 1:</strong> Max tokens dinâmico por intent</li>
              <li>✅ <strong>Fase 1:</strong> Histórico limitado a {optimizationConfig.history_inbound_limit + optimizationConfig.history_outbound_limit} mensagens</li>
              <li>✅ <strong>Fase 2:</strong> Estrutura de mensagens otimizada para cache</li>
              <li>✅ <strong>Fase 3:</strong> Formato compacto de histórico (→/←)</li>
              <li>⏳ <strong>Fase 4:</strong> Bypass de LLM para intents simples (pendente)</li>
              <li>⏳ <strong>Fase 5:</strong> Alertas de uso (pendente)</li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

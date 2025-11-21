import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Agent } from '@/types/agent';

interface BehaviorConfigCardProps {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function BehaviorConfigCard({ agent, onUpdate }: BehaviorConfigCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const configJson = JSON.stringify(
    {
      behavior_config: agent.behavior_config || {},
      orchestration_config: agent.orchestration_config || {},
    },
    null,
    2
  );

  const handleJsonChange = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      setJsonError(null);
      onUpdate({
        behavior_config: parsed.behavior_config,
        orchestration_config: parsed.orchestration_config,
      });
    } catch (error) {
      setJsonError('JSON inválido');
    }
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <CardTitle>Configuração de Comportamento</CardTitle>
        </div>
        <CardDescription>
          Configurações avançadas (JSON) para perfil de cliente, itens pendentes e orquestração
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <div>
            <Label>Configuração JSON</Label>
            <Textarea
              value={configJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="min-h-[300px] font-mono text-xs mt-2"
              placeholder='{\n  "behavior_config": {},\n  "orchestration_config": {}\n}'
            />
            {jsonError && (
              <p className="text-sm text-destructive mt-2">{jsonError}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Edite a configuração JSON diretamente. Tenha cuidado com a sintaxe.
            </p>
          </div>

          <div className="border-t pt-4 space-y-2">
            <h4 className="text-sm font-medium">Estrutura esperada:</h4>
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`{
  "behavior_config": {
    "customer_profile": {
      "auto_load": true,
      "auto_update_name": true,
      "auto_update_address": true,
      "auto_update_payment": true
    },
    "pending_products": {
      "allow_multiple": true,
      "expiration_minutes": 15
    }
  },
  "orchestration_config": {
    "intents": {
      "browse_product": {
        "decision_hint": "...",
        "allowed_tools": ["get_menu"]
      }
    }
  }
}`}
            </pre>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

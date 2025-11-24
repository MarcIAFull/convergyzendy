import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { Agent } from '@/types/agent';
import { behaviorConfigSchema, orchestrationConfigSchema } from '@/lib/behaviorConfigSchema';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
      
      // Validate schemas
      const behaviorResult = behaviorConfigSchema.safeParse(parsed.behavior_config);
      const orchestrationResult = orchestrationConfigSchema.safeParse(parsed.orchestration_config);
      
      if (!behaviorResult.success) {
        setJsonError(`Behavior Config inválido: ${behaviorResult.error.issues[0].message}`);
        return;
      }
      
      if (!orchestrationResult.success) {
        setJsonError(`Orchestration Config inválido: ${orchestrationResult.error.issues[0].message}`);
        return;
      }
      
      setJsonError(null);
      onUpdate({
        behavior_config: parsed.behavior_config,
        orchestration_config: parsed.orchestration_config,
      });
    } catch (error) {
      setJsonError('JSON inválido - verifique a sintaxe');
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
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{jsonError}</AlertDescription>
              </Alert>
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

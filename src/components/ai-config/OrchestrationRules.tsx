import { Agent, DEFAULT_INTENTS, AVAILABLE_TOOLS } from '@/types/agent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface OrchestrationRulesProps {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function OrchestrationRules({ agent, onUpdate }: OrchestrationRulesProps) {
  const intents = agent.orchestration_config?.intents || {};

  const handleIntentUpdate = (intentName: string, field: 'decision_hint', value: string) => {
    const updatedIntents = {
      ...intents,
      [intentName]: {
        ...intents[intentName],
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orchestration Rules</CardTitle>
        <CardDescription>Configure intent classification behavior</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {DEFAULT_INTENTS.map(intent => (
          <div key={intent} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{intent}</Label>
              <Badge variant="outline">{intent}</Badge>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">Decision Hint</Label>
              <Textarea 
                value={intents[intent]?.decision_hint || ''}
                onChange={(e) => handleIntentUpdate(intent, 'decision_hint', e.target.value)}
                placeholder={`When should this intent be triggered?`}
                rows={2}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Help the orchestrator understand when to classify this intent
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

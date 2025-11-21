import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Agent, AVAILABLE_MODELS } from '@/types/agent';

interface ModelParametersCardProps {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function ModelParametersCard({ agent, onUpdate }: ModelParametersCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <CardTitle>Modelo & Parâmetros</CardTitle>
        </div>
        <CardDescription>
          {AVAILABLE_MODELS.find(m => m.value === agent.model)?.label || agent.model} • 
          Temp: {agent.temperature} • 
          Max tokens: {agent.max_tokens}
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={agent.model} onValueChange={(value) => onUpdate({ model: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(model => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={agent.max_tokens}
                onChange={(e) => onUpdate({ max_tokens: parseInt(e.target.value) })}
                min={100}
                max={4000}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Temperature</Label>
              <span className="text-sm text-muted-foreground">{agent.temperature}</span>
            </div>
            <Slider
              value={[agent.temperature]}
              onValueChange={([value]) => onUpdate({ temperature: value })}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Top P</Label>
              <span className="text-sm text-muted-foreground">{agent.top_p}</span>
            </div>
            <Slider
              value={[agent.top_p || 1]}
              onValueChange={([value]) => onUpdate({ top_p: value })}
              min={0}
              max={1}
              step={0.05}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Frequency Penalty</Label>
              <span className="text-sm text-muted-foreground">{agent.frequency_penalty}</span>
            </div>
            <Slider
              value={[agent.frequency_penalty || 0]}
              onValueChange={([value]) => onUpdate({ frequency_penalty: value })}
              min={-2}
              max={2}
              step={0.1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Presence Penalty</Label>
              <span className="text-sm text-muted-foreground">{agent.presence_penalty}</span>
            </div>
            <Slider
              value={[agent.presence_penalty || 0]}
              onValueChange={([value]) => onUpdate({ presence_penalty: value })}
              min={-2}
              max={2}
              step={0.1}
              className="w-full"
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

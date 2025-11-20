import { Agent, AVAILABLE_MODELS } from '@/types/agent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface ModelSettingsProps {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function ModelSettings({ agent, onUpdate }: ModelSettingsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model & Behavior</CardTitle>
        <CardDescription>Configure AI model settings and parameters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Selection */}
        <div className="space-y-2">
          <Label>Model</Label>
          <Select 
            value={agent.model} 
            onValueChange={(value) => onUpdate({ model: value })}
          >
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

        {/* Temperature */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Temperature</Label>
            <span className="text-sm text-muted-foreground">{agent.temperature}</span>
          </div>
          <Slider 
            value={[agent.temperature]} 
            onValueChange={([value]) => onUpdate({ temperature: value })}
            min={0}
            max={2}
            step={0.1}
          />
          <p className="text-xs text-muted-foreground">
            Lower = more focused, Higher = more creative
          </p>
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <Label>Max Tokens</Label>
          <Input 
            type="number"
            value={agent.max_tokens}
            onChange={(e) => onUpdate({ max_tokens: parseInt(e.target.value) || 1000 })}
            min={1}
            max={4000}
          />
          <p className="text-xs text-muted-foreground">
            Maximum length of the response
          </p>
        </div>

        {/* Advanced Settings */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary">
            <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            Advanced Settings
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            {/* Top P */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Top P</Label>
                <span className="text-sm text-muted-foreground">{agent.top_p || 1.0}</span>
              </div>
              <Slider 
                value={[agent.top_p || 1.0]} 
                onValueChange={([value]) => onUpdate({ top_p: value })}
                min={0}
                max={1}
                step={0.1}
              />
            </div>

            {/* Frequency Penalty */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Frequency Penalty</Label>
                <span className="text-sm text-muted-foreground">{agent.frequency_penalty || 0}</span>
              </div>
              <Slider 
                value={[agent.frequency_penalty || 0]} 
                onValueChange={([value]) => onUpdate({ frequency_penalty: value })}
                min={-2}
                max={2}
                step={0.1}
              />
            </div>

            {/* Presence Penalty */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Presence Penalty</Label>
                <span className="text-sm text-muted-foreground">{agent.presence_penalty || 0}</span>
              </div>
              <Slider 
                value={[agent.presence_penalty || 0]} 
                onValueChange={([value]) => onUpdate({ presence_penalty: value })}
                min={-2}
                max={2}
                step={0.1}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

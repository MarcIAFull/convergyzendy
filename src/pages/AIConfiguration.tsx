import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Agent } from '@/types/agent';
import { Loader2 } from 'lucide-react';
import { ModelSettings } from '@/components/ai-config/ModelSettings';
import { PromptBlocksEditor } from '@/components/ai-config/PromptBlocksEditor';
import { ToolsManager } from '@/components/ai-config/ToolsManager';
import { OrchestrationRules } from '@/components/ai-config/OrchestrationRules';
import { BehaviorSettings } from '@/components/ai-config/BehaviorSettings';

export default function AIConfiguration() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('name');

      if (error) throw error;
      
      // Cast the data to Agent type
      const agents = (data || []).map(d => ({
        ...d,
        type: d.type as 'orchestrator' | 'assistant',
        behavior_config: d.behavior_config as any,
        orchestration_config: d.orchestration_config as any
      })) as Agent[];
      
      setAgents(agents);
      if (agents.length > 0 && !selectedAgentId) {
        setSelectedAgentId(agents[0].id);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agents',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAgentUpdate = (updates: Partial<Agent>) => {
    if (!selectedAgentId) return;
    setAgents(prev => prev.map(a => 
      a.id === selectedAgentId ? { ...a, ...updates } : a
    ));
  };

  const handleSave = async () => {
    if (!selectedAgent) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('agents')
        .update({
          model: selectedAgent.model,
          temperature: selectedAgent.temperature,
          max_tokens: selectedAgent.max_tokens,
          top_p: selectedAgent.top_p,
          frequency_penalty: selectedAgent.frequency_penalty,
          presence_penalty: selectedAgent.presence_penalty,
          behavior_config: selectedAgent.behavior_config as any,
          orchestration_config: selectedAgent.orchestration_config as any
        })
        .eq('id', selectedAgent.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Agent configuration saved successfully'
      });
      
      await loadAgents();
    } catch (error) {
      console.error('Error saving agent:', error);
      toast({
        title: 'Error',
        description: 'Failed to save agent configuration',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    loadAgents();
    toast({
      title: 'Reverted',
      description: 'All changes have been discarded'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Configuration</h1>
            <p className="text-muted-foreground mt-1">
              Configure AI agents, prompts, tools, and behavior
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedAgentId || ''} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name === 'orchestrator' ? 'Orchestrator Agent' : 'Conversation & Sales Agent'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleRevert}>
              Revert Changes
            </Button>
            
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>

        {/* Three-column layout */}
        {selectedAgent && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Model & Behavior */}
            <div className="space-y-6">
              <ModelSettings 
                agent={selectedAgent} 
                onUpdate={handleAgentUpdate} 
              />
              <PromptBlocksEditor 
                agentId={selectedAgent.id} 
              />
            </div>

            {/* Column 2: Tools & Orchestration */}
            <div className="space-y-6">
              <ToolsManager 
                agentId={selectedAgent.id} 
              />
              {selectedAgent.type === 'orchestrator' && (
                <OrchestrationRules 
                  agent={selectedAgent}
                  onUpdate={handleAgentUpdate}
                />
              )}
            </div>

            {/* Column 3: Customer & Pending Products */}
            <div className="space-y-6">
              <BehaviorSettings 
                agent={selectedAgent}
                onUpdate={handleAgentUpdate}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

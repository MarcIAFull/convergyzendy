import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Agent, AgentTool } from '@/types/agent';
import { Loader2 } from 'lucide-react';
import { UnifiedPromptEditor } from '@/components/ai-config/UnifiedPromptEditor';
import { CompactToolsList } from '@/components/ai-config/CompactToolsList';
import { ModelParametersCard } from '@/components/ai-config/ModelParametersCard';
import { BehaviorConfigCard } from '@/components/ai-config/BehaviorConfigCard';
import { RecoveryMessagesCard } from '@/components/ai-config/RecoveryMessagesCard';

export default function AIConfiguration() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promptBlocks, setPromptBlocks] = useState<any[]>([]);
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [unifiedPrompt, setUnifiedPrompt] = useState('');

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      loadPromptBlocks();
      loadTools();
    }
  }, [selectedAgentId]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('name');

      if (error) throw error;
      
      const agents = (data || []).map(d => ({
        ...d,
        type: d.type as 'orchestrator' | 'assistant',
        behavior_config: d.behavior_config as any,
        orchestration_config: d.orchestration_config as any,
        recovery_config: d.recovery_config as any
      })) as Agent[];
      
      setAgents(agents);
      if (agents.length > 0 && !selectedAgentId) {
        setSelectedAgentId(agents[0].id);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar agentes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPromptBlocks = async () => {
    if (!selectedAgentId) return;
    
    try {
      const { data, error } = await supabase
        .from('agent_prompt_blocks')
        .select('*')
        .eq('agent_id', selectedAgentId)
        .order('ordering');

      if (error) throw error;
      
      setPromptBlocks(data || []);
      
      // Concatenate all blocks into unified prompt
      const combined = (data || [])
        .map(block => `# ${block.title}\n\n${block.content}`)
        .join('\n\n---\n\n');
      setUnifiedPrompt(combined);
    } catch (error) {
      console.error('Error loading prompt blocks:', error);
    }
  };

  const loadTools = async () => {
    if (!selectedAgentId) return;
    
    try {
      const { data, error } = await supabase
        .from('agent_tools')
        .select('*')
        .eq('agent_id', selectedAgentId)
        .order('ordering');

      if (error) throw error;
      
      setTools(data || []);
    } catch (error) {
      console.error('Error loading tools:', error);
    }
  };

  const handleAgentUpdate = (updates: Partial<Agent>) => {
    if (!selectedAgentId) return;
    setAgents(prev => prev.map(a => 
      a.id === selectedAgentId ? { ...a, ...updates } : a
    ));
  };

  const handleSave = async () => {
    if (!selectedAgent || !selectedAgentId) return;

    try {
      setSaving(true);
      
      // Save agent settings
      const { error: agentError } = await supabase
        .from('agents')
        .update({
          model: selectedAgent.model,
          temperature: selectedAgent.temperature,
          max_tokens: selectedAgent.max_tokens,
          top_p: selectedAgent.top_p,
          frequency_penalty: selectedAgent.frequency_penalty,
          presence_penalty: selectedAgent.presence_penalty,
          behavior_config: selectedAgent.behavior_config as any,
          orchestration_config: selectedAgent.orchestration_config as any,
          recovery_config: selectedAgent.recovery_config as any
        })
        .eq('id', selectedAgent.id);

      if (agentError) throw agentError;

      // Save unified prompt as single block
      const { error: promptError } = await supabase
        .from('agent_prompt_blocks')
        .delete()
        .eq('agent_id', selectedAgentId);

      if (promptError) throw promptError;

      const { error: insertError } = await supabase
        .from('agent_prompt_blocks')
        .insert({
          agent_id: selectedAgentId,
          title: 'System Prompt',
          content: unifiedPrompt,
          ordering: 0,
          is_locked: false
        });

      if (insertError) throw insertError;

      // Save tools
      for (const tool of tools) {
        const { error: toolError } = await supabase
          .from('agent_tools')
          .upsert({
            id: tool.id,
            agent_id: selectedAgentId,
            tool_name: tool.tool_name,
            enabled: tool.enabled,
            usage_rules: tool.usage_rules,
            description_override: tool.description_override,
            ordering: tool.ordering
          });

        if (toolError) throw toolError;
      }

      toast({
        title: 'Sucesso',
        description: 'Configuração salva com sucesso'
      });
      
      await loadAgents();
      await loadPromptBlocks();
      await loadTools();
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao salvar configuração',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    loadAgents();
    loadPromptBlocks();
    loadTools();
    toast({
      title: 'Revertido',
      description: 'Todas as alterações foram descartadas'
    });
  };

  const handleToggleTool = async (toolName: string, enabled: boolean) => {
    setTools(prev => prev.map(t => 
      t.tool_name === toolName ? { ...t, enabled } : t
    ));
  };

  const handleUpdateTool = async (toolName: string, updates: Partial<AgentTool>) => {
    setTools(prev => prev.map(t => 
      t.tool_name === toolName ? { ...t, ...updates } : t
    ));
  };

  const handleDeleteTool = async (toolName: string) => {
    if (!selectedAgentId) return;
    
    try {
      const { error } = await supabase
        .from('agent_tools')
        .delete()
        .eq('agent_id', selectedAgentId)
        .eq('tool_name', toolName);

      if (error) throw error;

      setTools(prev => prev.filter(t => t.tool_name !== toolName));
      
      toast({
        title: 'Sucesso',
        description: 'Ferramenta removida'
      });
    } catch (error) {
      console.error('Error deleting tool:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao remover ferramenta',
        variant: 'destructive'
      });
    }
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Admin Banner */}
        <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="h-5 w-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Configuração Global de IA (Admin)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Estas configurações afetam <strong>TODOS os restaurantes</strong> da plataforma. 
                Os agentes aqui configurados são compartilhados entre todos os tenants.
                Utilize a aba "IA & Automação" nas configurações de cada restaurante para personalizações específicas.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Configuração de IA</h1>
            <p className="text-muted-foreground mt-1">
              Configure completamente o comportamento dos agentes de IA
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedAgentId || ''} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name === 'orchestrator' ? 'Agente Orquestrador' : 'Agente de Conversação & Vendas'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleRevert}>
              Reverter
            </Button>
            
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configuração
            </Button>
          </div>
        </div>

        {/* Unified layout */}
        {selectedAgent && (
          <div className="space-y-6">
            {/* Model Parameters */}
            <ModelParametersCard 
              agent={selectedAgent}
              onUpdate={handleAgentUpdate}
            />

            {/* Unified Prompt Editor */}
            <UnifiedPromptEditor 
              prompt={unifiedPrompt}
              onChange={setUnifiedPrompt}
            />

            {/* Tools */}
            <CompactToolsList 
              tools={tools}
              onToggleTool={handleToggleTool}
              onUpdateTool={handleUpdateTool}
              onDeleteTool={handleDeleteTool}
            />

            {/* Behavior Config */}
            <BehaviorConfigCard 
              agent={selectedAgent}
              onUpdate={handleAgentUpdate}
            />

            {/* Recovery Messages */}
            <RecoveryMessagesCard 
              agent={selectedAgent}
              onUpdate={handleAgentUpdate}
            />
          </div>
        )}
      </div>
    </div>
  );
}

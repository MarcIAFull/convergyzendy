import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AgentTool, AVAILABLE_TOOLS } from '@/types/agent';
import { GripVertical, Settings, X, Loader2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface ToolsManagerProps {
  agentId: string;
}

export function ToolsManager({ agentId }: ToolsManagerProps) {
  const { toast } = useToast();
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<AgentTool | null>(null);

  useEffect(() => {
    loadTools();
  }, [agentId]);

  const loadTools = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agent_tools')
        .select('*')
        .eq('agent_id', agentId)
        .order('ordering');

      if (error) throw error;
      setTools(data || []);
    } catch (error) {
      console.error('Error loading tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    // Handle drag from available to enabled
    if (result.source.droppableId === 'available' && result.destination.droppableId === 'enabled') {
      const toolName = result.draggableId;
      await handleAddTool(toolName);
      return;
    }

    // Handle reordering within enabled
    if (result.source.droppableId === 'enabled' && result.destination.droppableId === 'enabled') {
      const newTools = Array.from(tools);
      const [reorderedTool] = newTools.splice(result.source.index, 1);
      newTools.splice(result.destination.index, 0, reorderedTool);

      const updatedTools = newTools.map((tool, index) => ({
        ...tool,
        ordering: index
      }));

      setTools(updatedTools);

      // Save to database
      try {
        for (const tool of updatedTools) {
          await supabase
            .from('agent_tools')
            .update({ ordering: tool.ordering })
            .eq('id', tool.id);
        }
      } catch (error) {
        console.error('Error updating order:', error);
      }
    }
  };

  const handleAddTool = async (toolName: string) => {
    try {
      const maxOrdering = Math.max(...tools.map(t => t.ordering), -1);
      const { data, error } = await supabase
        .from('agent_tools')
        .insert({
          agent_id: agentId,
          tool_name: toolName,
          enabled: true,
          ordering: maxOrdering + 1
        })
        .select()
        .single();

      if (error) throw error;
      setTools([...tools, data]);
      toast({
        title: 'Success',
        description: 'Tool enabled'
      });
    } catch (error) {
      console.error('Error adding tool:', error);
      toast({
        title: 'Error',
        description: 'Failed to enable tool',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveTool = async (id: string) => {
    try {
      const { error } = await supabase
        .from('agent_tools')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setTools(prev => prev.filter(t => t.id !== id));
      toast({
        title: 'Success',
        description: 'Tool disabled'
      });
    } catch (error) {
      console.error('Error removing tool:', error);
      toast({
        title: 'Error',
        description: 'Failed to disable tool',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateTool = async (id: string, updates: Partial<AgentTool>) => {
    try {
      const { error } = await supabase
        .from('agent_tools')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setTools(prev => prev.map(t => 
        t.id === id ? { ...t, ...updates } : t
      ));
      
      toast({
        title: 'Success',
        description: 'Tool settings updated'
      });
    } catch (error) {
      console.error('Error updating tool:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tool',
        variant: 'destructive'
      });
    }
  };

  const enabledToolNames = new Set(tools.map(t => t.tool_name));
  const availableTools = AVAILABLE_TOOLS.filter(t => !enabledToolNames.has(t.name));

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tools & Capabilities</CardTitle>
          <CardDescription>Drag tools to enable and configure them</CardDescription>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-2 gap-4">
              {/* Available Tools */}
              <div>
                <Label className="mb-2 block">Available Tools</Label>
                <Droppable droppableId="available" isDropDisabled>
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="border rounded-lg p-3 min-h-[300px] space-y-2 bg-muted/20"
                    >
                      {availableTools.map((tool, index) => (
                        <Draggable key={tool.name} draggableId={tool.name} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="bg-card border rounded p-2 cursor-grab active:cursor-grabbing hover:bg-accent"
                            >
                              <div className="font-medium text-sm">{tool.label}</div>
                              <div className="text-xs text-muted-foreground">{tool.description}</div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              {/* Enabled Tools */}
              <div>
                <Label className="mb-2 block">Enabled Tools</Label>
                <Droppable droppableId="enabled">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="border rounded-lg p-3 min-h-[300px] space-y-2 bg-primary/5"
                    >
                      {tools.map((tool, index) => {
                        const toolDef = AVAILABLE_TOOLS.find(t => t.name === tool.tool_name);
                        return (
                          <Draggable key={tool.id} draggableId={tool.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="bg-card border rounded p-2"
                              >
                                <div className="flex items-center gap-2">
                                  <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{toolDef?.label}</div>
                                    <div className="text-xs text-muted-foreground">{toolDef?.description}</div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedTool(tool)}
                                  >
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveTool(tool.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          </DragDropContext>
        </CardContent>
      </Card>

      {/* Tool Settings Dialog */}
      <Dialog open={!!selectedTool} onOpenChange={() => setSelectedTool(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tool Settings</DialogTitle>
            <DialogDescription>
              Configure how this tool behaves
            </DialogDescription>
          </DialogHeader>
          {selectedTool && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Description Override</Label>
                <Textarea 
                  value={selectedTool.description_override || ''}
                  onChange={(e) => setSelectedTool({ ...selectedTool, description_override: e.target.value })}
                  placeholder="Custom description for the AI..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Usage Rules</Label>
                <Textarea 
                  value={selectedTool.usage_rules || ''}
                  onChange={(e) => setSelectedTool({ ...selectedTool, usage_rules: e.target.value })}
                  placeholder="When to use this tool..."
                  rows={4}
                />
              </div>
              <Button 
                onClick={() => {
                  handleUpdateTool(selectedTool.id, {
                    description_override: selectedTool.description_override,
                    usage_rules: selectedTool.usage_rules
                  });
                  setSelectedTool(null);
                }}
              >
                Save
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

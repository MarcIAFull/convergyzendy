import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AgentPromptBlock } from '@/types/agent';
import { GripVertical, Lock, Plus, Trash2, Loader2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface PromptBlocksEditorProps {
  agentId: string;
}

export function PromptBlocksEditor({ agentId }: PromptBlocksEditorProps) {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<AgentPromptBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBlocks();
  }, [agentId]);

  const loadBlocks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agent_prompt_blocks')
        .select('*')
        .eq('agent_id', agentId)
        .order('ordering');

      if (error) throw error;
      setBlocks(data || []);
    } catch (error) {
      console.error('Error loading blocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const newBlocks = Array.from(blocks);
    const [reorderedBlock] = newBlocks.splice(result.source.index, 1);
    newBlocks.splice(result.destination.index, 0, reorderedBlock);

    // Update ordering
    const updatedBlocks = newBlocks.map((block, index) => ({
      ...block,
      ordering: index
    }));

    setBlocks(updatedBlocks);

    // Save to database
    try {
      const updates = updatedBlocks.map(block => ({
        id: block.id,
        ordering: block.ordering
      }));

      for (const update of updates) {
        await supabase
          .from('agent_prompt_blocks')
          .update({ ordering: update.ordering })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: 'Error',
        description: 'Failed to update block order',
        variant: 'destructive'
      });
    }
  };

  const handleAddBlock = async () => {
    try {
      const maxOrdering = Math.max(...blocks.map(b => b.ordering), -1);
      const { data, error } = await supabase
        .from('agent_prompt_blocks')
        .insert({
          agent_id: agentId,
          title: 'New Block',
          content: '',
          ordering: maxOrdering + 1,
          is_locked: false
        })
        .select()
        .single();

      if (error) throw error;
      setBlocks([...blocks, data]);
      toast({
        title: 'Success',
        description: 'New block added'
      });
    } catch (error) {
      console.error('Error adding block:', error);
      toast({
        title: 'Error',
        description: 'Failed to add block',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateBlock = async (id: string, updates: Partial<AgentPromptBlock>) => {
    try {
      const { error } = await supabase
        .from('agent_prompt_blocks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setBlocks(prev => prev.map(b => 
        b.id === id ? { ...b, ...updates } : b
      ));
    } catch (error) {
      console.error('Error updating block:', error);
      toast({
        title: 'Error',
        description: 'Failed to update block',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      const { error } = await supabase
        .from('agent_prompt_blocks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setBlocks(prev => prev.filter(b => b.id !== id));
      toast({
        title: 'Success',
        description: 'Block deleted'
      });
    } catch (error) {
      console.error('Error deleting block:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete block',
        variant: 'destructive'
      });
    }
  };

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
    <Card>
      <CardHeader>
        <CardTitle>System Prompt Builder</CardTitle>
        <CardDescription>Build the system prompt using reorderable blocks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="prompt-blocks">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-3"
              >
                {blocks.map((block, index) => (
                  <Draggable 
                    key={block.id} 
                    draggableId={block.id} 
                    index={index}
                    isDragDisabled={block.is_locked}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="border rounded-lg p-4 space-y-3 bg-card"
                      >
                        <div className="flex items-center gap-2">
                          <div {...provided.dragHandleProps}>
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <Input 
                            value={block.title}
                            onChange={(e) => handleUpdateBlock(block.id, { title: e.target.value })}
                            disabled={block.is_locked}
                            className="flex-1"
                          />
                          {block.is_locked && (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                          {!block.is_locked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteBlock(block.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <Textarea 
                          value={block.content}
                          onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                          disabled={block.is_locked}
                          rows={4}
                          placeholder="Prompt block content..."
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <Button onClick={handleAddBlock} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Block
        </Button>
      </CardContent>
    </Card>
  );
}

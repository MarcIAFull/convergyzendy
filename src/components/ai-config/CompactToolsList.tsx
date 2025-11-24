import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronRight, Settings2, Trash2, Info } from 'lucide-react';
import { AgentTool, AVAILABLE_TOOLS } from '@/types/agent';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToolParametersViewer } from './ToolParametersViewer';

interface CompactToolsListProps {
  tools: AgentTool[];
  onToggleTool: (toolName: string, enabled: boolean) => void;
  onUpdateTool: (toolName: string, updates: Partial<AgentTool>) => void;
  onDeleteTool: (toolName: string) => void;
}

export function CompactToolsList({ 
  tools, 
  onToggleTool, 
  onUpdateTool,
  onDeleteTool 
}: CompactToolsListProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingTool, setEditingTool] = useState<AgentTool | null>(null);
  const [viewingToolParams, setViewingToolParams] = useState<string | null>(null);
  const [usageRules, setUsageRules] = useState('');

  const enabledCount = tools.filter(t => t.enabled).length;

  const handleOpenSettings = (tool: AgentTool) => {
    setEditingTool(tool);
    setUsageRules(tool.usage_rules || '');
  };

  const handleSaveSettings = () => {
    if (editingTool) {
      onUpdateTool(editingTool.tool_name, { usage_rules: usageRules });
      setEditingTool(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle>Ferramentas & Capacidades</CardTitle>
            </div>
            <Badge variant="secondary">
              {enabledCount} ativas
            </Badge>
          </div>
          <CardDescription>
            Ferramentas disponíveis para o agente usar durante conversas
          </CardDescription>
        </CardHeader>

        {expanded && (
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {tools.map((tool) => {
                  const toolDef = AVAILABLE_TOOLS.find(t => t.name === tool.tool_name);
                  
                  return (
                    <div
                      key={tool.tool_name}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Switch
                          checked={tool.enabled}
                          onCheckedChange={(enabled) => onToggleTool(tool.tool_name, enabled)}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{toolDef?.label || tool.tool_name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {tool.description_override || toolDef?.description || 'Sem descrição'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setViewingToolParams(tool.tool_name)}
                          title="Ver parâmetros"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenSettings(tool)}
                          title="Regras de uso"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onDeleteTool(tool.tool_name)}
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        )}
      </Card>

      <Dialog open={!!editingTool} onOpenChange={(open) => !open && setEditingTool(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurações da Ferramenta</DialogTitle>
            <DialogDescription>
              {AVAILABLE_TOOLS.find(t => t.name === editingTool?.tool_name)?.label}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Regras de Uso (opcional)</Label>
              <Textarea
                value={usageRules}
                onChange={(e) => setUsageRules(e.target.value)}
                placeholder="Defina quando e como esta ferramenta deve ser usada..."
                className="min-h-[200px] mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Estas regras serão incluídas no prompt do sistema para guiar o uso da ferramenta
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingTool(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSettings}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {viewingToolParams && (
        <ToolParametersViewer
          toolName={viewingToolParams}
          open={!!viewingToolParams}
          onOpenChange={(open) => !open && setViewingToolParams(null)}
        />
      )}
    </>
  );
}

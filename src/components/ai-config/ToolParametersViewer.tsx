import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AVAILABLE_TOOLS } from '@/types/agent';

interface ToolParametersViewerProps {
  toolName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolParametersViewer({ toolName, open, onOpenChange }: ToolParametersViewerProps) {
  const tool = AVAILABLE_TOOLS.find(t => t.name === toolName);

  if (!tool) return null;

  const hasParams = tool.parameters && Object.keys(tool.parameters).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tool.label}</DialogTitle>
          <DialogDescription>{tool.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Parâmetros:</h4>
            
            {!hasParams ? (
              <p className="text-sm text-muted-foreground">Esta ferramenta não aceita parâmetros.</p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {Object.entries(tool.parameters).map(([paramName, paramInfo]: [string, any]) => (
                    <div key={paramName} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {paramName}
                        </code>
                        {paramInfo.required && (
                          <Badge variant="destructive" className="text-xs">
                            Obrigatório
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {paramInfo.type}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        {paramInfo.description}
                      </p>
                      
                      {paramInfo.enum && (
                        <div className="text-xs">
                          <strong>Valores permitidos:</strong>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {paramInfo.enum.map((value: string) => (
                              <code key={value} className="bg-muted px-2 py-0.5 rounded">
                                {value}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-2">Como a IA usa esta ferramenta:</h4>
            <p className="text-sm text-muted-foreground">
              A IA decide automaticamente quando chamar esta ferramenta baseado no contexto da conversa 
              e nas regras de orquestração configuradas. Os parâmetros são extraídos da mensagem do cliente.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb } from 'lucide-react';

interface UnifiedPromptEditorProps {
  prompt: string;
  onChange: (value: string) => void;
  previewContent?: string;
}

const TEMPLATE_VARIABLES = [
  { name: '{{restaurant_name}}', description: 'Nome do restaurante' },
  { name: '{{menu_products}}', description: 'Lista de produtos do menu' },
  { name: '{{cart_summary}}', description: 'Resumo do carrinho' },
  { name: '{{customer_info}}', description: 'Informações do cliente' },
  { name: '{{pending_items}}', description: 'Itens pendentes' },
  { name: '{{conversation_history}}', description: 'Histórico da conversa' },
  { name: '{{current_state}}', description: 'Estado atual' },
  { name: '{{user_intent}}', description: 'Intenção do usuário' },
  { name: '{{target_state}}', description: 'Estado alvo' },
  { name: '{{pending_product}}', description: 'Produto pendente' },
];

export function UnifiedPromptEditor({ prompt, onChange, previewContent }: UnifiedPromptEditorProps) {
  const [activeTab, setActiveTab] = useState('edit');

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Prompt</CardTitle>
        <CardDescription>
          Define o comportamento e personalidade do agente de IA
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="edit">Editar</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="variables">Variáveis</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[600px] font-mono text-sm"
              placeholder="Digite o prompt do sistema aqui..."
            />
            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Dicas:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>Use <code className="text-xs bg-background px-1 py-0.5 rounded">{'{{variavel}}'}</code> para inserir variáveis dinâmicas</li>
                  <li>Organize em seções com títulos marcados com #</li>
                  <li>Seja específico sobre quando usar cada ferramenta</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <ScrollArea className="h-[600px] border rounded-lg p-4 bg-muted/30">
              {previewContent ? (
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {previewContent}
                </pre>
              ) : (
                <div className="text-muted-foreground text-center py-20">
                  <p>Preview não disponível no momento</p>
                  <p className="text-sm mt-2">O prompt será processado em runtime</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="variables" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Variáveis disponíveis que serão substituídas automaticamente em runtime:
            </div>
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <div
                    key={variable.name}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      onChange(prompt + ' ' + variable.name);
                      setActiveTab('edit');
                    }}
                  >
                    <code className="text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                      {variable.name}
                    </code>
                    <p className="text-sm text-muted-foreground mt-2">
                      {variable.description}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

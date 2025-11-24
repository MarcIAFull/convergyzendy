import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb } from 'lucide-react';
import { PromptPreviewButton } from './PromptPreviewDialog';

interface UnifiedPromptEditorProps {
  prompt: string;
  onChange: (value: string) => void;
  agentId: string;
  previewContent?: string;
}

const TEMPLATE_VARIABLES = [
  { 
    name: '{{restaurant_name}}', 
    description: 'Nome do restaurante',
    example: 'Pizza da Casa'
  },
  { 
    name: '{{menu_products}}', 
    description: 'Lista completa de produtos disponíveis',
    example: '• Pizza Margherita (ID: abc-123) - €9.98\n• Brigadeiro (ID: def-456) - €2.50'
  },
  { 
    name: '{{cart_summary}}', 
    description: 'Resumo do carrinho atual',
    example: '2x Pizza Margherita (€19.96), 1x Água (€1.50) | Total: €21.46'
  },
  { 
    name: '{{customer_info}}', 
    description: 'Perfil do cliente salvo',
    example: 'Name: João Silva, Address: Rua X, Payment: card'
  },
  { 
    name: '{{conversation_history}}', 
    description: 'Últimas mensagens da conversa',
    example: 'Customer: Quero uma pizza\nAgent: Temos Margherita e Pepperoni...'
  },
  { 
    name: '{{current_state}}', 
    description: 'Estado atual da conversa',
    example: 'browsing_menu, confirming_item, providing_address'
  },
  { 
    name: '{{user_intent}}', 
    description: 'Intenção classificada pelo orquestrador',
    example: 'browse_product, confirm_item, finalize'
  },
  { 
    name: '{{target_state}}', 
    description: 'Estado alvo sugerido pelo orquestrador',
    example: 'confirming_item, collecting_address'
  },
  { 
    name: '{{pending_items}}', 
    description: 'Itens aguardando confirmação (pedidos múltiplos)',
    example: '2x Pizza Margherita, 1x Coca-Cola'
  }
];

export function UnifiedPromptEditor({ prompt, onChange, agentId, previewContent }: UnifiedPromptEditorProps) {
  const [activeTab, setActiveTab] = useState('edit');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>System Prompt</CardTitle>
            <CardDescription>
              Define o comportamento e personalidade do agente de IA
            </CardDescription>
          </div>
          <PromptPreviewButton prompt={prompt} agentId={agentId} />
        </div>
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
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer space-y-2"
                    onClick={() => {
                      onChange(prompt + ' ' + variable.name);
                      setActiveTab('edit');
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <code className="text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                        {variable.name}
                      </code>
                      <Badge variant="outline" className="text-xs">
                        Clique para inserir
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {variable.description}
                    </p>
                    <div className="bg-muted/50 p-2 rounded text-xs font-mono text-muted-foreground">
                      <strong>Exemplo:</strong> {variable.example}
                    </div>
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

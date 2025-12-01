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
  // === CONTEXTO BÁSICO ===
  { 
    name: '{{restaurant_name}}', 
    description: 'Nome do restaurante',
    example: 'Pizza da Casa'
  },
  { 
    name: '{{user_message}}', 
    description: 'Mensagem atual do cliente',
    example: 'Quero ver o cardápio de pizzas'
  },
  
  // === MENU (RAG) ===
  { 
    name: '{{menu_products}}', 
    description: 'Lista de produtos (formato RAG - apenas categorias)',
    example: '📋 CATEGORIAS: Pizzas Salgadas (12) | Bebidas (8) | Sobremesas (5)'
  },
  { 
    name: '{{menu_categories}}', 
    description: 'Lista de categorias disponíveis',
    example: 'Pizzas Salgadas | Pizzas Doces | Bebidas | Sobremesas'
  },
  { 
    name: '{{menu_url}}', 
    description: 'URL do menu público online',
    example: 'https://zendy.pt/menu/meu-restaurante'
  },
  
  // === CARRINHO & ESTADO ===
  { 
    name: '{{cart_summary}}', 
    description: 'Resumo do carrinho atual',
    example: '2x Pizza Margherita (€19.96) | Total: €19.96'
  },
  { 
    name: '{{current_state}}', 
    description: 'Estado atual da conversa',
    example: 'browsing_menu, confirming_item, collecting_address'
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
    description: 'Itens aguardando confirmação',
    example: '2x Pizza Margherita, 1x Coca-Cola'
  },
  
  // === CLIENTE ===
  { 
    name: '{{customer_info}}', 
    description: 'Perfil do cliente (RAG - status mínimo)',
    example: 'Name: João | 📍 Rua Augusta 123 | 🏆 VIP (5 pedidos)'
  },
  { 
    name: '{{conversation_history}}', 
    description: 'Últimas mensagens da conversa',
    example: 'Cliente: Olá\nAgente: Bem-vindo! Como posso ajudar?'
  },
  
  // === PERSONALIZAÇÃO DO RESTAURANTE ===
  { 
    name: '{{tone}}', 
    description: 'Tom de comunicação configurado',
    example: 'friendly, formal, playful, professional'
  },
  { 
    name: '{{greeting_message}}', 
    description: 'Mensagem de saudação personalizada',
    example: 'Olá! 👋 Bem-vindo ao Pizza da Casa!'
  },
  { 
    name: '{{closing_message}}', 
    description: 'Mensagem de despedida personalizada',
    example: 'Obrigado pela preferência! 🙏'
  },
  { 
    name: '{{upsell_aggressiveness}}', 
    description: 'Nível de upsell (low, medium, high)',
    example: 'medium'
  },
  { 
    name: '{{custom_instructions}}', 
    description: 'Instruções personalizadas do restaurante',
    example: 'Sempre ofereça bebidas com pizzas'
  },
  { 
    name: '{{business_rules}}', 
    description: 'Regras de negócio específicas',
    example: 'Pedido mínimo €10 para delivery'
  },
  { 
    name: '{{faq_responses}}', 
    description: 'Respostas para perguntas frequentes',
    example: 'Aceitamos PIX, cartão e dinheiro'
  },
  { 
    name: '{{special_offers_info}}', 
    description: 'Promoções e ofertas especiais',
    example: 'Promoção: 2 pizzas por €25!'
  },
  { 
    name: '{{unavailable_items_handling}}', 
    description: 'Como lidar com itens indisponíveis',
    example: 'Sugira alternativas similares'
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

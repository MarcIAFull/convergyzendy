import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Sparkles, Shield, Zap } from 'lucide-react';

export function PromptTemplateGuide() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Guia de Prompts Otimizados</CardTitle>
        </div>
        <CardDescription>
          Sistema completo de prompts com variáveis dinâmicas e segurança avançada
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview */}
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            Os prompts foram otimizados com <strong>8 seções estruturadas</strong> para o Orchestrator e 
            <strong> 7 seções</strong> para o Conversational AI, incluindo protocolos de segurança, 
            anti-hallucination, e workflows detalhados.
          </AlertDescription>
        </Alert>

        {/* Orchestrator Features */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            Orchestrator (Classificador de Intents)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Badge variant="secondary">12 Intents Definidos</Badge>
            <Badge variant="secondary">6 Estados Válidos</Badge>
            <Badge variant="secondary">Anti-Hallucination</Badge>
            <Badge variant="secondary">Confidence Scoring</Badge>
            <Badge variant="secondary">Context Analysis</Badge>
            <Badge variant="secondary">Pending Items Logic</Badge>
          </div>
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Responsabilidade:</strong> Classificar a intenção do usuário e determinar o próximo estado 
            da conversa. Não gera respostas, apenas analisa e classifica.
          </div>
        </div>

        {/* Conversational AI Features */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-500" />
            Conversational AI (Agente de Vendas)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Badge variant="secondary">13 Tools Disponíveis</Badge>
            <Badge variant="secondary">5 Workflows Completos</Badge>
            <Badge variant="secondary">Humanização Radical</Badge>
            <Badge variant="secondary">Zero Roboticês</Badge>
            <Badge variant="secondary">Addon Handling</Badge>
            <Badge variant="secondary">Customer Profile</Badge>
          </div>
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Responsabilidade:</strong> Conversar naturalmente em português, executar tools, 
            gerenciar carrinho e pending items, e finalizar pedidos.
          </div>
        </div>

        {/* Key Improvements */}
        <div className="space-y-2">
          <h3 className="font-semibold">Principais Melhorias dos Prompts</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Estrutura Clara:</strong> Seções numeradas e organizadas por prioridade</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Addons com UUID:</strong> IDs dos addons agora aparecem explicitamente no menu</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Pending Items:</strong> Lógica detalhada para pedidos múltiplos (3 tools)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Workflows:</strong> 5 fluxos completos documentados com exemplos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Anti-Jailbreak:</strong> Protocolos de segurança contra manipulação</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Linguagem Natural:</strong> Lista de palavras proibidas e substituições</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>13 Tools Documentadas:</strong> Cada tool com propósito, quando usar, e parâmetros</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Confidence Rules:</strong> Regras claras para níveis de confiança (0.1-1.0)</span>
            </li>
          </ul>
        </div>

        {/* Variables */}
        <div className="space-y-2">
          <h3 className="font-semibold">Variáveis Disponíveis</h3>
          <div className="grid grid-cols-3 gap-2">
            <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              {`{{restaurant_name}}`}
            </code>
            <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              {`{{menu_products}}`}
            </code>
            <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              {`{{cart_summary}}`}
            </code>
            <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              {`{{customer_info}}`}
            </code>
            <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              {`{{pending_items}}`}
            </code>
            <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              {`{{conversation_history}}`}
            </code>
            <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              {`{{current_state}}`}
            </code>
            <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              {`{{user_intent}}`}
            </code>
            <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              {`{{target_state}}`}
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Estas variáveis são substituídas automaticamente em runtime pelo context-builder
          </p>
        </div>

        {/* How to Edit */}
        <div className="space-y-2">
          <h3 className="font-semibold">Como Editar os Prompts</h3>
          <ol className="text-sm space-y-2 text-muted-foreground">
            <li>1. Selecione o agente desejado no dropdown acima (Orchestrator ou Conversational AI)</li>
            <li>2. Edite o prompt na aba "Editar" do System Prompt</li>
            <li>3. Use a aba "Variáveis" para inserir variáveis clicando nelas</li>
            <li>4. Clique em "Salvar Configuração" para aplicar as mudanças</li>
            <li>5. As mudanças serão aplicadas imediatamente nas próximas conversas</li>
          </ol>
        </div>

        {/* Best Practices */}
        <div className="space-y-2">
          <h3 className="font-semibold">Boas Práticas</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p>✅ <strong>Mantenha a estrutura de seções</strong> - facilita manutenção</p>
            <p>✅ <strong>Use variáveis em vez de hardcode</strong> - permite personalização por restaurante</p>
            <p>✅ <strong>Teste após cada mudança</strong> - envie mensagens teste via WhatsApp</p>
            <p>✅ <strong>Documente tools claramente</strong> - quando usar e quais parâmetros</p>
            <p>❌ <strong>Não remova protocolos de segurança</strong> - são críticos</p>
            <p>❌ <strong>Não invente tools</strong> - use apenas as 13 disponíveis</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
# 🔍 Diagnóstico Completo: Módulo AI Configuration

## 📊 Status Atual

### ✅ O Que Está Funcionando

1. **Estrutura Base Sólida**
   - Sistema de agentes (Orchestrator + Conversational AI) ✅
   - Prompt blocks no banco de dados ✅
   - Tools configuráveis no banco ✅
   - Template variables funcionais no backend ✅
   - Integration com OpenAI API ✅

2. **Arquitetura Backend**
   - Context Builder unificado ✅
   - Aplicação de template variables no runtime ✅
   - Sistema de fallback para prompts ✅
   - Carregamento dinâmico de configurações ✅

### ❌ Problemas Críticos Identificados

## 1. 🚨 TOOLS FALTANDO NO FRONTEND

### **Problema:**
O frontend `src/types/agent.ts` tem apenas **9 tools** listadas, mas o backend `base-tools.ts` tem **13 tools** implementadas.

### **Tools que EXISTEM no backend mas NÃO APARECEM no UI:**

```typescript
// FALTAM NO AVAILABLE_TOOLS DO FRONTEND:
- clear_cart           ❌ Não aparece no UI
- show_cart            ❌ Não aparece no UI  
- search_menu          ❌ Não aparece no UI
- remove_pending_item  ❌ Não aparece no UI
```

### **Impacto:**
- Usuários não conseguem habilitar ferramentas críticas
- search_menu é essencial para buscas difusas (typos, categorias genéricas)
- clear_cart é importante para resetar carrinhos
- show_cart é útil para debugging

### **Solução:**
Sincronizar `AVAILABLE_TOOLS` em `src/types/agent.ts` com `BASE_TOOLS` de `base-tools.ts`

---

## 2. 🚨 VARIÁVEIS DE TEMPLATE INCOMPLETAS

### **Problema:**
O `UnifiedPromptEditor.tsx` mostra apenas **10 variáveis**, mas o sistema usa **MAIS variáveis** que não estão documentadas.

### **Variáveis Documentadas no UI:**
```typescript
TEMPLATE_VARIABLES = [
  {{restaurant_name}},
  {{menu_products}},
  {{cart_summary}},
  {{customer_info}},
  {{pending_items}},
  {{conversation_history}},
  {{current_state}},
  {{user_intent}},
  {{target_state}},
  {{pending_product}}  // Esta nem é usada no backend!
]
```

### **Variáveis que EXISTEM mas NÃO ESTÃO DOCUMENTADAS:**
```typescript
// NO CONTEXT-BUILDER.TS:
formatted.menu          // Formato detalhado do menu
formatted.cart          // Formato do carrinho
formatted.customer      // Info do cliente formatada
formatted.history       // Histórico formatado
formatted.pendingItems  // Pending items formatados

// VARIÁVEIS REAIS USADAS NO BACKEND:
{{menu_products}}       // Usa formatted.menu
{{cart_summary}}        // Usa formatted.cart
{{customer_info}}       // Usa formatted.customer
{{conversation_history}} // Usa formatted.history
{{pending_items}}       // Usa formatted.pendingItems
```

### **Impacto:**
- Usuários não sabem quais variáveis estão disponíveis
- Variável {{pending_product}} está no UI mas nunca é usada
- Falta de consistência entre nomes de variáveis

### **Solução:**
1. Remover variáveis não usadas
2. Adicionar todas as variáveis reais
3. Mostrar exemplos do output de cada variável

---

## 3. 🚨 FALTA PREVIEW DO PROMPT FINAL

### **Problema:**
Usuário edita o prompt com variáveis `{{restaurant_name}}`, mas **NÃO VÊ** como ficará o prompt final processado.

### **Exemplo:**
```
Usuário escreve:
"Você atende no {{restaurant_name}} e tem estes produtos: {{menu_products}}"

Mas NÃO VÊ que isso se transforma em:
"Você atende no Pizza da Casa e tem estes produtos:
• Pizza Margherita (ID: abc-123) - €9.98
• Brigadeiro (ID: def-456) - €2.50
..."
```

### **Impacto:**
- Impossível testar se as variáveis estão corretas
- Usuário não sabe se formatação está boa
- Debugging extremamente difícil

### **Solução:**
Adicionar tab "Preview Processado" que substitui as variáveis com dados de exemplo

---

## 4. 🚨 SYSTEM PROMPT vs PROMPT BLOCKS

### **Problema:**
Confusão sobre quando usar `base_system_prompt` vs `agent_prompt_blocks`

### **Análise do Código:**
```typescript
// NO whatsapp-ai-agent/index.ts (linha 195):
const orchestratorSystemPrompt = buildSystemPromptFromBlocks(
  orchestratorPromptBlocks,  // Vem do DB
  orchestratorFallbackPrompt // Fallback hard-coded
);

// Mas base_system_prompt do agent NUNCA é usado!
```

### **Descoberta:**
O campo `base_system_prompt` na tabela `agents` **EXISTE MAS NÃO É USADO**. O sistema usa apenas `agent_prompt_blocks`.

### **Impacto:**
- Campo inútil no banco de dados
- Confusão conceitual sobre onde editar o prompt
- Usuário pode pensar que está editando algo que não funciona

### **Solução:**
1. Remover campo `base_system_prompt` da tabela
2. Usar apenas `agent_prompt_blocks`
3. Clarificar no UI que é o único lugar para editar prompts

---

## 5. 🚨 FALTA CONFIGURAÇÃO DE ORCHESTRATION RULES

### **Problema:**
`orchestration_config` existe no banco mas **NÃO TEM UI** para editar.

### **Estrutura Atual:**
```typescript
// agents.orchestration_config:
{
  intents: {
    browse_product: {
      allowed_tools: ["search_menu", "add_to_cart"],
      decision_hint: "Use search_menu if product name is vague"
    }
  }
}
```

### **Onde está usado:**
```typescript
// whatsapp-ai-agent/index.ts (linha 213-219)
if (orchestrationConfig?.intents) {
  orchestratorSystemPrompt += buildOrchestrationRulesSection(orchestrationConfig.intents);
}
```

### **Impacto:**
- Usuários não podem configurar quais tools são permitidas por intent
- Não podem adicionar decision hints
- Configuração crítica está escondida

### **Solução:**
Criar UI para editar orchestration_config com:
- Lista de intents
- Checkboxes de allowed_tools por intent
- Campo de texto para decision_hint

---

## 6. 🚨 BEHAVIOR CONFIG SEM VALIDAÇÃO

### **Problema:**
`BehaviorConfigCard` permite editar JSON bruto mas **SEM VALIDAÇÃO**.

### **Código Atual:**
```typescript
// BehaviorConfigCard.tsx:
<Textarea value={configJson} onChange={handleJsonChange} />

// Se JSON inválido:
setError("Erro ao fazer parse do JSON");
// Mas SALVA MESMO ASSIM!
```

### **Impacto:**
- Usuário pode salvar JSON inválido
- Pode quebrar o agente em runtime
- Sem feedback do que está errado

### **Solução:**
1. Adicionar validação de schema Zod
2. Bloquear salvamento se JSON inválido
3. Criar UI estruturada ao invés de JSON bruto

---

## 7. 🚨 FERRAMENTAS SEM DESCRIÇÃO DE PARÂMETROS

### **Problema:**
UI mostra tools mas **NÃO MOSTRA** quais parâmetros cada tool aceita.

### **Exemplo:**
```
No UI aparece:
"Add to Cart - Add a product to the shopping cart"

Mas usuário NÃO VÊ que aceita:
- product_id (required)
- quantity (optional)
- addon_ids (optional)  
- notes (optional)
```

### **Impacto:**
- Usuário não sabe como a IA vai usar cada tool
- Impossível entender o que cada parâmetro faz
- Dificulta debugging de problemas

### **Solução:**
Expandir tool card para mostrar parâmetros completos do base-tools.ts

---

## 8. 📝 FALTA DE DOCUMENTAÇÃO INLINE

### **Problema:**
Não há tooltips, exemplos ou ajuda contextual no UI.

### **O que falta:**
- ❌ Exemplos de prompts bons vs ruins
- ❌ Explicação de quando usar cada variável
- ❌ Guia de melhores práticas
- ❌ Exemplos de orchestration rules
- ❌ Documentação de recovery messages

### **Solução:**
Adicionar tooltips e seções "Ajuda" em cada card

---

## 🎯 Plano de Ação Priorizado

### **FASE 1: Correções Críticas (2-3 horas)**

1. **Sincronizar Tools Frontend/Backend**
   ```typescript
   // Adicionar em src/types/agent.ts:
   {
     name: 'clear_cart',
     label: 'Clear Cart',
     description: 'Clear all items from cart'
   },
   {
     name: 'show_cart',
     label: 'Show Cart',
     description: 'Display current cart to customer'
   },
   {
     name: 'search_menu',
     label: 'Search Menu',
     description: 'Search products by name/category/typo'
   },
   {
     name: 'remove_pending_item',
     label: 'Remove Pending Item',
     description: 'Remove item from pending list'
   }
   ```

2. **Corrigir Template Variables**
   ```typescript
   // Atualizar TEMPLATE_VARIABLES em UnifiedPromptEditor.tsx:
   const TEMPLATE_VARIABLES = [
     { name: '{{restaurant_name}}', description: 'Nome do restaurante', example: 'Pizza da Casa' },
     { name: '{{menu_products}}', description: 'Lista completa de produtos', example: '• Pizza Margherita (ID: abc) - €9.98...' },
     { name: '{{cart_summary}}', description: 'Resumo do carrinho atual', example: '2x Pizza Margherita (€19.96), Total: €19.96' },
     { name: '{{customer_info}}', description: 'Perfil do cliente', example: 'Name: João, Address: Rua X, Payment: card' },
     { name: '{{conversation_history}}', description: 'Últimas 10 mensagens', example: 'Customer: Quero pizza\nAgent: Temos...' },
     { name: '{{current_state}}', description: 'Estado atual da conversa', example: 'browsing_menu' },
     { name: '{{user_intent}}', description: 'Intenção classificada', example: 'browse_product' },
     { name: '{{target_state}}', description: 'Estado alvo sugerido', example: 'confirming_item' },
     { name: '{{pending_items}}', description: 'Itens aguardando confirmação', example: '2x Pizza Margherita, 1x Água' },
   ];
   ```

3. **Remover base_system_prompt da tabela agents**
   ```sql
   ALTER TABLE agents DROP COLUMN base_system_prompt;
   ```

### **FASE 2: Melhorias de UX (3-4 horas)**

1. **Preview Processado**
   - Adicionar tab "Preview Real" no UnifiedPromptEditor
   - Buscar dados reais do restaurante do usuário
   - Substituir variáveis com dados de exemplo
   - Mostrar prompt final como a IA verá

2. **Tool Parameters Viewer**
   - Expandir CompactToolsList para mostrar parâmetros
   - Buscar definição completa de base-tools.ts
   - Renderizar schema de parâmetros
   - Adicionar exemplos de uso

3. **Validation Layer**
   - Adicionar Zod schema para behavior_config
   - Validar JSON antes de salvar
   - Mostrar erros específicos
   - Bloquear salvamento se inválido

### **FASE 3: Features Avançadas (4-5 horas)**

1. **Orchestration Rules UI**
   - Criar novo componente OrchestrationRulesEditor
   - Lista de intents com configuração individual
   - Checkboxes de allowed_tools
   - Campo de decision_hint por intent

2. **Template Variables Helper**
   - Autocomplete ao digitar {{
   - Sugestões contextuais
   - Validação de variáveis usadas
   - Warning se variável não existe

3. **Prompt Examples Library**
   - Biblioteca de prompts pré-configurados
   - Exemplos para diferentes tipos de negócio
   - Import/Export de configurações
   - Templates comunitários

### **FASE 4: Documentação (2 horas)**

1. **Tooltips & Help**
   - Adicionar (?) icons com explicações
   - Tooltips em cada campo
   - Links para documentação externa
   - Vídeos tutoriais inline

2. **Best Practices Guide**
   - Seção "Como Escrever um Bom Prompt"
   - Exemplos de do's and don'ts
   - Guia de troubleshooting
   - FAQ inline

---

## 🔥 Issues Mais Críticas para Resolver AGORA

### **Top 3 Bloqueadores:**

1. **Tools Faltando no UI** 🔴 (30 min)
   - Impede uso de 4 ferramentas importantes
   - Fix: Adicionar em AVAILABLE_TOOLS

2. **Variáveis Incorretas** 🔴 (30 min)
   - Confunde usuários sobre o que usar
   - Fix: Corrigir TEMPLATE_VARIABLES

3. **Sem Preview do Prompt** 🟡 (2h)
   - Impossível testar configurações
   - Fix: Implementar preview com substituição

---

## 📊 Comparação: Estado Atual vs Ideal

| Feature | Atual | Ideal | Prioridade |
|---------|-------|-------|------------|
| Tools disponíveis no UI | 9/13 (69%) | 13/13 (100%) | 🔴 CRÍTICA |
| Variáveis documentadas | 9 (1 inválida) | 9 (todas válidas) | 🔴 CRÍTICA |
| Preview do prompt | ❌ | ✅ Com dados reais | 🟡 ALTA |
| Validação de JSON | ⚠️ Parcial | ✅ Completa | 🟡 ALTA |
| Orchestration UI | ❌ | ✅ Interface visual | 🟢 MÉDIA |
| Tool parameters | ❌ | ✅ Schema completo | 🟢 MÉDIA |
| Documentação inline | ❌ | ✅ Tooltips + exemplos | 🟢 MÉDIA |
| Prompt examples | ❌ | ✅ Biblioteca | 🔵 BAIXA |

---

## 💡 Recomendações Arquiteturais

### **1. Unificar Definições de Tools**

**Problema:** Tools definidas em 2 lugares (base-tools.ts e agent.ts)

**Solução:** Criar single source of truth
```typescript
// src/config/tools.ts
export const TOOL_DEFINITIONS = {
  add_to_cart: {
    name: 'add_to_cart',
    label: 'Add to Cart',
    description: 'Add product to cart',
    parameters: { /* OpenAI schema */ },
    examples: ['User: "Quero pizza" → add_to_cart(...)']
  }
  // ...
}

// Usar em:
// - Frontend UI (AVAILABLE_TOOLS)
// - Backend base-tools.ts (BASE_TOOLS)
// - Documentação
```

### **2. Type-Safe Template Variables**

**Problema:** Variáveis são strings soltas, sem type checking

**Solução:** Criar tipo para variáveis
```typescript
type TemplateVariable = 
  | 'restaurant_name'
  | 'menu_products'
  | 'cart_summary'
  // ...

function applyTemplateVariables(
  prompt: string,
  variables: Record<TemplateVariable, string>
): string {
  // Type-safe replacement
}
```

### **3. Configuration Presets**

**Problema:** Começar do zero é difícil

**Solução:** Templates pré-configurados
```typescript
const AGENT_PRESETS = {
  'pizza-delivery': {
    name: 'Pizza Delivery Bot',
    prompt: '...',
    tools: ['add_to_cart', 'set_delivery_address'],
    behavior: { upsell: 'high' }
  },
  'coffee-shop': { /* ... */ }
}
```

---

## 🎓 Conclusão

### **O módulo tem uma base sólida mas precisa de:**

1. ✅ Sincronização frontend/backend (tools e variáveis)
2. ✅ Preview funcional do prompt processado
3. ✅ UI para orchestration rules
4. ✅ Validação robusta de configurações
5. ✅ Documentação inline e exemplos

### **Prioridade de Implementação:**

```
AGORA (30min):  Sincronizar tools e variáveis
HOJE (2h):      Implementar preview do prompt
ESTA SEMANA:    UI para orchestration + validação
PRÓXIMA SEMANA: Documentação e presets
```

### **Após implementação:**

- ✅ Usuários verão TODAS as tools disponíveis
- ✅ Variáveis serão corretas e documentadas
- ✅ Preview mostrará prompt final real
- ✅ Configuração será mais intuitiva
- ✅ Menos erros de configuração

---

## 📝 Próximos Passos

1. **Revisar este diagnóstico** com você
2. **Priorizar** quais correções implementar primeiro
3. **Implementar** FASE 1 (correções críticas)
4. **Testar** com dados reais
5. **Iterar** baseado em feedback

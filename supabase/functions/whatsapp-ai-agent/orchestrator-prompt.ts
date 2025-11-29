/**
 * Order Orchestrator V4 - Intent & State Classification
 * 
 * CHANGELOG V4:
 * - Integração RAG com customer_insights
 * - Contexto de cliente para melhor classificação
 * - Detecção inteligente de cliente retornante
 * 
 * CHANGELOG V3:
 * - PRIORIDADE MÁXIMA para detecção de endereços (regex patterns)
 * - Melhoria na diferenciação navegação vs. compra
 * - Otimização para arquitetura RAG
 */

export function buildOrchestratorPrompt(context: {
  userMessage: string;
  currentState: string;
  cartItems: any[];
  cartTotal: number;
  menuProducts: any[];
  restaurantName: string;
  conversationHistory: any[];
  pendingItems?: any[];
  customerInsights?: any | null;
  customer?: any | null;
}): string {
  const { 
    userMessage,
    currentState, 
    cartItems, 
    cartTotal, 
    menuProducts, 
    restaurantName,
    conversationHistory,
    pendingItems = [],
    customerInsights = null,
    customer = null
  } = context;

  // Extract categories only (RAG architecture)
  const categories = [...new Set(
    menuProducts
      .filter(p => p && p.category)
      .map(p => p.category)
  )].sort();

  const cartSummary = cartItems.length > 0 
    ? cartItems.map(item => `${item.quantity}x ${item.product_name} (€${item.total_price})`).join(', ')
    : 'Carrinho vazio';

  const pendingSummary = pendingItems.length > 0
    ? pendingItems.map(item => `${item.quantity}x ${item.product_name || item.product?.name || '?'}`).join(', ')
    : 'Nenhum item pendente';

  // Last 5 messages for context
  const recentHistory = conversationHistory
    .slice(-5)
    .map(m => `${m.role === 'user' ? 'C' : 'A'}: ${m.content}`)
    .join('\n');

  // ============================================================
  // CUSTOMER CONTEXT (RAG)
  // ============================================================
  const customerStatus = customerInsights && customerInsights.order_count > 0
    ? (customerInsights.order_count >= 5 ? 'VIP' : 
       customerInsights.order_count >= 2 ? 'Retornante' : 'Segundo pedido')
    : 'Novo';
  
  const customerName = customer?.name || null;
  const hasDefaultAddress = !!customer?.default_address;
  const hasDefaultPayment = !!customer?.default_payment_method;
  const favoriteItems = customerInsights?.preferred_items?.slice(0, 2).map((i: any) => i.name) || [];

  // ============================================================
  // ADDRESS DETECTION PATTERNS (Pre-processed)
  // ============================================================
  const addressPatterns = [
    /\brua\b/i,
    /\bavenida\b/i,
    /\bav\.\s/i,
    /\btravessa\b/i,
    /\blargo\b/i,
    /\bpraça\b/i,
    /\bn[º°]?\s*\d+/i,      // nº 22, n 22
    /,\s*\d+/,               // , 22
    /\d{4}-\d{3}/,           // Código postal PT
    /\bapartamento\b/i,
    /\bbloco\b/i,
    /\bandarp/i,
    /\bporta\b/i,
  ];
  const looksLikeAddress = addressPatterns.some(p => p.test(userMessage));

  // ============================================================
  // PAYMENT DETECTION PATTERNS
  // ============================================================
  const paymentPatterns = [
    /\bdinheiro\b/i,
    /\bcash\b/i,
    /\bcartão\b/i,
    /\bcard\b/i,
    /\bmbway\b/i,
    /\bmb\s*way\b/i,
    /\bmultibanco\b/i,
    /\bvisa\b/i,
    /\bmastercard\b/i,
    /\bna entrega\b/i,
  ];
  const looksLikePayment = paymentPatterns.some(p => p.test(userMessage));

  // ============================================================
  // RETURNING CUSTOMER PATTERNS
  // ============================================================
  const returningPatterns = [
    /\bo (de )?sempre\b/i,    // "o de sempre"
    /\bmesmo (de )?sempre\b/i,
    /\bcomo (da )?última (vez)?\b/i,
    /\brepetir?\b/i,
    /\bigual\b/i,
  ];
  const wantsUsualOrder = returningPatterns.some(p => p.test(userMessage)) && customerInsights?.order_count > 0;

  return `# ═══════════════════════════════════════════════════════════════
# ORCHESTRATOR V4 - CLASSIFICADOR DE INTENÇÃO (RAG + Customer History)
# Restaurante: ${restaurantName}
# ═══════════════════════════════════════════════════════════════

## 🎯 SUA ÚNICA FUNÇÃO
Você é um classificador puro. Analise a mensagem e retorne JSON.

**VOCÊ É:** Analisador de contexto, reconhecedor de padrões
**VOCÊ NÃO É:** Gerador de respostas, executor de tools

## OUTPUT OBRIGATÓRIO (JSON único, sem markdown)
\`\`\`json
{
  "intent": "<um dos 13 intents>",
  "target_state": "<um dos 6 estados>",
  "confidence": 0.0-1.0,
  "reasoning": "<explicação breve>"
}
\`\`\`

# ═══════════════════════════════════════════════════════════════
# 👤 PERFIL DO CLIENTE (RAG)
# ═══════════════════════════════════════════════════════════════

| Campo | Valor |
|-------|-------|
| **Status** | ${customerStatus} |
| **Nome** | ${customerName || 'Não informado'} |
| **Endereço salvo** | ${hasDefaultAddress ? '✅ Sim' : '❌ Não'} |
| **Pagamento salvo** | ${hasDefaultPayment ? '✅ Sim' : '❌ Não'} |
| **Favoritos** | ${favoriteItems.length > 0 ? favoriteItems.join(', ') : 'N/A'} |
| **Pedidos anteriores** | ${customerInsights?.order_count || 0} |

${wantsUsualOrder ? `
### ⚠️ CLIENTE QUER REPETIR PEDIDO
O cliente disse algo como "o de sempre" e TEM histórico.
Favoritos: ${favoriteItems.join(', ') || 'verificar histórico'}

**CLASSIFICAR COMO:**
\`\`\`json
{
  "intent": "repeat_order",
  "target_state": "confirming_item",
  "confidence": 0.90,
  "reasoning": "Cliente retornante quer repetir pedido anterior"
}
\`\`\`
` : ''}

# ═══════════════════════════════════════════════════════════════
# 🚨 PRIORIDADE MÁXIMA: DETECÇÃO DE ENDEREÇO
# ═══════════════════════════════════════════════════════════════

**Mensagem do usuário:** "${userMessage}"

**Parece endereço?** ${looksLikeAddress ? '✅ SIM - PRIORIDADE MÁXIMA' : '❌ NÃO'}
**Parece pagamento?** ${looksLikePayment ? '✅ SIM - ALTA PRIORIDADE' : '❌ NÃO'}

${looksLikeAddress ? `
### ⚠️ ENDEREÇO DETECTADO - REGRA ESPECIAL

A mensagem contém padrões de endereço (Rua, Av, número, código postal).

**VOCÊ DEVE CLASSIFICAR:**
\`\`\`json
{
  "intent": "provide_address",
  "target_state": "collecting_payment",
  "confidence": 0.95,
  "reasoning": "Mensagem contém padrões de endereço (${userMessage.match(/rua|avenida|av\.|,\s*\d+|\d{4}-\d{3}/gi)?.join(', ') || 'detectado'})"
}
\`\`\`

❌ **NÃO CLASSIFIQUE COMO:**
- browse_product (mesmo que pareça nome de comida)
- collect_customer_data (não é nome de pessoa)
- unclear
` : ''}

${looksLikePayment ? `
### ⚠️ PAGAMENTO DETECTADO

A mensagem contém método de pagamento.

**VOCÊ DEVE CLASSIFICAR:**
\`\`\`json
{
  "intent": "provide_payment",
  "target_state": "ready_to_order",
  "confidence": 0.90,
  "reasoning": "Usuário informou método de pagamento"
}
\`\`\`
` : ''}

# ═══════════════════════════════════════════════════════════════
# CONTEXTO ATUAL
# ═══════════════════════════════════════════════════════════════

| Campo | Valor |
|-------|-------|
| **Estado atual** | ${currentState} |
| **Carrinho** | ${cartSummary} (€${cartTotal.toFixed(2)}) |
| **Pendentes** | ${pendingSummary} |
| **Categorias** | ${categories.join(', ')} |

**Conversa recente:**
${recentHistory || 'Primeira mensagem'}

# ═══════════════════════════════════════════════════════════════
# INTENTS VÁLIDOS (13 Total)
# ═══════════════════════════════════════════════════════════════

## 1. \`provide_address\` ⭐ PRIORIDADE MÁXIMA
**Trigger:** Qualquer texto que pareça localização
- Padrões: Rua, Av., Travessa, número após vírgula, código postal
- **IGNORAR contexto anterior** se detectar endereço
- Confidence alta se padrão detectado

## 2. \`provide_payment\`
**Trigger:** Método de pagamento mencionado
- dinheiro, cash, cartão, mbway, multibanco, visa

## 3. \`repeat_order\` ⭐ CLIENTE RETORNANTE
**Trigger:** Cliente quer o pedido habitual
- "o de sempre", "igual última vez", "repetir pedido"
- **PRÉ-REQUISITO:** customer tem histórico (order_count > 0)
- Se não tem histórico → tratar como browse_menu

## 4. \`browse_menu\`
**Trigger:** Pedidos genéricos
- "cardápio", "o que tem?", "menu", "opções"

## 5. \`browse_product\` ⭐ IMPORTANTE
**Trigger:** Usuário menciona comida, bebida ou categoria específica
- "Quero uma coca", "Tem pizza de bacon?", "Me fala dos hamburguers"
- "Quais bebidas tem?", "Mostra as pizzas", "Quanto custa X?"
- **Regra:** Mesmo que diga "Quero..." (parece compra), se precisa buscar o item → \`browse_product\`
- **MAS NÃO** se parecer endereço!
- **Confidence:** ≥ 0.75 se mencionar categoria ou item alimentício

## 6. \`confirm_item\`
**Trigger:** Confirmação de 1 item
- "sim", "quero", "pode ser" (após oferta do agente)
- Apenas 1 item pendente

## 7. \`manage_pending_items\`
**Trigger:** Múltiplos produtos mencionados
- "pizza, coca e brigadeiro"
- "mais uma água também"

## 8. \`confirm_pending_items\`
**Trigger:** Confirmar lista de pendentes
- "confirmo tudo", "sim, esses"
- Após agente listar 2+ itens

## 9. \`modify_cart\`
**Trigger:** Remover itens
- "tira", "remove", "cancela X"

## 10. \`finalize\`
**Trigger:** Finalizar pedido
- "confirmar pedido", "fechar", "pronto"
- **PRÉ-REQUISITO:** carrinho > 0

## 11. \`ask_question\`
**Trigger:** Perguntas informativas
- "fazem entregas?", "horário?", "taxa?"

## 12. \`collect_customer_data\`
**Trigger:** Nome ou preferências
- "sou o João", "meu nome é..."
- **NÃO** para endereços!

## 13. \`unclear\`
**Trigger:** APENAS para inputs completamente ininteligíveis
- Exemplos válidos: "asdf", "iry", silêncio, "????"
- **PROIBIDO usar unclear se:** a mensagem contém QUALQUER palavra de comida/bebida
- Se houver dúvida entre unclear e browse_product → use \`browse_product\`
- **Confidence obrigatória ≤ 0.4**

# ═══════════════════════════════════════════════════════════════
# ESTADOS VÁLIDOS (6 Total)
# ═══════════════════════════════════════════════════════════════

1. \`idle\` - Conversa geral
2. \`browsing_menu\` - Explorando menu
3. \`confirming_item\` - Confirmando produto(s)
4. \`collecting_address\` - Aguardando endereço
5. \`collecting_payment\` - Aguardando pagamento
6. \`ready_to_order\` - Pronto para finalizar

## Transições esperadas:
- provide_address → collecting_payment
- provide_payment → ready_to_order
- finalize → idle (pedido fechado)
- repeat_order → confirming_item

# ═══════════════════════════════════════════════════════════════
# EXEMPLOS DE CLASSIFICAÇÃO
# ═══════════════════════════════════════════════════════════════

### Exemplo 1: Endereço (PRIORIDADE)
Mensagem: "Rua das Flores, 22"
Estado: browsing_menu
\`\`\`json
{
  "intent": "provide_address",
  "target_state": "collecting_payment",
  "confidence": 0.95,
  "reasoning": "Contém padrão de endereço (Rua + número)"
}
\`\`\`

### Exemplo 2: Pagamento
Mensagem: "Dinheiro"
Estado: collecting_payment
\`\`\`json
{
  "intent": "provide_payment",
  "target_state": "ready_to_order",
  "confidence": 0.92,
  "reasoning": "Método de pagamento identificado"
}
\`\`\`

### Exemplo 3: Pedido
Mensagem: "Quero uma margherita"
Estado: idle
\`\`\`json
{
  "intent": "browse_product",
  "target_state": "confirming_item",
  "confidence": 0.88,
  "reasoning": "Produto específico solicitado"
}
\`\`\`

### Exemplo 4: Múltiplos
Mensagem: "Pizza, coca e sobremesa"
Estado: idle
\`\`\`json
{
  "intent": "manage_pending_items",
  "target_state": "confirming_item",
  "confidence": 0.90,
  "reasoning": "3 produtos mencionados"
}
\`\`\`

### Exemplo 5: Confirmação
Mensagem: "Sim"
Contexto: Agente ofereceu Pizza Margherita
\`\`\`json
{
  "intent": "confirm_item",
  "target_state": "confirming_item",
  "confidence": 0.85,
  "reasoning": "Confirmação após oferta de produto"
}
\`\`\`

### Exemplo 6: Repetir Pedido (Cliente Retornante)
Mensagem: "O de sempre"
Cliente: VIP (5 pedidos), favoritos: [Pizza Margherita, Coca-Cola]
\`\`\`json
{
  "intent": "repeat_order",
  "target_state": "confirming_item",
  "confidence": 0.90,
  "reasoning": "Cliente retornante quer repetir pedido habitual"
}
\`\`\`

# ═══════════════════════════════════════════════════════════════
# ⚠️ REGRAS CRÍTICAS
# ═══════════════════════════════════════════════════════════════

1. **Se parece endereço → provide_address** (ignore o resto)
2. **Se parece pagamento → provide_payment**
3. **Se cliente retornante diz "o de sempre" → repeat_order**
4. **unclear deve ter confidence ≤ 0.4**
5. **finalize só se carrinho > 0**
6. **Retorne APENAS o JSON, nada mais**

Agora analise a mensagem e classifique:`;
}

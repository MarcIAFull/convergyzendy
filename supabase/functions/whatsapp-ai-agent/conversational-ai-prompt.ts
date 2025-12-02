/**
 * CONVERSATIONAL AI SYSTEM PROMPT V15 - MÁQUINA DE VENDAS ATIVA
 * 
 * CHANGELOG V15:
 * - Prompt compacto e focado em vendas
 * - Fluxo de funil otimizado (endereço → pagamento → finalização)
 * - Upsell integrado após cada adição
 * - Checklist de validação simplificado
 */

export function buildConversationalAIPrompt(context: {
  restaurantName: string;
  menuProducts: any[];
  cartItems: any[];
  cartTotal: number;
  currentState: string;
  userIntent: string;
  targetState: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  customer: any | null;
  pendingItems: any[];
  // Restaurant AI Settings
  tone?: string;
  greetingMessage?: string;
  closingMessage?: string;
  upsellAggressiveness?: string;
  maxAdditionalQuestions?: number;
  language?: string;
  customInstructions?: string;
  businessRules?: string;
  faqResponses?: string;
  unavailableItemsHandling?: string;
  specialOffersInfo?: string;
  // RAG extras
  menuUrl?: string;
}): string {
  const { 
    restaurantName, 
    menuProducts, 
    cartItems, 
    cartTotal, 
    currentState,
    userIntent,
    targetState,
    conversationHistory,
    customer,
    pendingItems,
    // Settings
    tone = 'friendly',
    greetingMessage,
    closingMessage,
    upsellAggressiveness = 'medium',
    maxAdditionalQuestions = 2,
    language = 'pt',
    customInstructions,
    businessRules,
    faqResponses,
    unavailableItemsHandling,
    specialOffersInfo,
    menuUrl = ''
  } = context;

  // ============================================================
  // EXTRACT CATEGORIES (RAG - no full menu)
  // ============================================================
  const categories = [...new Set(
    menuProducts
      .filter(p => p && p.category)
      .map(p => p.category)
  )].sort();

  // ============================================================
  // FORMAT CONTEXT
  // ============================================================
  const cartSummary = cartItems.length > 0
    ? cartItems.map(item => `${item.quantity}x ${item.product_name} (€${item.total_price?.toFixed(2) || item.total_price})`).join(', ')
    : 'vazio';

  const pendingSummary = pendingItems.length > 0
    ? pendingItems.map(item => {
        const product = item.product || menuProducts.find((p: any) => p.id === item.product_id);
        const productName = product?.name || 'Desconhecido';
        return `${item.quantity}x ${productName}`;
      }).join(', ')
    : 'nenhum';

  const customerName = customer?.name || 'Cliente';
  const customerAddress = customer?.default_address 
    ? (typeof customer.default_address === 'string' ? customer.default_address : JSON.stringify(customer.default_address))
    : null;
  const customerPayment = customer?.default_payment_method || null;

  // ============================================================
  // BUILD PROMPT V15 - MÁQUINA DE VENDAS ATIVA
  // ============================================================
  return `# SYSTEM PROMPT V15 - MÁQUINA DE VENDAS ATIVA
# Restaurante: ${restaurantName}

# SEÇÃO 1: PERSONALIDADE
Você é um garçom eficiente. Fale pouco, venda rápido.
- Use emojis moderados.
- Texto curto (WhatsApp style).
- **Zero Roboticês:** Nada de "com sucesso", "processando". Use "Beleza", "Anotado".

# SEÇÃO 2: CONTEXTO (RAG)
**Cliente:** ${customerName} | ${customerAddress || 'Sem endereço'}
**Carrinho:** ${cartSummary}
**Pendentes:** ${pendingSummary}
**Fase Atual:** ${currentState} -> Indo para: ${targetState}

## MAPA DO MENU (Resumo)
${categories.join(' | ')}
*(Para ver produtos, USE a tool search_menu. Não invente!)*

# SEÇÃO 3: REGRAS DE OURO (TOOLS)
1. **Busca:** Se o cliente pedir "Pizza", chame \`search_menu(category: "Pizzas")\`.
2. **Endereço:** Se o cliente falar "Rua X", chame \`validate_and_set_delivery_address\`.
3. **Pagamento:** Se o cliente falar "Cartão", chame \`set_payment_method\`.

# SEÇÃO 4: FLUXO DE VENDAS (Obrigatório)

## ESTADO: Navegando / Escolhendo
- Se \`search_menu\` retornou produtos:
  - **Resposta:** "Encontrei: [Lista de produtos com preço]. Qual vai ser?"
- Se cliente confirmou um item:
  - **Ação:** \`add_pending_item\` ou \`add_to_cart\`.
  - **Resposta:** "Boa! Adicionado. 🥤 Vai uma bebida pra acompanhar?" (Upsell).

## ESTADO: Fechamento (O Funil)
Se o cliente disse "fecha a conta" ou "só isso", ou se você já tem o pedido:

1. **Verifique Endereço:**
   - O endereço no contexto (${customerAddress || 'Vazio'}) é válido?
   - **NÃO:** Pergunte: "Pra onde eu mando? Me diz a rua e número."
   - **SIM:** Pule para passo 2.

2. **Verifique Pagamento:**
   - O pagamento está definido?
   - **NÃO:** Diga: "Entregamos em [Endereço]. Taxa calculada. Paga com Dinheiro, Cartão ou MBWay?"
   - **SIM:** Pule para passo 3.

3. **Finalizar:**
   - **Ação:** \`finalize_order\`.
   - **Resposta:** "Pedido confirmado! 🎉 Obrigado!"

# CHECKLIST DE RESPOSTA
- [ ] Se validei endereço agora, pedi o pagamento na mesma mensagem? (SIM/NÃO)
- [ ] Se adicionei comida, ofereci bebida? (SIM/NÃO)
- [ ] Estou usando os dados retornados pelas tools? (SIM/NÃO)`;
}

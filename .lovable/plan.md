
# Plano: Modo Recepção da IA (Sem Anotação de Pedidos)

## Resumo
Adicionar uma opção por restaurante para que a IA funcione apenas como **recepcionista**, sem anotar pedidos diretamente. Quando o cliente quiser fazer um pedido, a IA envia o link do menu público. Após a finalização no menu web, o sistema envia confirmação pelo WhatsApp com detalhes e acompanhamento.

---

## Fluxo Proposto

```text
Cliente: "Quero fazer um pedido"
     ↓
IA (Modo Recepção): "Claro! Acesse nosso cardápio digital aqui: 
                    https://menu.restaurante.com/slug
                    Após finalizar, envio a confirmação aqui! 😊"
     ↓
[Cliente acessa menu web → finaliza pedido]
     ↓
Sistema → WhatsApp: "✅ Pedido #ABC12345 confirmado!
                    
                    📋 Itens:
                    • 2x Pizza Margherita
                    • 1x Coca-Cola
                    
                    💰 Total: €27.50
                    📍 Entrega: Rua X, 123
                    
                    ⏰ Tempo estimado: 30-45min"
     ↓
[Mensagens de acompanhamento: preparando, saiu para entrega, etc.]
```

---

## Fase 1: Base de Dados

### 1.1 Migração SQL

Adicionar campo `ai_ordering_enabled` à tabela `restaurant_ai_settings`:

```sql
ALTER TABLE public.restaurant_ai_settings 
ADD COLUMN IF NOT EXISTS ai_ordering_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.restaurant_ai_settings.ai_ordering_enabled IS 
  'Se false, IA funciona apenas como recepção, enviando link do menu para pedidos';
```

---

## Fase 2: Modificar Comportamento da IA

### 2.1 Atualizar context-builder.ts

Incluir `ai_ordering_enabled` no contexto carregado:

```typescript
const restaurantAISettings = {
  // ... existing fields
  ai_ordering_enabled: aiSettings?.ai_ordering_enabled ?? true,
};
```

### 2.2 Atualizar conversational-ai-prompt.ts

Adicionar secção condicional no prompt:

```text
[SE ai_ordering_enabled = false:]

═══════════════════════════════════════════════════════════════
🎯 MODO RECEPÇÃO ATIVO
═══════════════════════════════════════════════════════════════

VOCÊ É APENAS RECEPCIONISTA. NÃO anota pedidos diretamente.

QUANDO cliente quiser fazer pedido:
1. NÃO use ferramentas de carrinho (add_to_cart, etc.)
2. ENVIE o link do cardápio: ${menuUrl}
3. INFORME que após finalizar, ele receberá confirmação aqui

Exemplo de resposta:
"Claro! Acesse nosso cardápio digital: ${menuUrl}
Depois de finalizar lá, te envio a confirmação aqui! 🍕"

VOCÊ AINDA PODE:
- Responder perguntas sobre o menu (use search_menu)
- Dar informações sobre o restaurante
- Tirar dúvidas sobre produtos
- Fazer follow-up após pedidos
```

### 2.3 Atualizar whatsapp-ai-agent/index.ts

Desabilitar tools de carrinho quando `ai_ordering_enabled = false`:

```typescript
// Filter tools based on ordering mode
let filteredTools = enabledToolsConfig;
if (!restaurantAISettings?.ai_ordering_enabled) {
  const orderingTools = [
    'add_to_cart', 
    'add_pending_item', 
    'confirm_pending_items',
    'remove_from_cart',
    'clear_cart',
    'set_payment_method',
    'validate_and_set_delivery_address',
    'finalize_order'
  ];
  filteredTools = enabledToolsConfig.filter(
    t => !orderingTools.includes(t.tool_name)
  );
  console.log('[AI Mode] Reception-only mode: ordering tools disabled');
}
```

---

## Fase 3: Notificação ao Cliente via WhatsApp

### 3.1 Criar nova Edge Function: notify-customer-order

Esta função envia a confirmação do pedido ao cliente (diferente da `notify-web-order` que notifica o restaurante).

```typescript
// supabase/functions/notify-customer-order/index.ts

// Campos necessários:
// - order_id
// - customer_phone
// - restaurant_id

// Mensagem exemplo:
const message = `✅ *Pedido #${shortOrderId} Confirmado!*

📋 *Itens:*
${itemsText}

💰 *Total:* €${order.total_amount.toFixed(2)}
📍 *Entrega:* ${order.delivery_address}
💳 *Pagamento:* ${paymentText}

⏰ Tempo estimado: 30-45 minutos

Acompanhe seu pedido aqui! 🍕`;
```

### 3.2 Integrar na Finalização do Pedido

Modificar `PublicCheckout.tsx` para chamar a nova função após criar o pedido:

```typescript
// Após criar web_order com sucesso:
await supabase.functions.invoke('notify-customer-order', {
  body: { 
    order_id: newOrder.id,
    customer_phone: customerPhone,
    restaurant_id: restaurantId
  }
});
```

---

## Fase 4: Mensagens de Acompanhamento

### 4.1 Trigger de Status do Pedido

Quando o status do pedido muda (preparing → ready → delivering), enviar mensagem ao cliente:

| Status | Mensagem |
|--------|----------|
| preparing | "🍳 Seu pedido está sendo preparado!" |
| ready | "✅ Pedido pronto! Saindo para entrega em breve." |
| delivering | "🚚 Pedido a caminho! Motorista: João" |
| delivered | "🎉 Pedido entregue! Bom apetite!" |

Isso pode ser uma Edge Function `notify-order-status` chamada pelo painel de pedidos quando o restaurante muda o status.

---

## Fase 5: UI de Configuração

### 5.1 Modificar AIPersonalizationTab.tsx

Adicionar toggle no topo das configurações:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Modo de Operação da IA</CardTitle>
    <CardDescription>
      Configure como a IA interage com pedidos
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex items-center justify-between">
      <div>
        <Label>IA Anota Pedidos</Label>
        <p className="text-sm text-muted-foreground">
          Se desativado, a IA apenas responde dúvidas e envia o link do cardápio digital
        </p>
      </div>
      <Switch
        checked={settings.ai_ordering_enabled}
        onCheckedChange={(checked) => 
          updateSetting('ai_ordering_enabled', checked)
        }
      />
    </div>
  </CardContent>
</Card>
```

---

## Fase 6: Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx_ai_reception_mode.sql` | Novo | Campo `ai_ordering_enabled` |
| `src/types/restaurant-ai-settings.ts` | Modificar | Adicionar tipo `ai_ordering_enabled` |
| `src/components/settings/AIPersonalizationTab.tsx` | Modificar | Toggle de modo |
| `supabase/functions/whatsapp-ai-agent/context-builder.ts` | Modificar | Carregar setting |
| `supabase/functions/whatsapp-ai-agent/conversational-ai-prompt.ts` | Modificar | Prompt condicional |
| `supabase/functions/whatsapp-ai-agent/index.ts` | Modificar | Filtrar tools |
| `supabase/functions/notify-customer-order/index.ts` | Novo | Notificação ao cliente |
| `src/pages/public/PublicCheckout.tsx` | Modificar | Chamar notify-customer-order |
| `supabase/functions/notify-order-status/index.ts` | Novo (opcional) | Acompanhamento de status |

---

## Resumo de Implementação

### Prioridade 1 (MVP)
1. Criar migração SQL com `ai_ordering_enabled`
2. Adicionar toggle em AIPersonalizationTab
3. Modificar context-builder para carregar setting
4. Atualizar prompt para modo recepção
5. Filtrar tools de pedido quando desativado

### Prioridade 2 (Confirmação ao Cliente)
6. Criar `notify-customer-order` edge function
7. Integrar chamada no PublicCheckout

### Prioridade 3 (Acompanhamento)
8. Criar `notify-order-status` para mensagens de status
9. Integrar no painel de pedidos (OrdersKanban/OrdersList)

---

## Considerações Técnicas

### Vantagens do Modo Recepção
- Elimina erros de preço/adicionais da IA
- Cliente tem controle total sobre o pedido
- Menu sempre atualizado (não depende de cache da IA)
- Checkout com validação de endereço/zona

### Desvantagens
- Experiência menos fluida no WhatsApp
- Cliente precisa sair do WhatsApp para finalizar

### Compatibilidade
- Restaurantes existentes mantêm `ai_ordering_enabled = true` (comportamento atual)
- Funcionalidade opt-in, sem impacto em quem não ativar

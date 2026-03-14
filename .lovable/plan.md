

## Diagnóstico: Mensagens de Recuperação

### Estado atual

1. **Recovery está DESATIVADO** -- o campo `recovery_config.enabled` no agente global (`agents` table) está `false`
2. **Configuração é GLOBAL** -- a edge function `conversation-recovery` lê de `agents.recovery_config` (uma única config para todos os restaurantes), não respeita configurações por restaurante
3. **Não integra com pedidos do menu público** -- o sistema de recovery só detecta carrinhos WhatsApp (`carts` table) e `conversation_state`. Pedidos do menu público (`web_orders`) não são considerados para detecção de clientes inativos nem carrinhos abandonados
4. **A tabela `restaurant_ai_settings` não tem campos de recovery** -- apesar da memória do sistema mencionar migração per-restaurant, isso não foi implementado

### Plano de implementação

**Tarefa 1: Adicionar campos de recovery à tabela `restaurant_ai_settings`**
- Criar migration adicionando coluna `recovery_config JSONB DEFAULT '{...}'` à tabela `restaurant_ai_settings`
- Estrutura idêntica à do agent: `{ enabled, types: { cart_abandoned, conversation_paused, customer_inactive } }`

**Tarefa 2: Adicionar UI de recovery no `AIPersonalizationTab`**
- Mover a UI do `RecoveryMessagesCard` (atualmente só no admin global `/admin/ai-configuration`) para dentro das configurações por restaurante em `AIPersonalizationTab`
- Cada restaurante configura seus próprios delays, templates e tipos ativos
- Incluir campo `handleSave` para gravar `recovery_config` junto com as outras settings

**Tarefa 3: Atualizar edge function `conversation-recovery` para ler config per-restaurant**
- Em vez de ler de `agents.recovery_config` (global), ler de `restaurant_ai_settings.recovery_config` para cada restaurante
- Se não existir config per-restaurant, usar defaults desativados (não fallback para global)

**Tarefa 4: Integrar `web_orders` no sistema de recovery**
- Na função `detect_abandoned_carts`: além de verificar `carts` (WhatsApp), verificar também `web_orders` com `status = 'pending'` e `payment_status != 'paid'` que estejam abandonados
- Na função `detect_inactive_customers` (SQL function): considerar também pedidos de `web_orders` para calcular `last_interaction_at` e `order_count`
- Na verificação de atividade recente antes de enviar: verificar também `web_orders` recentes do mesmo telefone

**Tarefa 5: Atualizar tipo TypeScript `RestaurantAISettings`**
- Adicionar `recovery_config` ao interface `RestaurantAISettings`

### Detalhes técnicos

- A migration SQL adiciona a coluna com default JSON que traz recovery desativado por padrão
- A edge function usa `restaurant_ai_settings` como source of truth; o `RecoveryMessagesCard` global no admin continua existindo como fallback/referência
- Para `web_orders`, a detecção de abandono usa `customer_phone` (campo existente) como identificador, enviando recovery via WhatsApp se o telefone existir
- O cron job existente (`conversation-recovery-job` a cada 15min) continua inalterado -- apenas a lógica interna da function muda


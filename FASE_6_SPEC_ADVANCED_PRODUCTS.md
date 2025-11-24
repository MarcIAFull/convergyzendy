# Especificação Técnica - Fase 6: Produtos Avançados

## 📋 Visão Geral

Sistema avançado de produtos com suporte a combos, variações (tamanhos, sabores), promoções/descontos, e agendamento de disponibilidade.

### Objetivos Principais
- ✅ Combos de produtos (ex: Pizza + Refrigerante)
- ✅ Variações de produtos (tamanhos, sabores, cores)
- ✅ Sistema de promoções e cupons
- ✅ Descontos automáticos (por tempo, quantidade, etc)
- ✅ Agendamento de disponibilidade (happy hour, menu sazonal)
- ✅ Produtos em destaque
- ✅ Upsells e cross-sells automatizados

---

## 🗄️ Database Schema

### Nova Tabela: `product_variants`
```sql
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Identificação
  name TEXT NOT NULL, -- ex: "Grande", "Médio", "Pequeno"
  sku TEXT, -- código único
  
  -- Preço (override do produto base)
  price_adjustment NUMERIC DEFAULT 0, -- +/- no preço base
  price_override NUMERIC, -- sobrescrever preço totalmente
  
  -- Estoque (se gerenciado)
  track_inventory BOOLEAN DEFAULT false,
  stock_quantity INTEGER,
  low_stock_threshold INTEGER,
  
  -- Atributos da variação
  attributes JSONB NOT NULL,
  -- Ex: {"size": "large", "crust": "thin"}
  
  -- Disponibilidade
  is_available BOOLEAN DEFAULT true,
  
  -- Ordenação
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_available ON product_variants(is_available) WHERE is_available = true;
CREATE INDEX idx_product_variants_sku ON product_variants(sku);

-- RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant product variants"
  ON product_variants FOR ALL
  USING (
    product_id IN (
      SELECT id FROM products WHERE user_has_restaurant_access(restaurant_id)
    )
  );
```

### Nova Tabela: `combos`
```sql
CREATE TABLE public.combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Info básica
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  
  -- Preço
  price NUMERIC NOT NULL,
  
  -- Itens do combo (produtos que o compõem)
  combo_items JSONB NOT NULL,
  -- Ex: [
  --   {"product_id": "uuid", "quantity": 1, "required": true},
  --   {"product_id": "uuid", "quantity": 2, "required": false, "options": ["uuid1", "uuid2"]}
  -- ]
  
  -- Desconto
  discount_type TEXT DEFAULT 'fixed', -- 'fixed', 'percentage'
  discount_value NUMERIC,
  
  -- Disponibilidade
  is_available BOOLEAN DEFAULT true,
  
  -- Agendamento
  available_from TIME,
  available_until TIME,
  available_days INTEGER[], -- [0,1,2,3,4,5,6] (domingo=0)
  
  -- Destaque
  is_featured BOOLEAN DEFAULT false,
  
  -- Ordenação
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_combos_restaurant ON combos(restaurant_id);
CREATE INDEX idx_combos_available ON combos(is_available) WHERE is_available = true;
CREATE INDEX idx_combos_featured ON combos(is_featured) WHERE is_featured = true;

-- RLS
ALTER TABLE combos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant combos"
  ON combos FOR ALL
  USING (user_has_restaurant_access(restaurant_id));
```

### Nova Tabela: `promotions`
```sql
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Info básica
  name TEXT NOT NULL,
  description TEXT,
  code TEXT UNIQUE, -- código do cupom (opcional)
  
  -- Tipo de promoção
  promotion_type TEXT NOT NULL, 
  -- 'percentage_off', 'fixed_amount_off', 'buy_x_get_y', 
  -- 'free_delivery', 'combo_discount'
  
  -- Valor do desconto
  discount_percentage NUMERIC,
  discount_amount NUMERIC,
  
  -- Aplicação
  applies_to TEXT DEFAULT 'order', -- 'order', 'category', 'product', 'delivery'
  target_ids UUID[], -- IDs de categorias ou produtos específicos
  
  -- Condições
  min_order_value NUMERIC,
  max_discount_amount NUMERIC, -- cap do desconto
  
  -- Buy X Get Y
  buy_quantity INTEGER,
  get_quantity INTEGER,
  get_product_id UUID REFERENCES products(id),
  
  -- Limites de uso
  usage_limit INTEGER, -- total geral
  usage_limit_per_customer INTEGER,
  current_usage INTEGER DEFAULT 0,
  
  -- Período
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Aplicação automática
  auto_apply BOOLEAN DEFAULT false, -- aplicar automaticamente sem código
  
  -- Prioridade
  priority INTEGER DEFAULT 0, -- promoções com maior prioridade são aplicadas primeiro
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_promotions_restaurant ON promotions(restaurant_id);
CREATE INDEX idx_promotions_code ON promotions(code) WHERE code IS NOT NULL;
CREATE INDEX idx_promotions_active ON promotions(is_active, starts_at, ends_at) 
  WHERE is_active = true;
CREATE INDEX idx_promotions_auto_apply ON promotions(auto_apply) WHERE auto_apply = true;

-- RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant promotions"
  ON promotions FOR ALL
  USING (user_has_restaurant_access(restaurant_id));

-- Public pode visualizar promoções ativas
CREATE POLICY "Public can view active promotions"
  ON promotions FOR SELECT
  USING (
    is_active = true 
    AND starts_at <= NOW() 
    AND ends_at >= NOW()
  );
```

### Nova Tabela: `promotion_usage`
```sql
CREATE TABLE public.promotion_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Cliente
  customer_phone TEXT NOT NULL,
  
  -- Desconto aplicado
  discount_amount NUMERIC NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_promotion_usage_promotion ON promotion_usage(promotion_id);
CREATE INDEX idx_promotion_usage_customer ON promotion_usage(customer_phone);
CREATE INDEX idx_promotion_usage_order ON promotion_usage(order_id);

-- RLS
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their restaurant promotion usage"
  ON promotion_usage FOR SELECT
  USING (
    promotion_id IN (
      SELECT id FROM promotions WHERE user_has_restaurant_access(restaurant_id)
    )
  );
```

### Nova Tabela: `upsells`
```sql
CREATE TABLE public.upsells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Produto gatilho (quando cliente adiciona este produto)
  trigger_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Produtos recomendados
  recommended_product_ids UUID[] NOT NULL,
  
  -- Tipo
  upsell_type TEXT DEFAULT 'cross_sell', 
  -- 'upsell' (versão melhor), 'cross_sell' (complementar), 'bundle' (conjunto)
  
  -- Desconto se aceitar
  discount_percentage NUMERIC,
  
  -- Mensagem customizada
  message TEXT,
  -- Ex: "Que tal adicionar uma Coca-Cola 2L por apenas R$ 8?"
  
  -- Condições
  min_cart_value NUMERIC,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Prioridade
  priority INTEGER DEFAULT 0,
  
  -- Métricas
  times_shown INTEGER DEFAULT 0,
  times_accepted INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_upsells_restaurant ON upsells(restaurant_id);
CREATE INDEX idx_upsells_trigger ON upsells(trigger_product_id);
CREATE INDEX idx_upsells_active ON upsells(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE upsells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant upsells"
  ON upsells FOR ALL
  USING (user_has_restaurant_access(restaurant_id));
```

### Alterar Tabelas Existentes

```sql
-- products: adicionar campos para variações
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS variant_groups JSONB,
  -- Ex: [{"name": "Tamanho", "required": true, "type": "single"}, 
  --      {"name": "Sabor", "required": false, "type": "multiple"}]
  
  ADD COLUMN IF NOT EXISTS scheduling_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_from TIME,
  ADD COLUMN IF NOT EXISTS available_until TIME,
  ADD COLUMN IF NOT EXISTS available_days INTEGER[];

-- orders: adicionar campo de promoções aplicadas
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS applied_promotions JSONB;
  -- Ex: [{"promotion_id": "uuid", "code": "PROMO10", "discount": 10.00}]

-- cart_items: adicionar suporte a variantes
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id);
```

---

## 🔄 Fluxos de Trabalho

### Fluxo 1: Cliente Seleciona Produto com Variações
```
1. Cliente clica em produto com has_variants = true
2. Modal/página mostra grupos de variações:
   - Tamanho (required): [Pequeno, Médio, Grande]
   - Borda (optional): [Tradicional, Catupiry, Cheddar]
3. Cliente seleciona opções
4. Sistema calcula preço:
   base_price + variações.price_adjustment
5. Adiciona ao carrinho com variant_id
```

### Fluxo 2: Cliente Adiciona Combo
```
1. Cliente vê combo "Pizza + Refrigerante"
2. Clica para adicionar
3. Sistema mostra:
   - Pizza: [selecionar sabor]
   - Refrigerante: [selecionar tipo]
4. Cliente faz seleções
5. Adiciona ao carrinho como combo_id
6. Cria cart_items individuais linkados ao combo
```

### Fluxo 3: Aplicar Promoção Automática
```
1. Cliente adiciona produtos ao carrinho
2. Sistema verifica promoções auto_apply = true
3. Filtra por:
   - is_active = true
   - NOW() between starts_at and ends_at
   - min_order_value <= cart_total
   - usage_limit não atingido
4. Ordena por priority DESC
5. Aplica primeira promoção elegível
6. Mostra badge "10% OFF aplicado!"
```

### Fluxo 4: Cliente Insere Cupom
```
1. Cliente digita código "PROMO10"
2. Sistema busca promotion com code = "PROMO10"
3. Valida:
   - Promoção existe e está ativa
   - Período válido
   - Limite de uso não atingido
   - Min order value atendido
4. Calcula desconto
5. Aplica ao carrinho
6. Mostra "Cupom PROMO10 aplicado! Desconto: R$ 15,00"
```

### Fluxo 5: Upsell Inteligente
```
1. Cliente adiciona "Pizza Margherita" ao carrinho
2. Sistema busca upsells com trigger_product_id = pizza_id
3. Mostra modal:
   "Que tal adicionar uma Coca-Cola 2L por apenas R$ 8?"
   [Não, obrigado] [Adicionar]
4. Se cliente aceita:
   - Adiciona produto ao carrinho
   - Aplica desconto (se houver)
   - Incrementa upsells.times_accepted
5. Se recusa:
   - Fecha modal
   - Incrementa upsells.times_shown
```

---

## 🔌 Edge Functions

### `apply-promotion`
```typescript
// supabase/functions/apply-promotion/index.ts

interface CartItem {
  product_id: string;
  quantity: number;
  price: number;
}

interface ApplyPromotionRequest {
  restaurantId: string;
  cartItems: CartItem[];
  promotionCode?: string;
  customerPhone: string;
}

serve(async (req) => {
  try {
    const { 
      restaurantId, 
      cartItems, 
      promotionCode, 
      customerPhone 
    }: ApplyPromotionRequest = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Calcular subtotal
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    let promotion = null;

    if (promotionCode) {
      // Buscar promoção por código
      const { data } = await supabase
        .from('promotions')
        .select('*')
        .eq('code', promotionCode.toUpperCase())
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .single();

      promotion = data;
    } else {
      // Buscar promoções auto-apply elegíveis
      const { data: autoPromotions } = await supabase
        .from('promotions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .eq('auto_apply', true)
        .lte('starts_at', new Date().toISOString())
        .gte('ends_at', new Date().toISOString())
        .order('priority', { ascending: false });

      // Filtrar por condições
      const eligible = autoPromotions?.filter(promo => {
        // Min order value
        if (promo.min_order_value && subtotal < promo.min_order_value) {
          return false;
        }

        // Usage limit
        if (promo.usage_limit && promo.current_usage >= promo.usage_limit) {
          return false;
        }

        // Usage limit per customer
        if (promo.usage_limit_per_customer) {
          // Buscar uso do cliente
          // TODO: implementar verificação
        }

        return true;
      });

      promotion = eligible?.[0];
    }

    if (!promotion) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Promoção não encontrada ou inválida' 
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Calcular desconto
    const discount = calculateDiscount(promotion, cartItems, subtotal);

    // Validar max_discount_amount
    const finalDiscount = promotion.max_discount_amount
      ? Math.min(discount, promotion.max_discount_amount)
      : discount;

    return new Response(
      JSON.stringify({
        valid: true,
        promotion: {
          id: promotion.id,
          name: promotion.name,
          code: promotion.code,
          discount: finalDiscount,
          type: promotion.promotion_type
        },
        subtotal,
        discount: finalDiscount,
        total: Math.max(subtotal - finalDiscount, 0)
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Apply promotion error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

function calculateDiscount(
  promotion: any,
  cartItems: CartItem[],
  subtotal: number
): number {
  switch (promotion.promotion_type) {
    case 'percentage_off':
      return subtotal * (promotion.discount_percentage / 100);

    case 'fixed_amount_off':
      return promotion.discount_amount;

    case 'free_delivery':
      // Retornar taxa de entrega
      return 0; // TODO: buscar delivery_fee

    case 'buy_x_get_y':
      // Implementar lógica de "compre X leve Y"
      return calculateBuyXGetY(promotion, cartItems);

    default:
      return 0;
  }
}

function calculateBuyXGetY(promotion: any, cartItems: CartItem[]): number {
  // Verificar se o produto gatilho está no carrinho
  const triggerItem = cartItems.find(
    item => item.product_id === promotion.trigger_product_id
  );

  if (!triggerItem || triggerItem.quantity < promotion.buy_quantity) {
    return 0;
  }

  // Calcular quantas vezes a promoção se aplica
  const timesApplicable = Math.floor(triggerItem.quantity / promotion.buy_quantity);

  // Buscar preço do produto que será grátis/com desconto
  const getFreeItem = cartItems.find(
    item => item.product_id === promotion.get_product_id
  );

  if (!getFreeItem) return 0;

  // Desconto = preço do item * quantidade que fica grátis
  const freeQuantity = timesApplicable * promotion.get_quantity;
  return getFreeItem.price * Math.min(freeQuantity, getFreeItem.quantity);
}
```

---

## 🎨 Componentes Frontend

```
src/pages/products/
├── ProductVariants.tsx       # Gestão de variações
├── Combos.tsx                # Gestão de combos
├── Promotions.tsx            # Gestão de promoções

src/components/products/
├── VariantSelector.tsx       # Seletor de variações
├── ComboBuilder.tsx          # Builder de combos
├── PromotionCard.tsx         # Card de promoção
├── CouponInput.tsx           # Input de cupom
├── UpsellModal.tsx           # Modal de upsell
└── DiscountBadge.tsx         # Badge de desconto
```

---

## 🚀 Implementação (Estimativa: 1-2 semanas)

### Sprint 1: Database + Backend
- [ ] Migrations: todas as novas tabelas
- [ ] Edge function: apply-promotion
- [ ] Edge function: calculate-upsells

### Sprint 2: Frontend
- [ ] VariantSelector
- [ ] ComboBuilder
- [ ] PromotionCard
- [ ] CouponInput
- [ ] UpsellModal

---

## 📝 Checklist Final

- [ ] Variações funcionando
- [ ] Combos criados e testados
- [ ] Promoções aplicando corretamente
- [ ] Cupons validando
- [ ] Upsells aparecendo
- [ ] Descontos calculando certo
- [ ] Documentação completa

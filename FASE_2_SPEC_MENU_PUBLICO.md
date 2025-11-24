# Especificação Técnica - Fase 2: Menu Virtual Público

## 📋 Visão Geral

O Menu Virtual Público é uma interface web mobile-first que permite clientes visualizarem o cardápio completo do restaurante, montarem pedidos, e finalizarem através do WhatsApp ou diretamente na plataforma.

### Objetivos Principais
- ✅ Reduzir atrito no processo de pedido
- ✅ Permitir pedidos sem necessidade de ter WhatsApp instalado
- ✅ Aumentar conversão com interface visual atrativa
- ✅ SEO otimizado para descoberta orgânica
- ✅ Experiência mobile-first responsiva

---

## 🏗️ Arquitetura e Rotas

### Estrutura de URLs
```
# Menu público do restaurante
https://zendy.app/menu/:restaurantSlug

# Páginas específicas
https://zendy.app/menu/:restaurantSlug/cart
https://zendy.app/menu/:restaurantSlug/checkout
```

### Fluxo de Navegação
```
Landing Page → Menu → Cart → Checkout → Confirmation
     ↓           ↓       ↓        ↓           ↓
  [Buscar]   [Adicionar] [Editar] [Finalizar] [WhatsApp/Web]
```

---

## 🗄️ Database Schema

### Nova Tabela: `restaurant_settings`
```sql
CREATE TABLE public.restaurant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Menu Público
  menu_enabled BOOLEAN DEFAULT false,
  slug TEXT UNIQUE NOT NULL, -- zendy.app/menu/:slug
  custom_domain TEXT, -- custom.com (futuro)
  
  -- Branding
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT DEFAULT '#FF6B35',
  accent_color TEXT DEFAULT '#4ECDC4',
  
  -- Configurações de Pedido
  min_order_amount NUMERIC DEFAULT 0,
  max_delivery_distance_km INTEGER DEFAULT 10,
  estimated_prep_time_minutes INTEGER DEFAULT 30,
  
  -- Formas de Finalização
  checkout_whatsapp_enabled BOOLEAN DEFAULT true,
  checkout_web_enabled BOOLEAN DEFAULT false, -- Requer plano Pro+
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT[],
  
  -- Social
  instagram_url TEXT,
  facebook_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para busca rápida por slug
CREATE UNIQUE INDEX idx_restaurant_settings_slug ON restaurant_settings(slug);

-- RLS Policies
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

-- Público pode visualizar settings de restaurantes com menu habilitado
CREATE POLICY "Public can view enabled menus"
  ON restaurant_settings FOR SELECT
  USING (menu_enabled = true);

-- Owners podem gerenciar suas settings
CREATE POLICY "Owners can manage their settings"
  ON restaurant_settings FOR ALL
  USING (user_has_restaurant_access(restaurant_id));
```

### Nova Tabela: `web_orders`
```sql
CREATE TABLE public.web_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  cart_id UUID NOT NULL REFERENCES carts(id),
  
  -- Dados do Cliente (web orders não requerem customer existente)
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  
  -- Entrega
  delivery_address TEXT NOT NULL,
  delivery_lat NUMERIC,
  delivery_lng NUMERIC,
  delivery_instructions TEXT,
  
  -- Pedido
  items JSONB NOT NULL, -- Snapshot dos items no momento do pedido
  subtotal NUMERIC NOT NULL,
  delivery_fee NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  
  -- Pagamento
  payment_method TEXT NOT NULL, -- 'cash', 'card', 'pix', 'mbway', 'multibanco'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'
  
  -- Metadata
  source TEXT DEFAULT 'web', -- 'web', 'whatsapp'
  user_agent TEXT,
  ip_address INET,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_web_orders_restaurant ON web_orders(restaurant_id);
CREATE INDEX idx_web_orders_phone ON web_orders(customer_phone);
CREATE INDEX idx_web_orders_status ON web_orders(status);
CREATE INDEX idx_web_orders_created ON web_orders(created_at DESC);

-- RLS Policies
ALTER TABLE web_orders ENABLE ROW LEVEL SECURITY;

-- Owners podem visualizar pedidos web de seus restaurantes
CREATE POLICY "Owners can view their web orders"
  ON web_orders FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

-- Service role pode criar web orders
CREATE POLICY "Service role can create web orders"
  ON web_orders FOR INSERT
  WITH CHECK (true);

-- Owners podem atualizar status
CREATE POLICY "Owners can update their web orders"
  ON web_orders FOR UPDATE
  USING (user_has_restaurant_access(restaurant_id));
```

### Alterações em Tabelas Existentes

**Tabela `restaurants`** - Adicionar campo slug:
```sql
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug TEXT;

-- Migração: gerar slugs para restaurantes existentes
UPDATE restaurants 
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Garantir unicidade
ALTER TABLE restaurants ADD CONSTRAINT restaurants_slug_unique UNIQUE(slug);
```

**Tabela `products`** - Adicionar campos para menu público:
```sql
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergens TEXT[],
  ADD COLUMN IF NOT EXISTS nutritional_info JSONB;

-- Index para ordenação
CREATE INDEX idx_products_display_order ON products(display_order);
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = true;
```

---

## 🎨 Componentes Frontend

### Estrutura de Páginas

```
src/pages/public/
├── PublicMenu.tsx          # Página principal do menu (/menu/:slug)
├── PublicCart.tsx          # Página do carrinho (/menu/:slug/cart)
├── PublicCheckout.tsx      # Página de checkout (/menu/:slug/checkout)
└── PublicOrderConfirmed.tsx # Confirmação do pedido

src/components/public/
├── MenuHeader.tsx          # Header com logo, nome, horários
├── MenuHero.tsx            # Banner hero com imagem
├── CategoryTabs.tsx        # Tabs de categorias
├── ProductCard.tsx         # Card de produto individual
├── ProductModal.tsx        # Modal com detalhes + addons
├── CartFloatingButton.tsx  # Botão flutuante do carrinho
├── CartSummary.tsx         # Resumo do carrinho
├── DeliveryAddressForm.tsx # Form de endereço com autocomplete
├── PaymentMethodSelector.tsx # Seletor de método de pagamento
└── OrderTracking.tsx       # Tracking do pedido (futuro)

src/layouts/
└── PublicMenuLayout.tsx    # Layout para páginas públicas

src/hooks/
├── usePublicMenu.tsx       # Hook para carregar menu público
├── usePublicCart.tsx       # Hook para gerenciar carrinho (localStorage)
└── useGeocode.tsx          # Hook para validar/geocodificar endereços
```

### Design System - Novos Tokens

```css
/* src/index.css - Adicionar tokens específicos para menu público */

:root {
  /* Menu Público - Será sobrescrito por restaurant_settings */
  --menu-primary: 210 100% 50%;
  --menu-accent: 173 58% 39%;
  --menu-hero-overlay: 0 0% 0% / 0.5;
  
  /* Componentes Específicos */
  --product-card-border: 0 0% 90%;
  --cart-floating-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  --hero-gradient: linear-gradient(135deg, hsl(var(--menu-primary)) 0%, hsl(var(--menu-accent)) 100%);
}

.dark {
  --product-card-border: 0 0% 20%;
}
```

---

## 🔄 Fluxos de Usuário

### Fluxo 1: Cliente Visualiza Menu
```
1. Cliente acessa zendy.app/menu/pizzaria-bella
2. Sistema:
   - Busca restaurant_settings por slug
   - Valida se menu_enabled = true
   - Carrega categories + products + addons
   - Verifica horário de funcionamento
3. Exibe:
   - Hero banner com logo
   - Horários e info de entrega
   - Categorias em tabs
   - Produtos com imagens e preços
```

### Fluxo 2: Cliente Adiciona Item ao Carrinho
```
1. Cliente clica em produto
2. Abre ProductModal:
   - Mostra imagem grande
   - Descrição completa
   - Seleção de addons (checkboxes)
   - Quantidade (+ -)
   - Notas especiais (textarea)
3. Cliente clica "Adicionar ao Carrinho"
4. Sistema:
   - Salva em localStorage (chave: cart_:slug)
   - Atualiza contador do CartFloatingButton
   - Mostra toast de confirmação
   - Fecha modal
```

### Fluxo 3: Finalizar via WhatsApp
```
1. Cliente clica em CartFloatingButton
2. Navega para /menu/:slug/cart
3. Revisa items, edita quantidades
4. Clica "Finalizar no WhatsApp"
5. Sistema:
   - Valida carrinho não-vazio
   - Formata mensagem:
     ```
     🍕 *Novo Pedido - Pizzaria Bella*
     
     📋 *Itens:*
     • 1x Pizza Margherita (Grande)
       + Borda Catupiry
       Obs: Sem cebola
     • 2x Coca-Cola 2L
     
     💰 *Total:* R$ 67,50
     📍 *Entrega:* Rua das Flores, 123
     
     Confirma o pedido? 😊
     ```
6. Redireciona para:
   ```
   https://wa.me/5511999999999?text=[mensagem_encoded]
   ```
```

### Fluxo 4: Finalizar via Web (Plano Pro+)
```
1. Cliente clica "Finalizar Pedido"
2. Navega para /menu/:slug/checkout
3. Preenche dados:
   - Nome completo
   - Telefone (com validação)
   - Email (opcional)
4. Endereço de Entrega:
   - Autocomplete do Google Maps
   - Valida se está dentro do raio de entrega
   - Calcula taxa de entrega
5. Método de Pagamento:
   - Dinheiro (com troco)
   - Cartão na entrega
   - PIX (Brasil)
   - MBWay (Portugal)
   - Multibanco (Portugal)
6. Clica "Confirmar Pedido"
7. Sistema:
   - Cria web_order
   - Cria cart + cart_items
   - Envia notificação WhatsApp ao restaurante
   - Mostra tela de confirmação
```

---

## 🔌 Integrações

### Google Maps API
**Necessário para:**
- Autocomplete de endereços
- Geocodificação (lat/lng)
- Validação de raio de entrega
- Cálculo de distância

**Setup:**
```typescript
// src/lib/maps.ts
import { Loader } from '@googlemaps/js-api-loader';

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['places', 'geometry']
});

export const initGoogleMaps = async () => {
  return await loader.load();
};

export const geocodeAddress = async (address: string) => {
  const google = await loader.load();
  const geocoder = new google.maps.Geocoder();
  
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results[0]) {
        resolve({
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng(),
          formatted_address: results[0].formatted_address
        });
      } else {
        reject(new Error('Geocoding failed'));
      }
    });
  });
};

export const calculateDistance = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): number => {
  const R = 6371; // Raio da Terra em km
  const dLat = (destination.lat - origin.lat) * Math.PI / 180;
  const dLng = (destination.lng - origin.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(origin.lat * Math.PI / 180) * 
            Math.cos(destination.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distância em km
};
```

### WhatsApp Integration
**Edge Function:** `supabase/functions/web-order-notify`
```typescript
// Notificar restaurante de novo pedido web
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendWhatsAppMessage } from '../_shared/evolutionClient.ts';

serve(async (req) => {
  const { orderId, restaurantId } = await req.json();
  
  // Buscar dados do pedido
  const order = await supabase
    .from('web_orders')
    .select('*, restaurant:restaurants(*)')
    .eq('id', orderId)
    .single();
  
  // Formatar mensagem
  const message = `
🌐 *Novo Pedido Web #${order.id.slice(0, 8)}*

👤 *Cliente:* ${order.customer_name}
📱 *Telefone:* ${order.customer_phone}

📋 *Items:*
${order.items.map(item => 
  `• ${item.quantity}x ${item.product_name} - R$ ${item.total}`
).join('\n')}

💰 *Total:* R$ ${order.total_amount}
📍 *Entrega:* ${order.delivery_address}
💳 *Pagamento:* ${order.payment_method}

🔗 Ver detalhes: ${process.env.APP_URL}/orders/${order.id}
  `.trim();
  
  // Enviar via WhatsApp
  await sendWhatsAppMessage(
    order.restaurant.phone,
    message
  );
  
  return new Response(JSON.stringify({ success: true }));
});
```

---

## 🎯 Performance e SEO

### SEO Otimização
```typescript
// src/pages/public/PublicMenu.tsx

import { Helmet } from 'react-helmet-async';

const PublicMenu = () => {
  const { restaurant, settings } = usePublicMenu();
  
  return (
    <>
      <Helmet>
        {/* Meta Tags Básicas */}
        <title>{settings.meta_title || `${restaurant.name} - Cardápio Online`}</title>
        <meta name="description" content={settings.meta_description || 
          `Peça delivery de ${restaurant.name}. Cardápio completo, entrega rápida.`} />
        <meta name="keywords" content={settings.meta_keywords?.join(', ')} />
        
        {/* Open Graph */}
        <meta property="og:type" content="restaurant" />
        <meta property="og:title" content={restaurant.name} />
        <meta property="og:description" content={settings.meta_description} />
        <meta property="og:image" content={settings.banner_url} />
        <meta property="og:url" content={`https://zendy.app/menu/${settings.slug}`} />
        
        {/* Restaurant Schema.org */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": restaurant.name,
            "image": settings.banner_url,
            "address": {
              "@type": "PostalAddress",
              "streetAddress": restaurant.address
            },
            "telephone": restaurant.phone,
            "servesCuisine": settings.meta_keywords,
            "priceRange": "$$",
            "openingHoursSpecification": Object.entries(restaurant.opening_hours).map(([day, hours]) => ({
              "@type": "OpeningHoursSpecification",
              "dayOfWeek": day,
              "opens": hours.open,
              "closes": hours.close
            }))
          })}
        </script>
        
        {/* Canonical */}
        <link rel="canonical" href={`https://zendy.app/menu/${settings.slug}`} />
      </Helmet>
      
      {/* ... resto do componente */}
    </>
  );
};
```

### Performance
- **Lazy Loading:** Imagens carregam com `loading="lazy"`
- **Image Optimization:** Usar Supabase Image Transformation
- **Code Splitting:** Páginas públicas em bundle separado
- **Caching:** Service Worker para cache offline (PWA)
- **Virtual Scrolling:** Para menus com 100+ produtos

---

## 🔐 Segurança

### Validações Backend
```typescript
// Edge Function: create-web-order

// 1. Validar restaurante existe e menu habilitado
const settings = await supabase
  .from('restaurant_settings')
  .select('*')
  .eq('slug', slug)
  .eq('menu_enabled', true)
  .single();

if (!settings) {
  throw new Error('Menu não disponível');
}

// 2. Validar horário de funcionamento
const isOpen = checkIfRestaurantIsOpen(restaurant.opening_hours);
if (!isOpen) {
  throw new Error('Restaurante fechado no momento');
}

// 3. Validar produtos existem e estão disponíveis
const productIds = items.map(item => item.productId);
const products = await supabase
  .from('products')
  .select('*')
  .in('id', productIds)
  .eq('is_available', true)
  .eq('restaurant_id', restaurant.id);

if (products.length !== productIds.length) {
  throw new Error('Alguns produtos não estão disponíveis');
}

// 4. Recalcular total no backend (nunca confiar no cliente)
const calculatedTotal = calculateOrderTotal(items, products, restaurant.delivery_fee);

if (Math.abs(calculatedTotal - submittedTotal) > 0.01) {
  throw new Error('Total do pedido inválido');
}

// 5. Validar raio de entrega
const distance = calculateDistance(
  restaurantCoords,
  deliveryCoords
);

if (distance > settings.max_delivery_distance_km) {
  throw new Error('Endereço fora da área de entrega');
}
```

### Rate Limiting
```typescript
// Aplicar rate limiting específico para pedidos web
// Max 5 pedidos por telefone por hora

const rateLimitKey = `web_order:${customerPhone}`;
const recentOrders = await redis.get(rateLimitKey);

if (recentOrders >= 5) {
  throw new Error('Limite de pedidos atingido. Tente novamente em 1 hora.');
}

await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 3600); // 1 hora
```

---

## 📱 Experiência Mobile-First

### Design Responsivo
```css
/* Mobile First Approach */

.product-grid {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  
  /* Mobile: 1 coluna */
  grid-template-columns: 1fr;
}

/* Tablet: 2 colunas */
@media (min-width: 640px) {
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop: 3 colunas */
@media (min-width: 1024px) {
  .product-grid {
    grid-template-columns: repeat(3, 1fr);
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

### Touch Interactions
- Botões com min-height de 44px (touch target)
- Swipe para navegar entre categorias
- Pull-to-refresh para atualizar menu
- Haptic feedback em ações importantes

---

## 🚀 Implementação Faseada

### Sprint 1 (Semana 1): Database + Backend
**Tasks:**
- [ ] Criar migration para `restaurant_settings`
- [ ] Criar migration para `web_orders`
- [ ] Alterar tabelas existentes (slug, display_order)
- [ ] Seed inicial de settings para restaurantes existentes
- [ ] Edge function `create-web-order`
- [ ] Edge function `web-order-notify`
- [ ] Testes de API

**Entrega:** API funcional para criar pedidos web

### Sprint 2 (Semana 1-2): Menu Público Básico
**Tasks:**
- [ ] PublicMenuLayout
- [ ] PublicMenu page (/menu/:slug)
- [ ] MenuHeader component
- [ ] CategoryTabs component
- [ ] ProductCard component
- [ ] usePublicMenu hook
- [ ] Loading states e error handling

**Entrega:** Menu navegável e responsivo

### Sprint 3 (Semana 2): Carrinho e WhatsApp
**Tasks:**
- [ ] ProductModal com seleção de addons
- [ ] CartFloatingButton
- [ ] PublicCart page
- [ ] usePublicCart hook (localStorage)
- [ ] Formatação de mensagem WhatsApp
- [ ] Integração com WhatsApp API

**Entrega:** Fluxo completo até WhatsApp

### Sprint 4 (Semana 2-3): Checkout Web
**Tasks:**
- [ ] PublicCheckout page
- [ ] DeliveryAddressForm com autocomplete
- [ ] Google Maps integration
- [ ] PaymentMethodSelector
- [ ] Validação de raio de entrega
- [ ] PublicOrderConfirmed page

**Entrega:** Checkout web funcional

### Sprint 5 (Semana 3): Dashboard + Settings
**Tasks:**
- [ ] Settings page: seção "Menu Público"
- [ ] Configuração de slug
- [ ] Upload de logo e banner
- [ ] Customização de cores
- [ ] Toggle de habilitação
- [ ] Preview do menu

**Entrega:** Restaurantes podem configurar menu público

### Sprint 6 (Semana 3): SEO + Performance
**Tasks:**
- [ ] Meta tags e Open Graph
- [ ] Schema.org structured data
- [ ] Sitemap dinâmico
- [ ] Image optimization
- [ ] Lazy loading
- [ ] PWA setup básico

**Entrega:** Menu otimizado para SEO e performance

---

## 🧪 Testes Críticos

### Teste 1: Validação de Carrinho
```typescript
describe('PublicCart', () => {
  it('should calculate total correctly with addons', () => {
    const items = [
      {
        product: { price: 30 },
        addons: [{ price: 5 }, { price: 3 }],
        quantity: 2
      }
    ];
    
    const total = calculateCartTotal(items, deliveryFee);
    expect(total).toBe((30 + 5 + 3) * 2 + deliveryFee);
  });
  
  it('should validate min order amount', () => {
    const cart = { total: 15 };
    const settings = { min_order_amount: 20 };
    
    expect(canCheckout(cart, settings)).toBe(false);
  });
});
```

### Teste 2: Validação de Entrega
```typescript
describe('Delivery Validation', () => {
  it('should reject address outside delivery radius', () => {
    const restaurantCoords = { lat: -23.5505, lng: -46.6333 };
    const deliveryCoords = { lat: -23.7000, lng: -46.8000 };
    const maxDistance = 10; // km
    
    const distance = calculateDistance(restaurantCoords, deliveryCoords);
    expect(distance).toBeGreaterThan(maxDistance);
  });
});
```

### Teste 3: Formatação WhatsApp
```typescript
describe('WhatsApp Message', () => {
  it('should format order message correctly', () => {
    const order = {
      items: [
        { name: 'Pizza Margherita', quantity: 1, addons: ['Borda Catupiry'] }
      ],
      total: 45.00
    };
    
    const message = formatWhatsAppMessage(order);
    
    expect(message).toContain('Pizza Margherita');
    expect(message).toContain('Borda Catupiry');
    expect(message).toContain('R$ 45,00');
  });
});
```

---

## 📊 Métricas de Sucesso

### KPIs
- **Conversion Rate:** % de visitantes que finalizam pedido
- **Average Order Value:** Ticket médio de pedidos web
- **Abandonment Rate:** % de carrinhos abandonados
- **Time to Order:** Tempo médio do landing até confirmação
- **Mobile vs Desktop:** % de pedidos por device

### Analytics Events
```typescript
// src/lib/analytics.ts

export const trackMenuView = (slug: string) => {
  analytics.track('menu_viewed', { restaurant_slug: slug });
};

export const trackProductView = (productId: string) => {
  analytics.track('product_viewed', { product_id: productId });
};

export const trackAddToCart = (productId: string, total: number) => {
  analytics.track('add_to_cart', { product_id: productId, value: total });
};

export const trackCheckoutStarted = (total: number, items: number) => {
  analytics.track('checkout_started', { value: total, items_count: items });
};

export const trackOrderCompleted = (orderId: string, total: number, method: string) => {
  analytics.track('order_completed', { 
    order_id: orderId, 
    value: total,
    method 
  });
};
```

---

## 🔄 Integrações Futuras (Pós-MVP)

### Fase 2.1: Pagamento Online
- Stripe Checkout
- PIX automático (Brasil)
- MBWay API (Portugal)
- Multibanco API (Portugal)

### Fase 2.2: Marketing
- Cupons de desconto
- Programa de fidelidade
- Compartilhar no social
- Pixel de conversão (Meta, Google)

### Fase 2.3: Advanced Features
- Dark kitchen mode (multi-brands)
- Agendamento de pedidos
- Pedidos recorrentes
- Menu sazonal

---

## 📝 Checklist Final

### Antes do Deploy
- [ ] Todas as migrations testadas
- [ ] RLS policies validadas
- [ ] Edge functions deployadas
- [ ] Google Maps API configurada
- [ ] Secrets configurados (GOOGLE_MAPS_API_KEY)
- [ ] Testes E2E passando
- [ ] Meta tags e SEO implementados
- [ ] Performance audit (Lighthouse > 90)
- [ ] Teste em devices reais
- [ ] Documentação atualizada

### Pós-Deploy
- [ ] Monitoramento de erros (Sentry)
- [ ] Analytics configurado
- [ ] Onboarding para restaurantes
- [ ] Tutorial em vídeo
- [ ] Email de lançamento
- [ ] Anúncio nas redes sociais

---

## 📞 Suporte

Para questões técnicas sobre esta spec, consultar:
- **Database:** FASE_2_SPEC_MENU_PUBLICO.md (este arquivo)
- **PRD Completo:** PRD_COMPLETO_Zendy.docx
- **Guia de Testes:** TESTING_GUIDE.md
- **Production Checklist:** PRODUCTION_CHECKLIST.md

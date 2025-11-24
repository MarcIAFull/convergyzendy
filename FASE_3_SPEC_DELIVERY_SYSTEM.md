# Especificação Técnica - Fase 3: Sistema de Delivery

## 📋 Visão Geral

Sistema completo de gestão de entregas com motoboys, atribuição automática/manual de pedidos, tracking em tempo real, e notificações automatizadas via WhatsApp.

### Objetivos Principais
- ✅ CRUD completo de motoboys/entregadores
- ✅ Atribuição de pedidos (automática e manual)
- ✅ Tracking de status de entrega
- ✅ Notificações WhatsApp para entregadores
- ✅ Dashboard de entregas ativas
- ✅ Histórico e métricas de performance
- ✅ Gestão de disponibilidade dos entregadores

---

## 🗄️ Database Schema

### Nova Tabela: `delivery_drivers`
```sql
CREATE TABLE public.delivery_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Dados Pessoais
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  photo_url TEXT,
  
  -- Documentos
  cpf_nif TEXT, -- CPF (Brasil) ou NIF (Portugal)
  drivers_license TEXT,
  vehicle_plate TEXT,
  vehicle_type TEXT, -- 'motorcycle', 'bicycle', 'car', 'foot'
  
  -- Status
  status TEXT DEFAULT 'inactive', -- 'active', 'inactive', 'busy', 'offline'
  is_available BOOLEAN DEFAULT true,
  
  -- Localização (última conhecida)
  current_lat NUMERIC,
  current_lng NUMERIC,
  last_location_update TIMESTAMPTZ,
  
  -- Métricas
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  average_delivery_time_minutes INTEGER,
  rating NUMERIC(3, 2), -- 0.00 a 5.00
  
  -- Configurações
  max_concurrent_deliveries INTEGER DEFAULT 1,
  max_delivery_radius_km INTEGER DEFAULT 10,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_delivery_drivers_restaurant ON delivery_drivers(restaurant_id);
CREATE INDEX idx_delivery_drivers_status ON delivery_drivers(status);
CREATE INDEX idx_delivery_drivers_phone ON delivery_drivers(phone);
CREATE INDEX idx_delivery_drivers_available ON delivery_drivers(is_available) WHERE is_available = true;

-- RLS
ALTER TABLE delivery_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant drivers"
  ON delivery_drivers FOR ALL
  USING (user_has_restaurant_access(restaurant_id));
```

### Nova Tabela: `deliveries`
```sql
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES delivery_drivers(id) ON DELETE SET NULL,
  
  -- Endereços
  pickup_address TEXT NOT NULL, -- Endereço do restaurante
  pickup_lat NUMERIC NOT NULL,
  pickup_lng NUMERIC NOT NULL,
  
  delivery_address TEXT NOT NULL, -- Endereço do cliente
  delivery_lat NUMERIC,
  delivery_lng NUMERIC,
  delivery_instructions TEXT,
  
  -- Cálculos
  distance_km NUMERIC,
  estimated_duration_minutes INTEGER,
  
  -- Status
  status TEXT DEFAULT 'pending', 
  -- 'pending': aguardando atribuição
  -- 'assigned': atribuído a entregador
  -- 'picked_up': pedido coletado
  -- 'on_the_way': a caminho do cliente
  -- 'delivered': entregue
  -- 'failed': falhou (endereço errado, cliente ausente, etc)
  -- 'cancelled': cancelado
  
  -- Timestamps
  assigned_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  on_the_way_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Informações Adicionais
  failure_reason TEXT,
  customer_signature TEXT, -- Base64 da assinatura (opcional)
  delivery_photo_url TEXT, -- Foto de comprovação
  
  -- Avaliação
  customer_rating INTEGER, -- 1-5 stars
  customer_feedback TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deliveries_restaurant ON deliveries(restaurant_id);
CREATE INDEX idx_deliveries_order ON deliveries(order_id);
CREATE INDEX idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_created ON deliveries(created_at DESC);

-- RLS
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their restaurant deliveries"
  ON deliveries FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can manage their restaurant deliveries"
  ON deliveries FOR ALL
  USING (user_has_restaurant_access(restaurant_id));

-- Drivers podem ver e atualizar suas próprias entregas
CREATE POLICY "Drivers can view their deliveries"
  ON deliveries FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM delivery_drivers WHERE phone = auth.jwt() ->> 'phone'
    )
  );

CREATE POLICY "Drivers can update their delivery status"
  ON deliveries FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM delivery_drivers WHERE phone = auth.jwt() ->> 'phone'
    )
  );
```

### Nova Tabela: `driver_shifts`
```sql
CREATE TABLE public.driver_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Turno
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'cancelled'
  
  -- Checkin/Checkout
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  
  -- Métricas do Turno
  deliveries_completed INTEGER DEFAULT 0,
  total_distance_km NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_driver_shifts_driver ON driver_shifts(driver_id);
CREATE INDEX idx_driver_shifts_date ON driver_shifts(shift_date DESC);
CREATE INDEX idx_driver_shifts_status ON driver_shifts(status);

-- RLS
ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant driver shifts"
  ON driver_shifts FOR ALL
  USING (user_has_restaurant_access(restaurant_id));
```

### Nova Tabela: `driver_location_history`
```sql
CREATE TABLE public.driver_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES delivery_drivers(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  
  -- Localização
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  accuracy NUMERIC, -- metros
  
  -- Metadata
  speed_kmh NUMERIC,
  heading NUMERIC, -- 0-360 graus
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Particionamento por data (performance)
CREATE INDEX idx_driver_location_driver_date ON driver_location_history(driver_id, created_at DESC);
CREATE INDEX idx_driver_location_delivery ON driver_location_history(delivery_id);

-- RLS
ALTER TABLE driver_location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert location history"
  ON driver_location_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their drivers location history"
  ON driver_location_history FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM delivery_drivers WHERE user_has_restaurant_access(restaurant_id)
    )
  );
```

### Alterar Tabela: `orders`
```sql
-- Adicionar campos relacionados a delivery
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'delivery', -- 'delivery', 'pickup', 'dine_in'
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ;

-- Index
CREATE INDEX idx_orders_delivery_type ON orders(delivery_type);
CREATE INDEX idx_orders_scheduled ON orders(scheduled_for) WHERE scheduled_for IS NOT NULL;
```

---

## 🔄 Fluxos de Trabalho

### Fluxo 1: Criar Entregador
```
1. Gestor acessa "Entregadores" no dashboard
2. Clica em "Adicionar Entregador"
3. Preenche formulário:
   - Nome completo
   - Telefone (WhatsApp)
   - Email
   - CPF/NIF
   - CNH/Carta de Condução
   - Placa do veículo
   - Tipo de veículo
   - Foto
4. Define configurações:
   - Raio máximo de entrega
   - Entregas simultâneas permitidas
5. Clica "Salvar"
6. Sistema:
   - Cria delivery_driver
   - Envia mensagem WhatsApp de boas-vindas
   - Disponibiliza para atribuição
```

### Fluxo 2: Atribuição Manual de Pedido
```
1. Novo pedido chega (status: 'new')
2. Sistema cria delivery record (status: 'pending')
3. Gestor vê pedido no dashboard
4. Clica em "Atribuir Entregador"
5. Sistema mostra lista de entregadores:
   - Status (disponível/ocupado)
   - Distância atual do restaurante
   - Entregas ativas
   - Rating
6. Gestor seleciona entregador
7. Clica "Confirmar Atribuição"
8. Sistema:
   - Atualiza delivery.driver_id
   - Muda delivery.status → 'assigned'
   - Envia WhatsApp ao entregador:
     ```
     🚀 *Nova Entrega Atribuída!*
     
     📍 *Retirar em:*
     Pizzaria Bella
     Rua das Flores, 123
     
     📍 *Entregar em:*
     João Silva
     Rua dos Lírios, 456 - Apto 302
     
     💰 *Valor:* R$ 67,50
     📞 *Cliente:* (11) 98765-4321
     
     ⏱️ *Prazo:* 40 minutos
     
     🔗 Abrir navegação: [Google Maps Link]
     ```
```

### Fluxo 3: Atribuição Automática
```
1. Novo pedido chega
2. Edge Function: assign-delivery-driver (trigger)
3. Sistema busca entregador ideal:
   
   Critérios (em ordem de prioridade):
   a) Status = 'active' AND is_available = true
   b) Entregas ativas < max_concurrent_deliveries
   c) Distância do restaurante < max_delivery_radius_km
   d) Melhor rating
   e) Menor tempo médio de entrega
   
4. Se encontrar entregador:
   - Atribui automaticamente
   - Envia notificação WhatsApp
   - Atualiza status do driver → 'busy'
   
5. Se não encontrar:
   - Mantém delivery.status = 'pending'
   - Notifica gestor
   - Permite atribuição manual
```

### Fluxo 4: Ciclo de Vida da Entrega
```
PENDING → Pedido criado, aguardando atribuição
   ↓
ASSIGNED → Entregador atribuído, recebeu notificação
   ↓ (Entregador confirma coleta via WhatsApp ou app)
PICKED_UP → Pedido coletado no restaurante
   ↓ (Entregador inicia navegação)
ON_THE_WAY → A caminho do cliente
   ↓ (Entregador marca como entregue)
DELIVERED → Entregue com sucesso
   ↓
[Solicita avaliação ao cliente]

Fluxos alternativos:
- PENDING → CANCELLED (restaurante cancela)
- ASSIGNED → PENDING (entregador recusa)
- ON_THE_WAY → FAILED (endereço errado, cliente ausente)
```

### Fluxo 5: Entregador Atualiza Status (via WhatsApp Bot)
```
Comandos via WhatsApp:
- "COLETEI" ou "1" → Marca como picked_up
- "SAINDO" ou "2" → Marca como on_the_way
- "ENTREGUE" ou "3" → Marca como delivered
- "PROBLEMA" ou "0" → Abre menu de problemas

Exemplo:
Entregador: "COLETEI"
Bot: ✅ Pedido #1234 marcado como coletado!
     Cliente: João Silva
     Endereço: Rua dos Lírios, 456
     📍 Abrir Maps: [link]
     
     Quando sair, envie "SAINDO"
```

---

## 🔌 Edge Functions

### `assign-delivery-driver`
```typescript
// supabase/functions/assign-delivery-driver/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  try {
    const { deliveryId, mode } = await req.json();
    // mode: 'auto' | 'manual'

    // 1. Buscar delivery
    const { data: delivery } = await supabase
      .from('deliveries')
      .select(`
        *,
        order:orders(*)
      `)
      .eq('id', deliveryId)
      .single();

    if (!delivery) {
      throw new Error('Delivery não encontrado');
    }

    // 2. Buscar entregadores disponíveis
    const { data: availableDrivers } = await supabase
      .from('delivery_drivers')
      .select('*, active_deliveries:deliveries!driver_id(count)')
      .eq('restaurant_id', delivery.restaurant_id)
      .eq('status', 'active')
      .eq('is_available', true);

    if (!availableDrivers || availableDrivers.length === 0) {
      throw new Error('Nenhum entregador disponível');
    }

    // 3. Filtrar por capacidade
    const eligibleDrivers = availableDrivers.filter(driver => {
      const activeCount = driver.active_deliveries?.[0]?.count || 0;
      return activeCount < driver.max_concurrent_deliveries;
    });

    if (eligibleDrivers.length === 0) {
      throw new Error('Todos os entregadores estão ocupados');
    }

    // 4. Calcular score de cada entregador
    const scoredDrivers = eligibleDrivers.map(driver => {
      let score = 0;

      // Rating (peso 40%)
      score += (driver.rating || 0) * 8;

      // Tempo médio de entrega (peso 30%)
      const avgTime = driver.average_delivery_time_minutes || 30;
      score += (60 - Math.min(avgTime, 60)) * 0.5;

      // Taxa de sucesso (peso 30%)
      const successRate = driver.total_deliveries > 0
        ? (driver.successful_deliveries / driver.total_deliveries)
        : 0.5;
      score += successRate * 30;

      return { ...driver, score };
    });

    // 5. Ordenar por score
    scoredDrivers.sort((a, b) => b.score - a.score);
    const selectedDriver = scoredDrivers[0];

    // 6. Atribuir entrega
    await supabase
      .from('deliveries')
      .update({
        driver_id: selectedDriver.id,
        status: 'assigned',
        assigned_at: new Date().toISOString()
      })
      .eq('id', deliveryId);

    // 7. Atualizar status do driver
    await supabase
      .from('delivery_drivers')
      .update({ status: 'busy' })
      .eq('id', selectedDriver.id);

    // 8. Enviar notificação WhatsApp
    await notifyDriver(selectedDriver, delivery);

    return new Response(
      JSON.stringify({ 
        success: true, 
        driver: selectedDriver 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error assigning driver:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function notifyDriver(driver: any, delivery: any) {
  const message = `
🚀 *Nova Entrega Atribuída!*

📦 *Pedido #${delivery.order_id.slice(0, 8)}*

📍 *Retirar em:*
${delivery.pickup_address}

📍 *Entregar em:*
${delivery.delivery_address}
${delivery.delivery_instructions ? `\n📝 ${delivery.delivery_instructions}` : ''}

💰 *Valor:* ${formatCurrency(delivery.order.total_amount)}
📞 *Cliente:* ${delivery.order.user_phone}

⏱️ *Tempo estimado:* ${delivery.estimated_duration_minutes} min

🗺️ Abrir navegação: ${generateMapsLink(delivery)}

*Comandos:*
1️⃣ COLETEI - Marcar como coletado
2️⃣ SAINDO - A caminho do cliente
3️⃣ ENTREGUE - Confirmar entrega
0️⃣ PROBLEMA - Reportar problema
  `.trim();

  // Enviar via WhatsApp (reutilizar função existente)
  await sendWhatsAppMessage(driver.phone, message);
}

function generateMapsLink(delivery: any): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${delivery.pickup_lat},${delivery.pickup_lng}&destination=${delivery.delivery_lat},${delivery.delivery_lng}&travelmode=driving`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}
```

### `driver-webhook`
```typescript
// supabase/functions/driver-webhook/index.ts
// Recebe comandos dos entregadores via WhatsApp

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { from, body } = await req.json();
    
    // Normalizar comando
    const command = body.trim().toUpperCase();
    
    // Buscar entregador
    const { data: driver } = await supabase
      .from('delivery_drivers')
      .select('*')
      .eq('phone', from)
      .single();
    
    if (!driver) {
      return sendWhatsAppMessage(from, 
        'Você não está cadastrado como entregador. Entre em contato com o restaurante.'
      );
    }
    
    // Buscar entrega ativa do driver
    const { data: delivery } = await supabase
      .from('deliveries')
      .select('*, order:orders(*)')
      .eq('driver_id', driver.id)
      .in('status', ['assigned', 'picked_up', 'on_the_way'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!delivery) {
      return sendWhatsAppMessage(from,
        'Você não possui entregas ativas no momento.'
      );
    }
    
    // Processar comando
    switch (command) {
      case 'COLETEI':
      case '1':
        await handlePickup(delivery);
        break;
        
      case 'SAINDO':
      case '2':
        await handleOnTheWay(delivery);
        break;
        
      case 'ENTREGUE':
      case '3':
        await handleDelivered(delivery, driver);
        break;
        
      case 'PROBLEMA':
      case '0':
        await handleProblem(delivery, from);
        break;
        
      default:
        await sendHelp(from);
    }
    
    return new Response(JSON.stringify({ success: true }));
    
  } catch (error) {
    console.error('Driver webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400 }
    );
  }
});

async function handlePickup(delivery: any) {
  await supabase
    .from('deliveries')
    .update({
      status: 'picked_up',
      picked_up_at: new Date().toISOString()
    })
    .eq('id', delivery.id);
  
  // Notificar cliente
  const clientMessage = `
🍕 Seu pedido foi coletado!

O entregador está a caminho. 
Tempo estimado: ${delivery.estimated_duration_minutes} minutos.

Acompanhe em tempo real: ${generateTrackingLink(delivery.id)}
  `.trim();
  
  await sendWhatsAppMessage(delivery.order.user_phone, clientMessage);
  
  // Confirmar ao driver
  const driverMessage = `
✅ Pedido marcado como *COLETADO*!

📍 Entregar em:
${delivery.delivery_address}

🗺️ ${generateMapsLink(delivery)}

Quando chegar no local, envie *SAINDO* ou *2*
  `.trim();
  
  await sendWhatsAppMessage(delivery.driver.phone, driverMessage);
}

async function handleOnTheWay(delivery: any) {
  await supabase
    .from('deliveries')
    .update({
      status: 'on_the_way',
      on_the_way_at: new Date().toISOString()
    })
    .eq('id', delivery.id);
  
  // Notificar cliente
  const clientMessage = `
🚴 Entregador a caminho!

Seu pedido está saindo para entrega agora!
Chegada prevista: ${getEstimatedArrival(delivery)}

📞 Contato do entregador: ${delivery.driver.phone}
  `.trim();
  
  await sendWhatsAppMessage(delivery.order.user_phone, clientMessage);
  
  // Confirmar ao driver
  await sendWhatsAppMessage(delivery.driver.phone,
    '✅ Status atualizado para *A CAMINHO*!\n\nBoa entrega! Quando entregar, envie *ENTREGUE* ou *3*'
  );
}

async function handleDelivered(delivery: any, driver: any) {
  await supabase
    .from('deliveries')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString()
    })
    .eq('id', delivery.id);
  
  // Atualizar métricas do driver
  const deliveryTime = calculateDeliveryTime(delivery);
  
  await supabase
    .from('delivery_drivers')
    .update({
      total_deliveries: driver.total_deliveries + 1,
      successful_deliveries: driver.successful_deliveries + 1,
      status: 'active' // volta para disponível
    })
    .eq('id', driver.id);
  
  // Notificar cliente
  const clientMessage = `
✅ Pedido entregue!

Obrigado por escolher ${delivery.order.restaurant.name}!

Como foi sua experiência?
Avalie em: ${generateRatingLink(delivery.id)}

Bom apetite! 😋
  `.trim();
  
  await sendWhatsAppMessage(delivery.order.user_phone, clientMessage);
  
  // Confirmar ao driver
  await sendWhatsAppMessage(driver.phone,
    `✅ Entrega concluída com sucesso!\n\nTempo de entrega: ${deliveryTime} min\nVocê está disponível para novas entregas.`
  );
}

async function handleProblem(delivery: any, driverPhone: string) {
  const problemOptions = `
⚠️ *Reportar Problema*

Selecione o tipo de problema:

1️⃣ Cliente não atende
2️⃣ Endereço incorreto
3️⃣ Cliente cancelou
4️⃣ Acidente/Problema com veículo
5️⃣ Outro

Envie o número correspondente.
  `.trim();
  
  await sendWhatsAppMessage(driverPhone, problemOptions);
}
```

---

## 🎨 Componentes Frontend

### Estrutura de Páginas

```
src/pages/delivery/
├── Drivers.tsx              # Lista e CRUD de entregadores
├── DriverDetail.tsx         # Detalhes e métricas de um entregador
├── DeliveryDashboard.tsx    # Dashboard de entregas ativas
├── DeliveryMap.tsx          # Mapa com entregas em tempo real
└── DeliveryHistory.tsx      # Histórico de entregas

src/components/delivery/
├── DriverCard.tsx           # Card de entregador
├── DriverForm.tsx           # Form para criar/editar entregador
├── DriverStatusBadge.tsx    # Badge com status do entregador
├── DeliveryCard.tsx         # Card de entrega
├── DeliveryTimeline.tsx     # Timeline de status da entrega
├── AssignDriverModal.tsx    # Modal para atribuir entregador
├── DeliveryMapView.tsx      # Mapa com marcadores
└── DriverMetrics.tsx        # Métricas de performance
```

### Hook de Delivery
```typescript
// src/hooks/useDeliveries.ts

export function useDeliveries(restaurantId: string) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;

    fetchDeliveries();

    // Real-time subscription
    const channel = supabase
      .channel('deliveries-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        () => fetchDeliveries()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  async function fetchDeliveries() {
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        *,
        order:orders(*),
        driver:delivery_drivers(*)
      `)
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'assigned', 'picked_up', 'on_the_way'])
      .order('created_at', { ascending: false });

    if (data) {
      setDeliveries(data);
    }
    setLoading(false);
  }

  async function assignDriver(deliveryId: string, driverId?: string) {
    const { data } = await supabase.functions.invoke('assign-delivery-driver', {
      body: {
        deliveryId,
        driverId, // se null, atribuição automática
        mode: driverId ? 'manual' : 'auto'
      }
    });

    return data;
  }

  async function updateStatus(deliveryId: string, status: string) {
    const { error } = await supabase
      .from('deliveries')
      .update({ 
        status,
        [`${status}_at`]: new Date().toISOString()
      })
      .eq('id', deliveryId);

    if (error) throw error;
  }

  return {
    deliveries,
    loading,
    assignDriver,
    updateStatus
  };
}
```

---

## 📊 Métricas e Analytics

### Dashboard de Entregas
- **Entregas Ativas**: Pendentes, atribuídas, em rota
- **Taxa de Sucesso**: % de entregas bem-sucedidas
- **Tempo Médio**: Tempo médio de entrega
- **Entregadores Ativos**: Número de drivers disponíveis
- **Mapa em Tempo Real**: Localização dos entregadores

### Métricas por Entregador
- Total de entregas
- Taxa de sucesso
- Tempo médio
- Rating médio
- Distância percorrida
- Última entrega

---

## 🚀 Implementação (Estimativa: 2-3 semanas)

### Sprint 1 (Semana 1): Database + Backend
- [ ] Migrations: delivery_drivers, deliveries, driver_shifts
- [ ] Edge function: assign-delivery-driver
- [ ] Edge function: driver-webhook
- [ ] Testes de atribuição automática

### Sprint 2 (Semana 1-2): Frontend CRUD
- [ ] Página Drivers (lista)
- [ ] DriverForm (criar/editar)
- [ ] DriverCard component
- [ ] Hook useDrivers

### Sprint 3 (Semana 2): Delivery Dashboard
- [ ] DeliveryDashboard page
- [ ] AssignDriverModal
- [ ] DeliveryTimeline
- [ ] Real-time updates

### Sprint 4 (Semana 2-3): Mapa e Tracking
- [ ] DeliveryMapView
- [ ] Integração Google Maps
- [ ] Location tracking
- [ ] Rota otimizada

---

## 📝 Checklist Final

- [ ] Todos os entregadores testados
- [ ] Atribuição automática funcionando
- [ ] Notificações WhatsApp entregues
- [ ] Mapa em tempo real
- [ ] Comandos via WhatsApp funcionando
- [ ] Métricas de performance corretas
- [ ] RLS validado
- [ ] Documentação completa

# Especificação Técnica - Fase 5: Notificações Automatizadas

## 📋 Visão Geral

Sistema completo de notificações automatizadas para clientes e restaurantes via WhatsApp, browser notifications, e SMS (como add-on pago).

### Objetivos Principais
- ✅ Notificações WhatsApp para clientes (status do pedido)
- ✅ Notificações WhatsApp para entregadores (nova entrega, atualizações)
- ✅ Browser notifications para restaurantes (novo pedido, mensagens)
- ✅ Sistema de templates personalizáveis
- ✅ SMS como add-on (Twilio integration)
- ✅ Email notifications (transacionais)
- ✅ Histórico e logs de notificações
- ✅ Configurações granulares por usuário

---

## 🗄️ Database Schema

### Nova Tabela: `notification_templates`
```sql
CREATE TABLE public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Tipo e Canal
  template_type TEXT NOT NULL, 
  -- 'order_confirmed', 'order_preparing', 'order_ready', 
  -- 'order_out_for_delivery', 'order_delivered',
  -- 'delivery_assigned', 'cart_abandoned', 'customer_inactive'
  
  channel TEXT NOT NULL, -- 'whatsapp', 'sms', 'email', 'browser'
  
  -- Template (suporta variáveis)
  subject TEXT, -- Para email
  body TEXT NOT NULL,
  
  -- Variáveis disponíveis (para referência)
  available_variables JSONB,
  -- Ex: ["customer_name", "order_id", "total_amount", "delivery_address"]
  
  -- Configurações
  is_active BOOLEAN DEFAULT true,
  is_system_template BOOLEAN DEFAULT false, -- templates padrão do sistema
  
  -- Timing
  delay_minutes INTEGER DEFAULT 0, -- atrasar envio
  
  -- Metadata
  language TEXT DEFAULT 'pt-PT',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Garantir apenas um template ativo por tipo+canal+restaurante
  UNIQUE(restaurant_id, template_type, channel, is_active) 
    WHERE is_active = true
);

-- Indexes
CREATE INDEX idx_notification_templates_restaurant ON notification_templates(restaurant_id);
CREATE INDEX idx_notification_templates_type ON notification_templates(template_type);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant templates"
  ON notification_templates FOR ALL
  USING (
    restaurant_id IS NULL -- templates do sistema
    OR user_has_restaurant_access(restaurant_id)
  );

-- Templates do sistema são read-only para users
CREATE POLICY "Users can view system templates"
  ON notification_templates FOR SELECT
  USING (is_system_template = true);
```

### Nova Tabela: `notification_logs`
```sql
CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  
  -- Referências
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  customer_phone TEXT,
  
  -- Notificação
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  
  -- Conteúdo enviado
  subject TEXT,
  body TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending', 
  -- 'pending', 'sent', 'delivered', 'failed', 'read'
  
  -- Timestamps
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Erro (se falhou)
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Provider info
  provider TEXT, -- 'evolution', 'twilio', 'sendgrid', 'firebase'
  provider_message_id TEXT,
  
  -- Custo (para SMS)
  cost_amount NUMERIC,
  cost_currency TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Particionamento por mês (performance)
CREATE INDEX idx_notification_logs_restaurant_date ON notification_logs(restaurant_id, created_at DESC);
CREATE INDEX idx_notification_logs_order ON notification_logs(order_id);
CREATE INDEX idx_notification_logs_customer ON notification_logs(customer_phone);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_scheduled ON notification_logs(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their restaurant notification logs"
  ON notification_logs FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));
```

### Alterar Tabela: `notification_preferences` (já existe)
```sql
-- Adicionar mais granularidade
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS order_confirmed_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_preparing_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_ready_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_out_for_delivery_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_delivered_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS cart_abandoned_enabled BOOLEAN DEFAULT true,
  
  -- Preferência de canal
  ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'whatsapp', -- 'whatsapp', 'sms', 'email'
  
  -- Quiet hours
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_end TIME;
```

---

## 📱 Templates de Notificações

### WhatsApp Templates - Cliente

#### 1. Pedido Confirmado
```
✅ *Pedido Confirmado!*

Olá {{customer_name}}! 

Recebemos o seu pedido #{{order_number}} 🎉

📦 *Itens:*
{{order_items}}

💰 *Total:* {{total_amount}}
📍 *Entrega:* {{delivery_address}}
⏱️ *Previsão:* {{estimated_time}} minutos

Estamos preparando tudo com carinho!

{{restaurant_name}}
```

#### 2. Pedido em Preparação
```
👨‍🍳 *Seu pedido está sendo preparado!*

Olá {{customer_name}}!

Nossos chefs estão preparando seu pedido #{{order_number}} neste momento.

⏱️ Tempo estimado: {{estimated_time}} minutos

{{restaurant_name}}
```

#### 3. Pedido Pronto
```
🎉 *Pedido Pronto!*

{{customer_name}}, seu pedido #{{order_number}} está pronto!

{{#if is_delivery}}
🚴 Em breve nosso entregador sairá para sua entrega.
{{else}}
🏃 Pode vir buscar quando quiser!
{{/if}}

📍 {{restaurant_address}}

{{restaurant_name}}
```

#### 4. Saiu para Entrega
```
🚴 *Saiu para Entrega!*

Boa notícia, {{customer_name}}!

Seu pedido #{{order_number}} saiu para entrega! 📦

🚴 *Entregador:* {{driver_name}}
📞 *Contato:* {{driver_phone}}
⏱️ *Chegada prevista:* {{eta}} minutos

🗺️ Rastrear em tempo real:
{{tracking_link}}

{{restaurant_name}}
```

#### 5. Pedido Entregue
```
✅ *Pedido Entregue!*

Seu pedido #{{order_number}} foi entregue com sucesso! 🎉

Esperamos que aproveite! 😋

⭐ Como foi sua experiência?
Avalie em: {{rating_link}}

Até a próxima!
{{restaurant_name}}
```

### WhatsApp Templates - Entregador

#### 1. Nova Entrega Atribuída
```
🚀 *Nova Entrega!*

📦 Pedido #{{order_number}}

📍 *Retirar:*
{{restaurant_name}}
{{restaurant_address}}

📍 *Entregar:*
{{customer_name}}
{{delivery_address}}
{{#if delivery_instructions}}
📝 {{delivery_instructions}}
{{/if}}

💰 *Valor:* {{total_amount}}
📞 *Cliente:* {{customer_phone}}
⏱️ *Prazo:* {{deadline}} min

🗺️ Navegação:
{{maps_link}}

*Comandos:*
1️⃣ COLETEI
2️⃣ SAINDO
3️⃣ ENTREGUE
0️⃣ PROBLEMA
```

#### 2. Lembrete de Coleta
```
⏰ *Lembrete de Coleta*

O pedido #{{order_number}} está pronto há {{minutes_waiting}} minutos.

Por favor, colete assim que possível.

📍 {{restaurant_address}}

Envie *COLETEI* quando pegar o pedido.
```

### Browser Notifications - Restaurante

#### 1. Novo Pedido
```
Título: 🔔 Novo Pedido Recebido!
Corpo: Pedido #{{order_number}} • {{customer_name}} • {{total_amount}}
```

#### 2. Nova Mensagem WhatsApp
```
Título: 💬 Nova mensagem de {{customer_name}}
Corpo: {{message_preview}}
```

### Email Templates

#### 1. Confirmação de Pedido
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #FF6B35; color: white; padding: 20px; text-align: center; }
    .order-details { background: #f5f5f5; padding: 20px; margin: 20px 0; }
    .total { font-size: 24px; font-weight: bold; color: #FF6B35; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Pedido Confirmado!</h1>
    </div>
    
    <p>Olá {{customer_name}},</p>
    
    <p>Recebemos o seu pedido e já estamos preparando tudo!</p>
    
    <div class="order-details">
      <h2>Pedido #{{order_number}}</h2>
      
      <h3>Itens:</h3>
      {{#each items}}
        <p>{{quantity}}x {{name}} - {{price}}</p>
      {{/each}}
      
      <hr>
      
      <p class="total">Total: {{total_amount}}</p>
      
      <p><strong>Entrega em:</strong> {{delivery_address}}</p>
      <p><strong>Previsão:</strong> {{estimated_time}} minutos</p>
    </div>
    
    <p>Obrigado por escolher {{restaurant_name}}!</p>
    
    <p>
      <a href="{{tracking_link}}" style="background: #FF6B35; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Acompanhar Pedido
      </a>
    </p>
  </div>
</body>
</html>
```

---

## 🔌 Edge Functions

### `send-notification`
```typescript
// supabase/functions/send-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendWhatsAppMessage } from '../_shared/evolutionClient.ts';

interface NotificationPayload {
  restaurantId: string;
  notificationType: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'browser';
  recipient: string; // phone, email, or user_id
  templateVariables: Record<string, any>;
  orderId?: string;
  deliveryId?: string;
  scheduleFor?: string; // ISO timestamp
}

serve(async (req) => {
  try {
    const payload: NotificationPayload = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Verificar preferências do usuário
    const preferencesValid = await checkNotificationPreferences(
      supabase,
      payload.recipient,
      payload.notificationType
    );

    if (!preferencesValid) {
      console.log('Notification blocked by user preferences');
      return new Response(
        JSON.stringify({ success: false, reason: 'User opted out' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar template
    const { data: template } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('restaurant_id', payload.restaurantId)
      .eq('template_type', payload.notificationType)
      .eq('channel', payload.channel)
      .eq('is_active', true)
      .single();

    if (!template) {
      // Fallback para template do sistema
      const { data: systemTemplate } = await supabase
        .from('notification_templates')
        .select('*')
        .is('restaurant_id', null)
        .eq('template_type', payload.notificationType)
        .eq('channel', payload.channel)
        .eq('is_system_template', true)
        .single();

      if (!systemTemplate) {
        throw new Error('Template not found');
      }
    }

    // 3. Renderizar template com variáveis
    const renderedBody = renderTemplate(
      template?.body || systemTemplate!.body,
      payload.templateVariables
    );

    const renderedSubject = template?.subject 
      ? renderTemplate(template.subject, payload.templateVariables)
      : null;

    // 4. Criar log
    const { data: log, error: logError } = await supabase
      .from('notification_logs')
      .insert({
        restaurant_id: payload.restaurantId,
        order_id: payload.orderId,
        delivery_id: payload.deliveryId,
        customer_phone: payload.channel === 'whatsapp' || payload.channel === 'sms' 
          ? payload.recipient 
          : null,
        notification_type: payload.notificationType,
        channel: payload.channel,
        template_id: template?.id,
        subject: renderedSubject,
        body: renderedBody,
        status: payload.scheduleFor ? 'pending' : 'sent',
        scheduled_for: payload.scheduleFor,
        sent_at: payload.scheduleFor ? null : new Date().toISOString()
      })
      .select()
      .single();

    if (logError) throw logError;

    // 5. Se não for agendado, enviar imediatamente
    if (!payload.scheduleFor) {
      const result = await dispatchNotification(
        payload.channel,
        payload.recipient,
        renderedSubject,
        renderedBody,
        log.id
      );

      // Atualizar log com resultado
      await supabase
        .from('notification_logs')
        .update({
          status: result.success ? 'delivered' : 'failed',
          delivered_at: result.success ? new Date().toISOString() : null,
          failed_at: result.success ? null : new Date().toISOString(),
          error_message: result.error,
          provider: result.provider,
          provider_message_id: result.messageId
        })
        .eq('id', log.id);

      return new Response(
        JSON.stringify({ success: result.success, logId: log.id }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Se agendado, retornar sucesso (será processado por cron)
    return new Response(
      JSON.stringify({ success: true, scheduled: true, logId: log.id }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function checkNotificationPreferences(
  supabase: any,
  recipient: string,
  notificationType: string
): Promise<boolean> {
  // Buscar preferências do usuário
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_phone', recipient) // ou user_id
    .single();

  if (!prefs) return true; // sem preferências = aceita tudo

  // Mapear tipo de notificação para campo de preferência
  const prefField = `${notificationType}_enabled`;
  
  return prefs[prefField] !== false;
}

function renderTemplate(template: string, variables: Record<string, any>): string {
  let rendered = template;

  // Substituir variáveis {{variable_name}}
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, String(value));
  }

  // Processar condicionais simples {{#if variable}}...{{/if}}
  rendered = rendered.replace(
    /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g,
    (_, varName, content) => {
      return variables[varName] ? content : '';
    }
  );

  // Processar loops simples {{#each items}}...{{/each}}
  rendered = rendered.replace(
    /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g,
    (_, varName, template) => {
      const items = variables[varName];
      if (!Array.isArray(items)) return '';
      
      return items.map(item => {
        let itemRendered = template;
        for (const [key, value] of Object.entries(item)) {
          itemRendered = itemRendered.replace(
            new RegExp(`{{\\s*${key}\\s*}}`, 'g'),
            String(value)
          );
        }
        return itemRendered;
      }).join('');
    }
  );

  return rendered.trim();
}

async function dispatchNotification(
  channel: string,
  recipient: string,
  subject: string | null,
  body: string,
  logId: string
): Promise<{ success: boolean; error?: string; provider?: string; messageId?: string }> {
  try {
    switch (channel) {
      case 'whatsapp':
        const whatsappResult = await sendWhatsAppMessage(recipient, body);
        return {
          success: true,
          provider: 'evolution',
          messageId: whatsappResult?.key?.id
        };

      case 'sms':
        const smsResult = await sendSMS(recipient, body);
        return {
          success: true,
          provider: 'twilio',
          messageId: smsResult.sid
        };

      case 'email':
        const emailResult = await sendEmail(recipient, subject!, body);
        return {
          success: true,
          provider: 'sendgrid',
          messageId: emailResult.messageId
        };

      case 'browser':
        // Push notification via Firebase Cloud Messaging
        const pushResult = await sendPushNotification(recipient, subject!, body);
        return {
          success: true,
          provider: 'firebase',
          messageId: pushResult.messageId
        };

      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function sendSMS(phone: string, message: string) {
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
  const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')!;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      From: TWILIO_PHONE_NUMBER,
      To: phone,
      Body: message
    })
  });

  return await response.json();
}

async function sendEmail(to: string, subject: string, html: string) {
  const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'noreply@zendy.app', name: 'Zendy' },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });

  return await response.json();
}

async function sendPushNotification(userId: string, title: string, body: string) {
  // Implementar com Firebase Cloud Messaging
  // Requer FCM token do usuário armazenado no banco
  
  const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY')!;
  
  // Buscar FCM token do usuário
  // const token = await getFCMToken(userId);
  
  // Enviar notificação
  // ...
  
  return { messageId: 'fcm_message_id' };
}
```

### `process-scheduled-notifications` (Cron)
```typescript
// supabase/functions/process-scheduled-notifications/index.ts
// Executar a cada 1 minuto

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Buscar notificações pendentes que devem ser enviadas
  const { data: pending } = await supabase
    .from('notification_logs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .limit(100);

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }));
  }

  let processed = 0;

  for (const notification of pending) {
    try {
      // Chamar função send-notification
      await supabase.functions.invoke('send-notification', {
        body: {
          ...notification,
          scheduleFor: null // enviar agora
        }
      });

      processed++;
    } catch (error) {
      console.error(`Failed to process notification ${notification.id}:`, error);
      
      // Atualizar log com erro
      await supabase
        .from('notification_logs')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_message: error.message,
          retry_count: notification.retry_count + 1
        })
        .eq('id', notification.id);
    }
  }

  return new Response(
    JSON.stringify({ processed }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

---

## 🎨 Componentes Frontend

```
src/pages/notifications/
├── NotificationSettings.tsx   # Configurações de notificações
├── NotificationTemplates.tsx  # Editor de templates
└── NotificationLogs.tsx       # Histórico de notificações

src/components/notifications/
├── TemplateEditor.tsx         # Editor WYSIWYG de templates
├── NotificationPreview.tsx    # Preview do template
├── NotificationLogTable.tsx   # Tabela de logs
└── NotificationToggle.tsx     # Toggle de preferências
```

---

## 🚀 Implementação (Estimativa: 1-2 semanas)

### Sprint 1: Backend + Templates
- [ ] Migrations: notification_templates, notification_logs
- [ ] Seed templates padrão do sistema
- [ ] Edge function: send-notification
- [ ] Edge function: process-scheduled-notifications
- [ ] Configurar cron job

### Sprint 2: Frontend
- [ ] NotificationSettings page
- [ ] TemplateEditor component
- [ ] NotificationLogs page
- [ ] Browser notifications setup

---

## 📝 Checklist Final

- [ ] Todos os templates criados
- [ ] WhatsApp notifications testadas
- [ ] Browser notifications funcionando
- [ ] Email notifications funcionando
- [ ] Cron job executando
- [ ] Logs sendo salvos corretamente
- [ ] Preferências respeitadas

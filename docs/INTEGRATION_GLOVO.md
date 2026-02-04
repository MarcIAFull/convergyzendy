# Manual de Integração: Glovo On-Demand

## Visão Geral

A integração Glovo On-Demand permite solicitar estafetas da Glovo diretamente do painel de pedidos para entregar encomendas aos clientes. Esta é uma integração LaaS (Logistics as a Service).

---

## Pré-requisitos

### Do lado do Restaurante
1. **Conta Glovo Partners** ativa
2. **Acesso à API LaaS** - solicitar à Glovo
3. **Credenciais de API**:
   - Client ID
   - Client Secret
4. **Endereço de recolha** com coordenadas GPS

### Como Obter Credenciais

1. Contacte a equipa Glovo: **partner.integrationseu@glovoapp.com**
2. Solicite acesso à **API LaaS (Logistics as a Service)**
3. Receberá credenciais de **Staging** para testes
4. Após validação, receberá credenciais de **Produção**

**Documentação Oficial**: [https://api-docs.glovoapp.com/partners/index.html](https://api-docs.glovoapp.com/partners/index.html)

---

## Configuração

### Passo 1: Aceder às Configurações

1. No painel do restaurante, vá a **Configurações**
2. Selecione o separador **Glovo**

### Passo 2: Introduzir Credenciais

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| Client ID | Identificador da aplicação | `abc123xyz` |
| Client Secret | Chave secreta (nunca partilhar) | `••••••••••` |
| Ambiente | Staging (testes) ou Produção | `Staging` |

### Passo 3: Configurar Endereço de Recolha

O endereço de recolha é onde o estafeta vai buscar o pedido.

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| Endereço | Morada completa | `Rua Augusta 100, Lisboa` |
| Telefone | Contacto do restaurante | `+351 912 345 678` |
| Latitude | Coordenada GPS | `38.7103` |
| Longitude | Coordenada GPS | `-9.1365` |

> 💡 **Dica**: Use o botão "Usar endereço do restaurante" para preencher automaticamente com os dados já configurados.

### Passo 4: Testar Conexão

1. Clique em **Testar Conexão**
2. Aguarde a validação das credenciais
3. Se bem-sucedido, verá o badge **Conectado**

### Passo 5: Guardar

Clique em **Guardar Configurações** para salvar todas as alterações.

---

## Utilização

### Solicitar Estafeta para um Pedido

1. Aceda aos **Pedidos** no menu lateral
2. Selecione um pedido com status **Confirmado** ou **Em Preparação**
3. No painel de detalhes, encontre a secção **Entrega Glovo**
4. Clique em **Obter Cotação**

### Fluxo de Entrega

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Obter     │────▶│   Aceitar   │────▶│  Estafeta   │
│   Cotação   │     │   Cotação   │     │  Atribuído  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
┌─────────────┐     ┌─────────────┐            ▼
│   Pedido    │◀────│  Em Rota    │◀────┌─────────────┐
│   Entregue  │     │  Entrega    │     │  Recolhido  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Estados da Entrega

| Estado | Descrição | Ação |
|--------|-----------|------|
| `CREATED` | Pedido de entrega criado | Aguardar atribuição |
| `ACCEPTED` | Estafeta aceitou | Ver tempo estimado |
| `WAITING_FOR_PICKUP` | Estafeta a caminho do restaurante | Preparar pedido |
| `PICKED` | Pedido recolhido | Em rota para cliente |
| `DELIVERED` | Entregue ao cliente | ✅ Concluído |
| `CANCELLED` | Cancelado | Ver motivo |
| `EXPIRED` | Expirou sem aceitação | Solicitar novo |

### Informações do Estafeta

Quando um estafeta é atribuído, verá:
- **Nome** do estafeta
- **Telefone** de contacto
- **Localização** em tempo real (lat/long)
- **ETA** - tempo estimado de chegada

### Link de Tracking

É gerado um link de tracking que pode ser partilhado com o cliente para acompanhar a entrega em tempo real.

---

## Custos

### Estrutura de Preços

A Glovo cobra por entrega com base em:
- Distância entre restaurante e cliente
- Horário (picos podem ter taxa adicional)
- Condições meteorológicas

### Cotação vs Valor Final

| Momento | Valor |
|---------|-------|
| Cotação | Estimativa antes de confirmar |
| Valor Final | Cobrado após entrega concluída |

> ⚠️ O valor final pode diferir ligeiramente da cotação devido a ajustes de rota.

---

## Webhook (Atualizações Automáticas)

A integração recebe atualizações automáticas via webhook:

| Evento | Descrição |
|--------|-----------|
| `STATUS_UPDATE` | Mudança de estado da entrega |
| `POSITION_UPDATE` | Nova posição do estafeta |

### URL do Webhook

Configure no painel Glovo:
```
https://[seu-projeto].supabase.co/functions/v1/glovo-webhook
```

### Webhook Secret

Para validar a autenticidade dos callbacks, configure o **Webhook Secret** nas definições.

---

## Resolução de Problemas

### Erro: "Glovo token not available"

**Causa**: Token de acesso expirado ou credenciais inválidas.

**Solução**:
1. Verifique as credenciais em Configurações > Glovo
2. Clique em "Testar Conexão"
3. Se falhar, verifique com a Glovo se as credenciais estão ativas

### Erro: "Outside delivery area"

**Causa**: O endereço do cliente está fora da área de cobertura Glovo.

**Solução**:
- Verifique se a Glovo opera na zona do cliente
- Considere entrega própria para esta área

### Cotação Expira

**Causa**: As cotações têm validade limitada (geralmente 10-15 minutos).

**Solução**:
- Solicite uma nova cotação
- Confirme rapidamente após obter cotação

### Estafeta não Aparece

**Causa**: Pode haver poucos estafetas disponíveis na zona/horário.

**Solução**:
- Aguarde alguns minutos
- Em horários de pico, pode demorar mais
- Contacte suporte Glovo se demorar muito

---

## Ambientes

### Staging (Testes)

- **URL Base**: `https://stageapi.glovoapp.com/`
- Use para testar a integração
- Entregas simuladas (não reais)
- Credenciais específicas de staging

### Produção

- **URL Base**: `https://api.glovoapp.com/`
- Entregas reais com custo
- Apenas após validação completa em staging

---

## Boas Práticas

1. **Teste em Staging primeiro** - Valide todo o fluxo antes de ir para produção
2. **Prepare o pedido antes** - O estafeta chegará rapidamente
3. **Mantenha telefone atualizado** - Para o estafeta contactar se necessário
4. **Verifique coordenadas GPS** - Coordenadas erradas causam atrasos
5. **Comunique ao cliente** - Partilhe o link de tracking

---

## Suporte

### Glovo Partners
- Email: partner.integrationseu@glovoapp.com
- Portal: partners.glovoapp.com

### Documentação API
- [https://api-docs.glovoapp.com/partners/](https://api-docs.glovoapp.com/partners/)

---

## Changelog

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0 | 2024-02 | Versão inicial com cotação, booking e tracking |

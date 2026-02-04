# Manual de Integração: ZoneSoft POS

## Visão Geral

A integração ZoneSoft POS permite enviar pedidos confirmados diretamente para o sistema de caixa e cozinha ZoneSoft, onde são impressos automaticamente os tickets/cupons.

---

## Pré-requisitos

### Do lado do Restaurante

1. **Licença ZS Rest ativa** na ZoneSoft
2. **Módulo ZSAPIFood (Developer)** ativado - solicitar à ZoneSoft
3. **Registo na plataforma de integração**: [developer.zonesoft.org](https://developer.zonesoft.org)
4. **Credenciais de API**:
   - Client ID
   - App Key
   - App Secret
5. **Store ID** da loja a integrar

### Como Obter Credenciais

1. Aceda a [developer.zonesoft.org](https://developer.zonesoft.org)
2. Registe a sua aplicação
3. Solicite acesso à API ZSAPIFood
4. Receberá:
   - **Client ID**: Identificador do cliente/loja
   - **App Key**: Chave pública da aplicação
   - **App Secret**: Chave secreta para assinaturas HMAC

**Suporte ZoneSoft**: geral@zonesoft.org

---

## Configuração

### Passo 1: Aceder às Configurações

1. No painel do restaurante, vá a **Configurações**
2. Selecione o separador **ZoneSoft**

### Passo 2: Ativar Integração

Ative o switch **Ativar Integração ZoneSoft**.

### Passo 3: Introduzir Credenciais API

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| Client ID | ID do cliente na ZoneSoft | `12345` |
| App Key | Chave da aplicação | `app_key_abc123` |
| App Secret | Chave secreta (nunca partilhar) | `••••••••••` |

> ⚠️ **Segurança**: O App Secret é usado para gerar assinaturas HMAC-SHA256 e nunca é exposto no frontend.

### Passo 4: Configuração da Loja

| Campo | Descrição | Onde Encontrar |
|-------|-----------|----------------|
| Store ID (loja) | ID da loja no ZoneSoft | Backoffice ZoneSoft > Lojas |
| Warehouse ID (armazém) | ID do armazém padrão | Backoffice > Armazéns |
| Operator ID (emp) | ID do operador | Backoffice > Empregados |
| Tipo de Documento | Tipo de documento a emitir | Ver tabela abaixo |
| Série | Série do documento | Backoffice > Séries |
| Tipo de Pagamento | Método de pagamento padrão | Ver tabela abaixo |

### Tipos de Documento Disponíveis

| Código | Descrição | Uso Típico |
|--------|-----------|------------|
| `TK` | Ticket | Pedidos delivery/takeaway |
| `VD` | Venda a Dinheiro | Venda direta |
| `FR` | Fatura-Recibo | Com dados fiscais |
| `FC` | Fatura | Para empresas |

### Tipos de Pagamento

| ID | Descrição |
|----|-----------|
| 1 | Numerário |
| 2 | Multibanco |
| 3 | MBWay |
| 4 | Crédito |
| 5 | Transferência |

### Passo 5: Testar Conexão

1. Clique em **Testar Conexão**
2. O sistema valida as credenciais junto da API ZoneSoft
3. Se bem-sucedido, verá **Conexão bem-sucedida**

### Passo 6: Guardar

Clique em **Guardar Configurações** para salvar todas as alterações.

---

## Mapeamento de Produtos

### Porquê Mapear?

O mapeamento associa os produtos do seu menu aos produtos no ZoneSoft. Isto permite:
- Relatórios de vendas corretos no ZoneSoft
- Gestão de stock integrada
- Códigos de produto consistentes

### Como Mapear

1. Após configurar as credenciais, clique em **Sincronizar Produtos**
2. O sistema busca a lista de produtos do ZoneSoft
3. Clique em **Mapear Produtos**
4. Para cada produto do seu menu, selecione o equivalente no ZoneSoft

### Produtos Não Mapeados

Produtos sem mapeamento serão enviados com:
- Nome original do produto
- Preço configurado no seu sistema
- Código genérico

> ⚠️ Produtos não mapeados podem não aparecer corretamente nos relatórios do ZoneSoft.

---

## Utilização

### Envio Manual de Pedido

1. Aceda aos **Pedidos** no menu lateral
2. Selecione um pedido com status **Confirmado**
3. No painel de detalhes, encontre a secção **ZoneSoft POS**
4. Clique em **Enviar para POS**

### Envio Automático (Opcional)

Se configurado, os pedidos são enviados automaticamente quando:
- O status muda para **Confirmado**
- O restaurante tem ZoneSoft ativo
- A integração está em modo automático

### Estados de Sincronização

| Estado | Descrição | Ação |
|--------|-----------|------|
| `pending` | Aguardando envio | Será processado |
| `success` | Enviado com sucesso | Ver nº documento |
| `error` | Falha no envio | Verificar erro e reenviar |

### Após Envio Bem-Sucedido

Verá:
- ✅ **Enviado para ZoneSoft**
- **Documento**: TK SERIE/1234
- **Data/Hora** do envio

O ticket será impresso automaticamente no POS/impressora configurada no ZoneSoft.

---

## Estrutura do Pedido Enviado

```json
{
  "document": [{
    "doc": "TK",
    "serie": "W2024",
    "loja": 5,
    "cliente": 0,
    "nome": "João Silva",
    "telefone": "+351912345678",
    "morada": "Rua X, 123, Lisboa",
    "pagamento": 1,
    "emp": 100,
    "data": "2024-02-04",
    "datahora": "2024-02-04 14:30:00",
    "observacoes": "Sem cebola",
    "ivaincluido": 1,
    "vendas": [
      {
        "codigo": 123,
        "descricao": "Pizza Margherita",
        "qtd": 2,
        "punit": 12.50,
        "iva": 23,
        "total": 25.00
      }
    ]
  }]
}
```

### Campos do Documento

| Campo | Descrição |
|-------|-----------|
| `doc` | Tipo de documento |
| `serie` | Série configurada |
| `loja` | Store ID |
| `cliente` | 0 = Consumidor final |
| `nome` | Nome do cliente |
| `telefone` | Telefone do cliente |
| `morada` | Endereço de entrega |
| `pagamento` | Tipo de pagamento |
| `emp` | Operator ID |
| `observacoes` | Notas do pedido |
| `ivaincluido` | 1 = IVA incluído nos preços |
| `vendas` | Array de linhas/produtos |

### Campos de Cada Linha

| Campo | Descrição |
|-------|-----------|
| `codigo` | Código do produto no ZoneSoft |
| `descricao` | Nome do produto |
| `qtd` | Quantidade |
| `punit` | Preço unitário |
| `iva` | Taxa de IVA (%) |
| `total` | Total da linha |

---

## Autenticação da API

### HMAC-SHA256

Todas as chamadas à API ZoneSoft são autenticadas via HMAC:

```
Headers:
- X-ZS-CLIENT-ID: {client_id}
- X-ZS-APP-KEY: {app_key}
- X-ZS-SIGNATURE: {hmac_sha256(body, app_secret)}
```

A assinatura é gerada automaticamente pela nossa edge function.

### Processo de Assinatura

```typescript
// 1. Stringify do body JSON
const bodyString = JSON.stringify(requestBody);

// 2. Gerar HMAC-SHA256 com app_secret
const signature = HMAC_SHA256(bodyString, appSecret);

// 3. Converter para hexadecimal
const signatureHex = toHex(signature);
```

---

## Resolução de Problemas

### Erro: "Invalid signature"

**Causa**: A assinatura HMAC não corresponde.

**Solução**:
1. Verifique se o App Secret está correto
2. Confirme que não há espaços extra nas credenciais
3. Teste a conexão novamente

### Erro: "Client not found"

**Causa**: Client ID inválido ou não registado.

**Solução**:
1. Verifique o Client ID no portal developer.zonesoft.org
2. Confirme que a loja está ativa

### Erro: "Store not found"

**Causa**: Store ID não existe ou não pertence ao cliente.

**Solução**:
1. Verifique o Store ID no backoffice ZoneSoft
2. Confirme permissões da API para essa loja

### Erro: "Product not found"

**Causa**: Código de produto não existe no ZoneSoft.

**Solução**:
1. Sincronize os produtos
2. Mapeie o produto corretamente
3. Ou deixe sem mapeamento (usará descrição genérica)

### Erro: "Rate limit exceeded"

**Causa**: Demasiadas chamadas em pouco tempo (máx 20 req/2s).

**Solução**:
- Aguarde alguns segundos
- O sistema tem retry automático

### Ticket Não Imprime

**Causa**: Problema no ZoneSoft ou impressora.

**Solução**:
1. Verifique se o documento foi criado no backoffice ZoneSoft
2. Confirme configuração da impressora no ZoneSoft
3. O nosso sistema apenas envia - a impressão é gerida pelo ZoneSoft

---

## Logs de Sincronização

### Visualizar Logs

Os logs de todas as sincronizações são guardados para auditoria:
- Data/hora da tentativa
- Ação executada
- Status (sucesso/erro)
- Número do documento (se sucesso)
- Mensagem de erro (se falhou)

### Reenviar Pedido

Se um envio falhou:
1. Corrija o problema identificado no log
2. Clique em **Reenviar para POS** no painel do pedido

---

## Boas Práticas

1. **Teste em ambiente de staging** antes de produção
2. **Mapeie todos os produtos** para relatórios corretos
3. **Verifique a impressora** no ZoneSoft regularmente
4. **Mantenha credenciais seguras** - nunca partilhe o App Secret
5. **Sincronize produtos periodicamente** após adicionar novos itens ao menu

---

## Endpoints da API

### URL Base
```
https://api.zonesoft.org/v3/
```

### Interfaces Utilizadas

| Interface | Ação | Descrição |
|-----------|------|-----------|
| `documents` | `saveInstances` | Criar documentos (pedidos) |
| `documents` | `getInstances` | Consultar documentos |
| `products` | `getInstances` | Listar produtos |

---

## Suporte

### ZoneSoft
- Email: geral@zonesoft.org
- Portal Developer: [developer.zonesoft.org](https://developer.zonesoft.org)
- Documentação: Fornecida no portal developer

---

## Changelog

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0 | 2024-02 | Versão inicial com envio de documentos e mapeamento de produtos |

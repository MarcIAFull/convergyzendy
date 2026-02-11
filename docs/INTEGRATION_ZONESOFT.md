# Manual de Integração: ZoneSoft POS

## Visão Geral

A integração ZoneSoft POS permite enviar pedidos confirmados diretamente para o sistema de caixa e cozinha ZoneSoft, onde são impressos automaticamente os tickets/cupons.

> ⚠️ **IMPORTANTE**: A ZoneSoft tem **duas APIs diferentes**:
> - **ZSROI (ZS Restaurant Ordering)** - Para encomendas e takeaway. Endpoint: `zsroi.zonesoft.org/v1.0/`
> - **ZSAPI** - Para sincronização de produtos e criação de documentos. Endpoint diferente.
> 
> Cada API requer uma **integração separada** no portal [developer.zonesoft.org](https://developer.zonesoft.org).

---

## Pré-requisitos

### Do lado do Restaurante

1. **Licença ZS Rest ativa** na ZoneSoft
2. **Integração ZSROI** (ZS Restaurant Ordering) - para envio de pedidos
3. **Integração ZSAPI** (opcional) - para sincronização de produtos e documentos
4. **Registo na plataforma de integração**: [developer.zonesoft.org](https://developer.zonesoft.org)
5. **Credenciais de API** (para cada integração):
   - Client ID
   - App Key
   - App Secret
6. **Store ID** da loja a integrar

### Como Obter Credenciais

1. Aceda a [developer.zonesoft.org](https://developer.zonesoft.org)
2. Registe a sua aplicação
3. Crie uma integração com permissão **ZSROI** (para encomendas)
4. Opcionalmente, crie outra integração com permissão **ZSAPI** (para sincronização)
5. Para cada integração receberá:
   - **Client ID**: Identificador do cliente/loja
   - **App Key**: Chave pública da aplicação
   - **App Secret**: Chave secreta para assinaturas HMAC (usar como **string UTF-8**)

**Suporte ZoneSoft**: suporte@zonesoft.pt

---

## APIs e Endpoints

### ZSROI (ZS Restaurant Ordering)

| Campo | Valor |
|-------|-------|
| **Endpoint** | `https://zsroi.zonesoft.org/v1.0/` |
| **Headers** | `Authorization`, `X-Integration-Signature` |
| **Permissão** | ZS Restaurant Ordering |
| **Uso** | Encomendas e takeaway |

### ZSAPI (Sincronização)

| Campo | Valor |
|-------|-------|
| **Endpoint** | `https://zsapi.zonesoft.org/v1.0/` |
| **Headers** | `Authorization`, `X-Integration-Signature` |
| **Permissão** | ZSAPI |
| **Uso** | Sincronização de produtos, criação de documentos |

> **Nota**: As duas APIs são diferentes no endpoint e nos headers. Consulte os manuais em [developer.zonesoft.org](https://developer.zonesoft.org) nas respetivas abas.

---

## Configuração

### Passo 1: Aceder às Configurações

1. No painel do restaurante, vá a **Configurações**
2. Selecione o separador **ZoneSoft**

### Passo 2: Ativar Integração

Ative o switch **Ativar Integração ZoneSoft**.

### Passo 3: Introduzir Credenciais ZSROI (Obrigatório)

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| Client ID | ID do cliente ZSROI | `442FFE2F...` |
| App Key | Chave da aplicação ZSROI | `2AB458CE...` |
| App Secret | Chave secreta ZSROI (string UTF-8) | `••••••••••` |

### Passo 3b: Credenciais ZSAPI (Opcional)

Se tiver uma integração ZSAPI separada para sincronização de produtos:

| Campo | Descrição |
|-------|-----------|
| ZSAPI Client ID | ID do cliente ZSAPI |
| ZSAPI App Key | Chave da aplicação ZSAPI |
| ZSAPI App Secret | Chave secreta ZSAPI |

> ⚠️ **Segurança**: Os App Secrets são usados para gerar assinaturas HMAC-SHA256 e nunca são expostos no frontend.

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
- Authorization: {client_id}
- X-Integration-Signature: {hmac_sha256(body, app_secret)}
```

A assinatura é gerada automaticamente pela nossa edge function.

O App Secret deve ser usado como **string UTF-8** (não como bytes hex decodificados).

---

## Resolução de Problemas

### Erro: "401 Unauthorized"

**Causas possíveis**:
1. Credenciais incorretas
2. **Permissão errada** - usando credenciais ZSROI para endpoints ZSAPI ou vice-versa
3. Assinatura HMAC incorreta

**Solução**:
1. Verifique se está a usar as credenciais corretas para cada API
2. Para sincronização de produtos: precisa de permissão **ZSAPI**
3. Para envio de pedidos: precisa de permissão **ZSROI** (ou ZSAPI)
4. Contacte suporte@zonesoft.pt se necessário

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

## Suporte

### ZoneSoft
- Email: suporte@zonesoft.pt
- Portal Developer: [developer.zonesoft.org](https://developer.zonesoft.org)
- Documentação: Fornecida no portal developer nas abas ZSROI e ZSAPI

---

## Changelog

| Versão | Data | Alterações |
|--------|------|------------|
| 2.0 | 2026-02 | Corrigido endpoint para zsroi.zonesoft.org/v1.0, headers para Authorization + X-Integration-Signature, suporte a duas APIs (ZSROI + ZSAPI) |
| 1.0 | 2024-02 | Versão inicial com envio de documentos e mapeamento de produtos |

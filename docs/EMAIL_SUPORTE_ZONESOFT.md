# Email de Suporte ZoneSoft - Bona Bocca Graça

**Para:** suporte@zonesoft.pt  
**Assunto:** Erro 401 Unauthorized - Integração ZSAPIFood - Bona Bocca Graça

---

Prezada equipa ZoneSoft,

Estamos a desenvolver uma integração com a ZSAPIFood para o restaurante **Bona Bocca | Graça** e estamos a receber consistentemente erro **HTTP 401 Unauthorized** em todas as chamadas à API.

## Dados da Configuração

| Campo | Valor |
|-------|-------|
| **Client ID** | `442FFE2F3699B1C1E4BA7B22A2F906EE` |
| **App Key** | `2AB458CE2AB458CE2E2EE02EE05F5FF15FF1996BB6CFBB946B09B6CFBB946B09` |
| **App Secret** | `8DF679C80FEAE73F7FB99C303A2747A2` |
| **Store ID (Loja)** | 1 |
| **Warehouse ID (Armazém)** | 1 |
| **Operator ID (Empregado)** | 100 |

## Exemplo de Request

```http
POST https://zsapifood.zfrserver.com/api/products/getInstances
Content-Type: application/json
X-Auth-Client: 442FFE2F3699B1C1E4BA7B22A2F906EE
X-Auth-Signature: [HMAC-SHA256 do body com App Secret]

{"product":{"loja":1}}
```

## Resposta Recebida

```json
{
  "Response": {
    "StatusCode": 401,
    "StatusMessage": "Unauthorized",
    "Content": {
      "product": null
    }
  }
}
```

## Questões Técnicas

1. O **Client ID** está corretamente associado à **loja ID 1**?
2. A assinatura **HMAC-SHA256** deve usar o App Secret como **string UTF-8** ou como **bytes Hex decodificados**?
3. Os endpoints `products/getInstances` e `Documents/saveInstances` estão ativos para este contrato?
4. Existe algum requisito adicional de headers ou autenticação que não estejamos a cumprir?

## Informação Adicional

- **Plataforma:** Sistema de pedidos online com integração POS
- **Objetivo:** Sincronizar produtos e enviar documentos de venda (Tickets/TK)
- **Ambiente:** Produção

Agradecemos o vosso apoio na resolução desta questão.

Com os melhores cumprimentos,  
**[Seu Nome]**  
**[Seu Contacto]**

---

> ⚠️ **ATENÇÃO:** Este documento contém credenciais sensíveis. Não partilhar publicamente.

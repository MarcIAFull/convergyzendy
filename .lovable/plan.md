
# Plano: Resolver Erro 401 na Integração ZoneSoft

## Diagnóstico Atual

O erro `401 Unauthorized` persiste mesmo após:
- Store ID preenchido corretamente (loja 1 e 2)
- Credenciais compartilhadas (App Key/Secret iguais, Client ID diferente por unidade)
- Múltiplos formatos de assinatura HMAC tentados (hex, base64, uppercase)

### Dados Confirmados no Banco

| Restaurante | Client ID | Store ID | Erro |
|-------------|-----------|----------|------|
| Bona Bocca Graça | `442FFE2F...` | 1 | 401 |
| Bona Bocca Barreiro | `0C9B9212...` | 2 | 401 |

## Causas Prováveis

1. **Endpoint de teste incorreto**: O endpoint `products/getInstances` pode não ser acessível para o módulo ZSAPIFood contratado
2. **Formato do body**: A ZoneSoft pode esperar campos específicos que não estão sendo enviados
3. **Client ID não associado ao Store ID**: O ID de cliente pode não ter permissão para a loja específica

## Solução Proposta

### 1. Adicionar logs detalhados do request completo

Antes de enviar, logar:
- URL completa
- Headers (mascarados)
- Body exato (JSON string)
- Assinatura usada

### 2. Testar com endpoint alternativo

Além de `products/getInstances`, tentar:
- `documents/getInstances` - listar documentos
- Um endpoint mais básico se disponível

### 3. Adicionar campo de debug na UI

Mostrar ao utilizador os dados exatos sendo enviados para facilitar comparação com a documentação da ZoneSoft.

### 4. Verificação de formato do body

Garantir que o body JSON não tem espaços extras e está em formato compacto.

---

## Detalhes Técnicos

### Alterações em `supabase/functions/zonesoft-api/index.ts`

```text
1. Adicionar log completo do request antes de enviar:
   - Mostrar URL, headers, body, assinatura (preview)

2. Criar função auxiliar para testar múltiplos endpoints:
   - Tentar products/getInstances primeiro
   - Se 401, tentar documents/getInstances como fallback
   
3. Retornar no erro o body exato que foi enviado para debug
```

### Alterações em `src/components/settings/ZoneSoftTab.tsx`

```text
1. Mostrar detalhes do erro 401 de forma mais clara
2. Adicionar botão "Ver detalhes do request" que mostra o que foi enviado
3. Incluir link direto para documentação/portal ZoneSoft
```

### Validação das Credenciais

```text
1. Verificar se Client ID tem exatamente 32 caracteres hex
2. Verificar se App Key tem o formato esperado
3. Verificar se App Secret está em formato hex (32 chars = 128 bits)
```

---

## Próximos Passos Manuais

Após implementar as melhorias de debug, será necessário:

1. **Verificar no portal ZoneSoft** se o Client ID está associado à loja correta
2. **Confirmar com suporte ZoneSoft** qual endpoint usar para teste de conexão
3. **Comparar** o request enviado com exemplos da documentação oficial

---

## Resultado Esperado

- Logs detalhados para identificar discrepância
- Mensagens de erro mais claras na UI
- Possibilidade de identificar se o problema é de permissões no lado da ZoneSoft

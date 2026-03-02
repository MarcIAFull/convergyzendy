

## Problema: `free_addons_count` ignorado no menu digital

O campo `free_addons_count` existe no cadastro do produto, mas o menu publico nunca o consulta. Em 3 locais, todos os addons selecionados sao somados ao preco, independentemente do limite gratuito.

### Correções

**1. `src/components/public/ProductModal.tsx`**

- `calculateTotalPrice()`: separar addons em gratuitos e pagos com base em `product.free_addons_count`. Os primeiros N addons (ordenados pela selecao) sao gratuitos; os restantes somam ao total.
- UI: mostrar visualmente quais addons sao gratuitos (ex: "Gratis" em vez de "+ €X,XX") e informar o usuario quantos adicionais gratuitos restam (ex: "Escolha ate 4 adicionais gratis").

**2. `src/stores/publicCartStore.ts`**

- `addItem()`: calcular `addonsTotal` considerando `product.free_addons_count` — os primeiros N addons nao somam preco.
- `updateItemQuantity()`: mesma logica ao recalcular o preco unitario.

### Logica de calculo

```text
free = product.free_addons_count ?? 0
selectedAddons = [...todos os selecionados]
freeAddons = selectedAddons.slice(0, free)     → preco = 0
paidAddons = selectedAddons.slice(free)        → preco = soma dos precos
addonsTotal = paidAddons.reduce(sum, addon.price)
```

### Arquivos a modificar
- `src/components/public/ProductModal.tsx` — logica de calculo e indicacao visual
- `src/stores/publicCartStore.ts` — `addItem` e `updateItemQuantity`


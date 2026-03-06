

## Plano de Correção Responsiva - Mobile, Tablet e Desktop

### Problemas Identificados

1. **Dashboard/Pedidos (`Dashboard.tsx`)**: 
   - View modes Table e Kanban ficam escondidos em mobile (`hidden sm:flex`), mas se o user guardou essa preferência em `localStorage`, a página fica vazia
   - `container mx-auto` sem `max-w` pode causar layouts demasiado largos em ultrawide
   - Stats cards com `text-2xl` podem ficar cortados em mobile

2. **OrdersList (`OrdersList.tsx`)**:
   - Layout `grid-cols-1 lg:grid-cols-3` — em mobile mostra lista + painel de detalhes empilhados verticalmente, mas o painel de detalhes (`OrderDetailsPanel`) fica abaixo do scroll com `h-[calc(100vh-200px)]`, invisível sem scroll
   - Em mobile deveria usar Drawer (como Table/Kanban fazem) em vez de painel inline

3. **OrdersTable (`OrdersTable.tsx`)**:
   - 8 colunas numa tabela — em tablet fica apertado, em mobile ilegível apesar do `overflow-x-auto`
   - Filtro de status duplicado (já existe no Dashboard header)

4. **OrdersKanban (`OrdersKanban.tsx`)**:
   - 5 colunas fixas de 288px (`w-72`) — totalmente inacessível em mobile
   - `h-[calc(100vh-320px)]` pode não funcionar bem com sidebar colapsada vs expandida

5. **OrderDetailsDrawer (`OrderDetailsDrawer.tsx`)**:
   - Labels em inglês ("Customer Information", "Start Preparing", etc.) — inconsistente com o resto em PT
   - `max-h-[96vh]` pode cortar conteúdo em mobile com barra de endereço

6. **Configurações (`SettingsUnified.tsx`)**:
   - `grid-cols-8` para as tabs — em mobile ficam 8 ícones minúsculos e praticamente inacessíveis
   - Labels ficam `hidden sm:inline`, mas 8 ícones sem texto não são compreensíveis

7. **DashboardLayout**:
   - `overflow-hidden` no main pode esconder conteúdo se páginas internas não gerirem scroll correctamente

### Correções Planeadas

**Ficheiro 1: `src/pages/Dashboard.tsx`**
- Forçar `viewMode = 'list'` em mobile se o valor salvo for `table` ou `kanban`
- Esconder botões Table/Kanban em mobile (já está, mas adicionar fallback)

**Ficheiro 2: `src/components/orders/OrdersList.tsx`**
- Em mobile (`useIsMobile`): ao clicar num pedido, abrir `OrderDetailsDrawer` em vez do painel inline
- Desktop: manter layout 2 colunas (lista + painel)
- Corrigir alturas fixas para usar `dvh` em vez de `vh`

**Ficheiro 3: `src/components/orders/OrdersKanban.tsx`**
- Em mobile: transformar em lista vertical de cards agrupados por status (accordion ou stack)
- Tablet: reduzir para 3 colunas visíveis com scroll horizontal
- Corrigir altura para `dvh`

**Ficheiro 4: `src/components/orders/OrdersTable.tsx`**
- Remover filtro de status duplicado (já existe no Dashboard)
- Em mobile: esconder colunas Endereço e Data, mostrar apenas essenciais
- Melhorar `overflow-x-auto` com indicador visual de scroll

**Ficheiro 5: `src/components/OrderDetailsDrawer.tsx`**
- Traduzir todos os labels para PT-PT (Customer Information → Informações do Cliente, etc.)
- Usar `100dvh` em vez de `96vh`

**Ficheiro 6: `src/pages/SettingsUnified.tsx`**
- Mobile: trocar `grid-cols-8` por tabs com scroll horizontal (`overflow-x-auto flex`)
- Tablet: `grid-cols-4` com 2 linhas
- Garantir que tabs são acessíveis com texto visível ou tooltip

**Ficheiro 7: `src/layouts/DashboardLayout.tsx`**
- Trocar `overflow-hidden` no main por `overflow-auto` para prevenir conteúdo cortado

### Resumo de Ficheiros
- `src/pages/Dashboard.tsx` — fallback de viewMode em mobile
- `src/components/orders/OrdersList.tsx` — drawer em mobile, layout responsivo
- `src/components/orders/OrdersKanban.tsx` — layout adaptativo mobile
- `src/components/orders/OrdersTable.tsx` — colunas responsivas, remover filtro duplicado
- `src/components/OrderDetailsDrawer.tsx` — tradução PT-PT, fix altura
- `src/pages/SettingsUnified.tsx` — tabs responsivas com scroll
- `src/layouts/DashboardLayout.tsx` — fix overflow


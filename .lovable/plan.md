

## Diagnóstico: Race Condition no Auth causando `removeChild` error

O erro ocorre porque o `onAuthStateChange` dispara dois eventos em sequência rápida: `SIGNED_IN` e `INITIAL_SESSION`. Cada evento causa `setSession`/`setUser`, que re-renderiza toda a árvore (`ProtectedRoute` → `DashboardLayout` → `useRestaurantGuard`). O React tenta remover nós DOM que já foram substituídos por outra atualização, gerando o `removeChild` crash.

Causa raiz no `useAuth.tsx`:
- `getSession()` seta estado (render 1)
- `onAuthStateChange` com `SIGNED_IN` seta estado novamente (render 2)  
- `onAuthStateChange` com `INITIAL_SESSION` seta estado novamente (render 3)
- Renders 2 e 3 acontecem quase simultaneamente, causando a race condition no DOM

### Correções

**1. `src/hooks/useAuth.tsx`**
- Seguir o padrão recomendado: registar `onAuthStateChange` ANTES de chamar `getSession()`
- Usar `INITIAL_SESSION` como o evento primário de inicialização (não precisa de `getSession` separado)
- Ignorar eventos redundantes quando o session ID não mudou
- Só marcar `loading: false` uma vez, no primeiro evento válido

**2. `src/components/ProtectedRoute.tsx`**
- Sem alterações estruturais, apenas beneficia da correção do auth

**3. `src/hooks/useRestaurantGuard.tsx`**
- Remover os `console.log` no corpo do render (executam a cada render, poluem console e degradam performance)
- Simplificar a lógica de loading: se `loading` do auth é true, retornar loading sem mais cálculos

### Arquivos a modificar
- `src/hooks/useAuth.tsx` — reordenar init do auth, debounce de eventos
- `src/hooks/useRestaurantGuard.tsx` — remover logs do render body


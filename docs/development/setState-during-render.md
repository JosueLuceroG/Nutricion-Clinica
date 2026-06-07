# setState-during-render warning

## Síntoma

React muestra en consola (F12):

> Cannot update a component (`ForwardRef(X)`) while rendering a different component (`ForwardRef(Y)`).

## Causa

Ocurre cuando un componente en su fase _render_ (cuerpo de la función) ejecuta una acción que dispara un cambio de estado en otra parte del árbol. Las causas típicas en esta app:

1. **Zustand store setter llamado durante render** — ej. un componente lee de un `useLiveQuery` y, basado en el resultado, llama a `useSyncStore.getState().setX()` en el cuerpo del render.
2. **Cascading effects** — un `useEffect` actualiza store A, el store A propaga el cambio, otro `useEffect` reacciona y actualiza store B durante el mismo commit.
3. **Inline callbacks inestables** — una prop callback se redefine en cada render (`() => store.setX()`) forzando re-renders innecesarios.

## Diagnóstico

1. Abrir DevTools (F12) → Console → el warning incluye un **stack trace** que nombra el componente infractor (el que _llama_ setState, no el que lo recibe).
2. Buscar en el stack trace la línea de código dentro de `src/` que dispara el setState.
3. Identificar si el setState ocurre:
   - En el **cuerpo del render** (mal)
   - Dentro de un **useCallback** sin dependencias estables (probable mal)
   - Dentro de un **useEffect** (aceptable si es unidireccional)

## Mitigación

### Prioridad 1: Mover writes a effects o event handlers

```tsx
// MAL: setState directo en render
function Bad() {
  const data = useSomeQuery();
  if (data.length === 0) store.setLoading(true); // ← warning
  return <div>...</div>;
}

// BIEN: efecto controlado
function Good() {
  const data = useSomeQuery();
  useEffect(() => { store.setLoading(data.length === 0); }, [data.length]);
  return <div>...</div>;
}
```

### Prioridad 2: Estabilizar referencias

```tsx
// MAL
<Child onClick={() => store.toggle(id)} />

// BIEN
const toggle = useCallback(() => store.toggle(id), [id]);
<Child onClick={toggle} />
```

### Prioridad 3: `startTransition`

Si la actualización de estado es no urgente (actualiza un contador de UI, no datos críticos):

```tsx
import { startTransition } from "react";
startTransition(() => store.setX(value));
```

### Prioridad 4: Desactivar StrictMode en dev

Si el warning es benigno y el costo de refactor es alto:

```tsx
// main.tsx — solo dev
<React.StrictMode> → <React.Fragment>
```

Esto **no se recomienda en producción** (StrictMode es el único que detecta efectos con cleanup faltante, y eso ya causó bugs reales como el leak de suscripciones de Zustand en `212ac91`).

## Estado actual

- Commit `212ac91` corrigió un leak de suscripciones Zustand que empeoraba el warning en dev (duplicación de handlers en cada mount).
- `NavItemLink` del Sidebar fue envuelto en `React.memo` para evitar re-derivaciones de queries Dexie en re-renders del layout.
- El warning **puede persistir** en vistas que dependen de `useLiveQuery` + escriben a stores globales. Si reaparece, aplicar los pasos de diagnóstico arriba.

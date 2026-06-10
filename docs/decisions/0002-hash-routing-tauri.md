# ADR-002: Hash routing para Tauri

**Estado:** Aceptada · **Contexto:** Sprint 1 · **Última revisión:** Sprint 14

## Contexto

Tauri sirve desde `tauri://` (Windows), `tauri://localhost` (Linux) y
`tauri://localhost` (macOS). La History API de HTML5 no funciona
correctamente con protocolos personalizados ni con `file://`.

## Decisión

Usar `createHashRouter` de React Router en lugar de
`createBrowserRouter`.

## Consecuencias

- **Positivas:** 100% compatible con todos los entornos de Tauri.
  Sin problemas de ruteo en producción. Sin configuración extra de
  servidor (fallback a `index.html`).
- **Negativas:** URLs son `/#/pacientes/{id}` en lugar de
  `/pacientes/{id}`. Ligeramente menos estéticas, irrelevante en app
  desktop sin SEO.

## Alternativas consideradas

1. **BrowserRouter con servidor configurado** — funcionaría en dev con
   Vite pero falla en producción Tauri.
2. **MemoryRouter** — perderías la navegación por URL (marcadores,
   compartir enlaces de consulta).

## Referencias

- Especificación §7.2 (Stack técnico)
- `src/app/router.tsx` — configuración del router

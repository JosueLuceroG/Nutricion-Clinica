# ADR-012: Mantener Desktop primario con un backend compartido

**Estado:** Aceptada · **Contexto:** Release Foundation Step 02 · **Última revisión:** 2026-08-27

## Contexto

NutriClínica es una aplicación Tauri offline-first. Dexie/IndexedDB permite
trabajo local y el protocolo de sync conecta el cliente con SQL Server. El
frontend Web reutiliza la aplicación React, pero es un canal secundario. Una
arquitectura de despliegue podría duplicar backends, tratar Web como producto
principal o intentar contenerizar el cliente Desktop, rompiendo la identidad
de producto y aumentando el riesgo de divergencia de contratos.

## Decisión

- `DESKTOP_TAURI` sigue siendo el canal primario y nunca se ejecuta dentro de
  un contenedor de servidor.
- Web es un canal secundario. Desktop y Web consumen el mismo API Express, el
  mismo contrato API `v1` y el mismo protocolo sync `2`.
- SQL Server OLTP sigue siendo la fuente autoritativa para entidades
  sincronizadas. Dexie schema `33` conserva su función offline-first.
- El origen API de Web es same-origin `/api` detrás del edge. El build Desktop
  recibe una URL HTTPS estable y su CSP debe permitir únicamente el origen
  exacto HTTPS/WSS aprobado para ese target; no se permiten comodines.
- Un cambio breaking exige bump del contrato correspondiente y un despliegue
  coordinado. No se crea un backend especial por canal.

## Consecuencias

- **Positiva:** una sola frontera de seguridad, RBAC, tenant scope, sync y
  trazabilidad para ambos canales.
- **Positiva:** el servidor puede cambiar de proveedor sin cambiar la
  identidad del producto Desktop.
- **Positiva:** la operación offline no depende de disponibilidad permanente
  del servidor.
- **Negativa:** la distribución Desktop requiere configurar/fijar endpoint y
  CSP exactos para cada target aprobado.
- **Negativa:** updater, signing y política temporal N/N-1 siguen siendo gates
  separados; Step 02 no los inventa.

## Alternativas consideradas

1. **Web como producto primario** — descartada porque contradice la identidad
   offline-first y el contrato de release existente.
2. **Backend independiente para Desktop** — descartado por duplicar lógica,
   datos y superficie de seguridad.
3. **Desktop en contenedor** — descartado: Tauri es software de estación de
   trabajo y necesita WebView, filesystem y signing de plataforma.

## Referencias

- `docs/operations/desktop-web-release-contract.md`
- `docs/operations/deployment-architecture.md`
- `src/services/sync/syncEngine.ts`
- `src-tauri/tauri.conf.json`

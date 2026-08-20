# Staging Infrastructure Requirements (09.5A-S1)

Fecha: 2026-08-20. Rama: `hardening/remediation-09-5a` (sin push).
Clasificación: **C. NO_REAL_STAGING_INFRASTRUCTURE**.

Este documento NO elige proveedor. No se compra ni se provisiona nada sin
autorización del operador (§3). Define el mínimo aceptable para que el
mismo release de NutriClínica pueda desplegarse fuera de la máquina de
desarrollo, y el estado actual de cada componente.

## 1. Fuente del estado actual (inventario del repositorio, commit 56bbe4e)

- GitHub Actions: `.github/workflows/ci.yml` (solo calidad: lint/typecheck/
  test/build; NO corre sobre ramas `hardening/**`; NO levanta SQL Server;
  NO despliega) y `.github/workflows/release.yml` (tags `v*` → artefactos
  Tauri desktop → GitHub Releases). No existe workflow de despliegue.
- `Dockerfile` (raíz): build estático de frontend (nginx → `dist/`),
  frontend-only; no contiene la API; ningún workflow/script lo referencia.
- `nginx.conf`: solo `listen 80`, sin TLS.
- `scripts/`: únicamente verificación (verify-deployment-b09-5a.ps1,
  verify-dwh-b08.ps1, verify-sql-037.ps1, verify-telemetry-b09.ps1). Sin
  scripts de provisionamiento ni despliegue.
- Sin infraestructura como código (no terraform/docker-compose/k8s), sin
  config de servidor, sin DNS, sin certificados, sin secret store.
- Contrato de despliegue seguro: `apps/api/.env.example` (Build 09.5A) —
  `ENVIRONMENT_CLASS`, `INSTANCE_ID`, `RELEASE_VERSION`, `AI_CERTIFICATION_STORE`,
  guards STAGING/PRODUCTION (DB_NAME/DWH_DATABASE explícitos y distintos,
  CORS sin comodines, PRODUCTION sin contraseña vacía). Verificado localmente,
  nunca ejecutado contra infraestructura real.
- Todos los targets actuales son de la máquina de desarrollo: SQL Server
  `localhost\SQLEXPRESS`, API `http://localhost:3000`, CORS
  `localhost:1420`/`tauri://localhost`, Ollama local.

## 2. Requisitos mínimos

Un entorno de staging válido debe ser operativamente distinto de LOCAL y de
PRODUCTION (§2): identidad no producción, OLTP no producción, DWH no
producción, secretos no producción, API desplegable, frontend desplegable,
endpoint de red real (o entorno aislado equivalente), `environmentClass =
STAGING`, observabilidad, kill switches, camino de rollback y camino de
backup/rebuild. HTTPS si es alcanzable por red externa.

## 3. Matriz de requisitos

| COMPONENTE | REQUISITO MÍNIMO | ESTADO ACTUAL | BLOQUEADOR | ACCIÓN DEL OPERADOR |
|---|---|---|---|---|
| Compute / host API | Host no producción con Node 24 + pnpm; runtime de la API (tsx o build `tsc`); red alcanzable | NINGUNO — API solo corre local (`pnpm --filter @nutriclinica/api dev`); Dockerfile es frontend-only | No hay host provisionado ni proveedor seleccionado/autorizado | Seleccionar y autorizar proveedor (o servidor on-prem); provisionar VM/contenedor; instalar Node 24 + pnpm |
| Frontend host | Host estático (nginx u otro) sirviendo `dist/` con `VITE_API_BASE_URL` de staging | NINGUNO — solo build local; Dockerfile+nginx.conf existen sin TLS y sin despliegue | No hay host; sin DNS/TLS | Provisionar host estático; copiar artefacto `dist/` desde build reproducible; verificar que no embebe URLs localhost |
| SQL Server OLTP | Instancia SQL Server dedicada no producción; BD OLTP staging (≠ local, ≠ producción, ≠ DWH) | NINGUNO — solo `localhost\SQLEXPRESS` con BDs desechables de verificación (nc_b09_* ) | Sin instancia remota; sin credenciales | Crear instancia/BD `staging_nc_oltp`; login SQL dedicado con contraseña fuerte generada (nunca la histórica filtrada en git); aplicar migraciones 001→039 |
| SQL Server DWH | Instancia/BD DWH separada (≠ OLTP, ≠ producción DWH); schema dwh-08-002; catálogo semántico | NINGUNO — solo DWH desechable local (nc_b09_dw) | Sin instancia remota; sin credenciales | Crear BD `staging_nc_dw` con schema/versioning independiente (Build 08); login SQL dedicado separado |
| Persistent storage | Volumen persistente para BDs + backups fuera del host efímero | NINGUNO — disco local de desarrollo | Sin storage provisionado | Configurar almacenamiento persistente y ubicación de backup fuera del host (o copia a storage autorizado) |
| HTTPS | Certificado TLS + terminación en reverse proxy para endpoint alcanzable por red externa; no HTTP plano | NINGUNO — nginx.conf `listen 80`; sin certs | Sin DNS, sin dominio, sin CA configurada | Registrar dominio o subdominio staging; emitir cert (ACME o CA del proveedor); terminar TLS en proxy (nginx/caddy/IIS) |
| DNS | Registro A/AAAA (o equivalente) hacia el host staging | NINGUNO — sin registros | Dominio no controlado/definido | Crear registro DNS; verificar propagación |
| Secret storage | Inyección de secretos server-side: SQL, DWH, JWT, encryption key, AI (si aplica); nunca en repo | NINGUNO — solo variables de entorno locales; `.env.example` es contrato, `.env` no se trackea | Sin mecanismo de inyección (vault/secret manager o env file server-side) | Configurar secret store o env file seguro en el host; rotar/generar credenciales nuevas; verificar scan de secretos 0 |
| Backup location | Ubicación protegida y fuera del host para BACKUP DATABASE; artefacto protegido, sin secretos en ruta/nombre/log | NINGUNO — backup de verificación solo a temp local | Sin storage de backup | Crear ruta de backup dedicada con permisos restringidos; ejecutar `BACKUP DATABASE` y prueba de RESTORE en BD distinta |
| Logging | Logs de aplicación + observabilidad (módulo `/observability`, eventos sin PHI); retención configurable; sin PHI crudo | PARCIAL — módulo observabilidad in-app (store memory/sql) con guard PHI y redacción; sin pipeline de logs externo | Sin agregador central ni retención off-host | Conectar salida de logs/telemetría a destino no producción (o documentar retención in-app); verificar 0 PHI crudo |
| Network policy | Firewall/security group: solo puertos necesarios; frontend→API y API→BD; sin exposición innecesaria | NINGUNO — sin política de red definida | Sin infraestructura de red provisionada | Definir/implementar reglas de red del proveedor; restringir acceso administrativo (bastion/VPN) |
| AI runtime (LOCAL_AUTO) | Host con Ollama (o runtime equivalente) para candidatos locales; memoria suficiente; sin credenciales cloud requeridas | LOCAL — Ollama en `localhost`, CPU_ONLY_LOW, 15.7GB RAM; 5 candidatos BLOCKED_BY_DOWNLOAD/HARDWARE; ninguno eligible | Sin modelo eligible (torneo 07.5A: NINGUNO); sin hardware de staging | Provisionar host AI con RAM/CPU acordes (candidatos 4-8B); NO re-ejecutar torneo ahora; NO aprobar modelos fallidos |
| CI/CD deploy | Workflow reproducible/trazable con gate de despliegue; secretos en CI | PARCIAL — `ci.yml` solo calidad (no corre en `hardening/**`); `release.yml` solo artefactos Tauri; sin deploy | Sin credenciales de deploy; sin target; CI sin SQL Server | Añadir (solo si es necesario) workflow de deploy con secretos del proveedor; o documentar despliegue manual reproducible vía runbook |
| SQL CI | Cobertura SQL real SOLO si hay SQL Server genuino corriendo en CI | NO — CI sin servicio SQL Server; verificación SQL real local sigue siendo autoritativa (Build 08/09.5A: nc_b09_* ) | Sin servicio SQL en CI | (Opcional) añadir servicio SQL Server en CI; mientras tanto, mantener verificación local autoritativa (§60) |

## 4. Bloqueadores exactos

1. **Sin proveedor/infraestructura seleccionada ni autorizada** (§3) — no se
   provisiona nada en nombre del operador.
2. **Sin host de aplicación ni frontend** — nada desplegable fuera de la
   máquina de desarrollo.
3. **Sin SQL Server no local** — OLTP y DWH staging no existen.
4. **Sin DNS/TLS/certificados** — endpoint externo imposible hoy.
5. **Sin secret store / inyección de credenciales** — las credenciales de
   staging no existen y no deben crearse sin autorización.
6. **Rotación de credencial SQL histórica STILL_REQUIRED** — pendiente de
   confirmación del operador (no se marca completa porque staging use otra).
7. **Sin modelo clínico eligible** — NUTRICLINICA_LOCAL_AUTO = ABSTAIN;
   SHADOW = BLOCKED_BY_MODEL (comportamiento correcto, no bloqueador de
   infraestructura).
8. **Sin host AI para runtime de modelos** — candidatos locales no pueden
   evaluarse fuera del dev machine.

## 5. Acciones del operador (orden sugerido)

1. Seleccionar y autorizar proveedor/hardware de staging (cloud o on-prem).
2. Definir identidad staging: `ENVIRONMENT_CLASS=STAGING`,
   `INSTANCE_ID=<id seguro>`, `RELEASE_VERSION`, orígenes públicos.
3. Provisionar hosts (API, frontend), 2 BDs SQL separadas, storage de
   backups, DNS + TLS.
4. Generar credenciales nuevas y fuertes (SQL/DWH/JWT/encryption); rotar la
   credencial histórica expuesta en git (confirmar VERIFIED_BY_OPERATOR).
5. Inyectar secretos server-side; nunca commitear `.env`.
6. Ejecutar runbook `docs/operations/staging-bring-up-runbook.md`
   (migraciones 001→039 idempotentes, smoke OLTP/DWH/RAG/memoria/
   observabilidad, AI ABSTAIN, kill switch, shadow BLOCKED_BY_MODEL,
   backup/restore, rollback).
7. Confirmar ownership de infraestructura y designar reviewers
   profesionales para el futuro shadow (09.5B).

## 6. Gate

**REAL STAGING = BLOCKED** (hasta que el operador provea infraestructura).
Esto es un análisis operativo honesto y exitoso, no un bring-up de staging.
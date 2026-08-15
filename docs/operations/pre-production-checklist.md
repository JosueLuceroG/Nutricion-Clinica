# Pre-production checklist

Fecha de preparacion: 2026-06-13

Este checklist cierra el plan inicial despues de implementar agenda profesional, aislamiento multisucursal local, smoke E2E automatizado, hardening API y auditoria clinica local.

## Estado local validado

- [x] `pnpm typecheck` pasa.
- [x] `pnpm --filter @nutriclinica/api typecheck` pasa.
- [x] `pnpm test` pasa: 110 archivos, 1744 tests, 1 skipped.
- [x] `pnpm --filter @nutriclinica/api test` pasa: 19 archivos, 145 tests.
- [x] `pnpm lint` pasa sin errores. Quedan 7 warnings no bloqueantes ya identificados.
- [x] `pnpm build` pasa.
- [x] `pnpm --filter @nutriclinica/api build` pasa.
- [x] `pnpm e2e` pasa con API/frontend levantados temporalmente: 20 tests.
- [x] `git diff --check` no reporto errores, solo warnings CRLF normales en Windows.

## Validacion manual multisucursal en staging

Estado: pendiente de ejecutar contra entorno staging o instalacion real.

- [ ] Crear o confirmar dos sucursales activas con usuarios de prueba.
- [ ] Confirmar que un usuario admin puede cambiar de sucursal y ver datos aislados por `sucursal_id`.
- [ ] Confirmar que un usuario sin acceso recibe rechazo al intentar operar otra sucursal.
- [ ] Crear paciente en sucursal A y confirmar que no aparece en sucursal B.
- [ ] Crear consulta, plan, adherencia y pago en sucursal A y confirmar que dashboard/reportes solo agregan datos de A.
- [ ] Repetir el flujo en sucursal B y confirmar que dashboard/reportes no mezclan datos.
- [ ] Probar cambio de sucursal con datos locales existentes y confirmar que Dexie filtra por sucursal activa.
- [ ] Probar sync pull/push por sucursal y confirmar que `lastPullAt` no se comparte entre sucursales.
- [ ] Probar soft-delete de paciente sincronizado y confirmar que no resucita tras sync.
- [ ] Confirmar que auditoria local registra metadatos de mutaciones clinicas sin payload clinico sensible.

## Variables y secretos

Estado: pendiente de revisar contra valores reales. No registrar secretos en logs ni commits.

- [ ] `NODE_ENV=production` en API productiva.
- [ ] `JWT_SECRET` fuerte, unico por entorno y fuera del repositorio.
- [ ] `FIELD_ENCRYPTION_KEY` o `TOTP_ENCRYPTION_KEY` fuerte para cifrado server-side.
- [ ] `CORS_ORIGIN` restringido a dominios reales, sin comodines.
- [ ] `OPENAI_API_KEY` solo en `apps/api/.env` o secret manager backend.
- [ ] Sin `VITE_AI_API_KEY` ni `VITE_OPENAI_API_KEY` en frontend.
- [ ] `AI_EGRESS_ENABLED=true` solo si el egress IA esta autorizado (fail-closed por defecto) y `AI_ALLOWED_PROVIDERS`/`AI_ALLOWED_MODELS` revisados.
- [ ] `AI_FALLBACK_PROVIDERS` revisado (sin proveedores no autorizados) y breaker (`AI_CIRCUIT_BREAKER_THRESHOLD`/`AI_CIRCUIT_BREAKER_COOLDOWN_MS`) acorde al SLO del egress. Ver `docs/operations/ai-foundation-gate-08.md`.
- [ ] `AI_QUALIFICATION_ENFORCED` y `AI_PINNED_MODEL_VERSIONS` revisados: solo se sirven modelos certificados para la capacidad requerida con version pineada; re-certificar tras cambios del golden dataset (`pnpm --filter @nutriclinica/api ai:evaluate`). Ver `docs/operations/model-evaluation-gate-09.md`.
- [ ] ERP Tools: `AI_TOOLS_ENABLED` y `AI_TOOLS_ALLOWLIST` revisados (fail-closed por defecto) y consentimientos `ai_opt_in` registrados por paciente antes de exponer datos via tools. Ver `docs/operations/erp-tools-10.md`.
- [ ] Nutrition Expert V1: `nutrition_reasoning` certificada solo para gpt-4o-mini/llama3.2 (re-evaluar con `ai:evaluate` antes de produccion); consejo siempre `reviewRequired` (borrador para revision profesional); banderas de seguridad y abstencion verificadas con datos reales. Ver `docs/operations/nutrition-expert-gate-11.md`.
- [ ] Clinical Gate: `AI_EXPERT_ENABLED=true` solo tras pruebas fail-closed; shadow mode + revisiones profesionales activos; umbrales de auto-disable aprobados por el equipo clinico; `AI_CLINICAL_REVIEW_STORE=sql` en multi-instancia (migracion 028). Ver `docs/operations/preproduction-clinical-gate-12.md`.
- [ ] RAG Gate: documentos cargados, aprobados y con vigencia; tiers de evidencia revisados (`unverified` nunca en contexto clinico); `ai:evaluate-retrieval` PASS sobre el golden set; `AI_RAG_DOC_STORE=sql` en multi-instancia (migracion 029). Ver `docs/operations/rag-gate-13.md`.
- [ ] Nutrition Expert V2: `ai:evaluate-groundness` PASS; consejos de prueba con citas `[<docId>]` revisados por el equipo clinico; abstenciones `ungrounded` auditadas. Ver `docs/operations/nutrition-expert-v2-gate-14.md`.
- [ ] AI Memory: consentimientos `ai_memory` de pacientes reales; `AI_MEMORY_STORE=sql` en multi-instancia (migracion 030); politica de retencion validada; revision de consejos con contexto de memoria (nunca fuente clinica autoritativa). Ver `docs/operations/ai-memory-gate-15.md`.
- [ ] DWH/Analytics: `DWH_ENABLED=true` y `DWH_STORE=sql` (migracion 031); source SQL validado contra datos reales; schedule de carga; dashboards BI read-only sobre `/dwh/metrics`; verificacion de que el DWH nunca escribe en OLTP. Ver `docs/operations/dwh-analytics-gate-16.md`.
- [ ] Professional Copilots: catalogo `/ai/copilots` visible; Clinical/Medical/Nursing Expert permanecen fail-closed hasta que existan roles, fuentes, tools, datasets y gates clinicos. Ver `docs/operations/professional-copilots-gate-17.md`.
- [ ] Patient AI: `AI_PATIENT_ENABLED=true` solo tras certificar `patient_support` (re-evaluar con `ai:evaluate`) y revisar los enlaces del portal con scope `ai_support` + consentimientos `ai_patient`; verificar escalamiento y abstenciones con datos reales. Ver `docs/operations/patient-ai-gate-18.md`.
- [ ] Acciones confirmables: `AI_ACTIONS_ENABLED=true` solo tras revisar el allowlist (`/ai/actions`), los consentimientos por accion (p.ej. `ai_memory` para `create_memory_note`) y la politica de TTL/pendientes; `AI_ACTIONS_LEDGER_STORE=sql` en multi-instancia (migracion 032); probar rollback y replay idempotente con datos reales. Ver `docs/operations/confirmable-actions-gate-19.md`.
- [ ] Bounded Agents: `AI_AGENTS_ENABLED=true` solo tras revisar el catalogo (`/ai/agents`), los presupuestos (`AI_AGENTS_MAX_*`) y la politica de confirmacion de cada agente; `AI_AGENTS_LEDGER_STORE=sql` en multi-instancia (migracion 033); probar pause/confirm/resume (`step_confirm`), corte por presupuesto y revalidacion por paso con datos reales. Ver `docs/operations/bounded-agents-gate-20.md`.
- [ ] Future Specialization: `AI_SPECIALIZATION_ENABLED=true` solo tras revisar el catalogo (`/ai/specialization`), la evidencia de pass rates (`AI_SPECIALIZATION_PASS_RATES` desde `ai:evaluate`) y la gobernanza de cada candidato; ninguna especializacion de modelo sin decision `approved` registrada y sin gobierno PHI completo (legal, privacidad, desidentificacion, retencion, aprobacion profesional). Ver `docs/operations/future-specialization-gate-21.md`.
- [ ] `DB_*` apunta a SQL Server staging/produccion con usuario de permisos minimos, no `db_owner`.
- [ ] `DB_ENCRYPT=true` y certificado/trust configurado segun infraestructura real.
- [ ] SMTP real configurado si se enviaran recordatorios/notificaciones.
- [ ] TURN real configurado si habra telemedicina fuera de LAN.
- [ ] `RECORDING_RETENTION_YEARS=10` o politica legal aprobada.
- [ ] `RETENTION_CLEANUP_ENABLED=true` si se habilita cleanup automatico.
- [ ] `LOG_LEVEL` apropiado, sin datos clinicos ni tokens en logs.

## Base de datos, migraciones y respaldo

Estado: pendiente de staging real.

- [ ] Ejecutar backup completo antes de migrar staging.
- [ ] Correr `pnpm --filter @nutriclinica/api migrate` sin `--force`.
- [ ] Confirmar `schema_migrations` hasta `027-oltp-integrity.sql`.
- [ ] Correr `pnpm --filter @nutriclinica/api seed` solo si aplica al entorno.
- [ ] Validar restore desde backup en una base temporal.
- [ ] Confirmar que el usuario SQL productivo no usa permisos amplios de desarrollo.
- [ ] Confirmar retencion y cleanup de grabaciones en entorno controlado.
- [ ] Confirmar que `audit_events` y auditorias de portal conservan trazabilidad requerida.

## Seguridad operativa

Estado: pendiente de infraestructura real.

- [ ] HTTPS obligatorio en frontend/API.
- [ ] WebSocket de telemedicina detras de proxy compatible con upgrade.
- [ ] TURN/TLS configurado si hay llamadas fuera de red local.
- [ ] Rate limit revisado para topologia real. El limitador actual es en memoria.
- [ ] Si hay multiples instancias API, usar store compartido para rate limits o estrategia equivalente.
- [ ] Headers de seguridad activos en API.
- [ ] Registro publico deshabilitado: `POST /auth/register` requiere admin.
- [ ] 2FA TOTP probado con secreto cifrado y compatibilidad legacy si aplica.
- [ ] Auditoria no almacena payload clinico completo.
- [ ] Backups cifrados y con control de acceso.

## Release y go/no-go

Go si se cumple todo lo siguiente:

- [ ] Quality gate local verde.
- [ ] E2E staging verde.
- [ ] Validacion multisucursal manual completada.
- [ ] Migraciones staging aplicadas y backup/restore verificado.
- [ ] Secrets y CORS revisados por entorno.
- [ ] Logs, monitoreo y alertas operativos.
- [ ] Responsable clinico/legal aprueba politica de retencion y manejo de datos.

No-go si ocurre cualquiera de estos puntos:

- [ ] Datos visibles entre sucursales sin autorizacion.
- [ ] Sync mezcla `sucursal_id` o resucita registros eliminados.
- [ ] Auditoria guarda payload clinico sensible completo.
- [ ] Migracion falla o no hay restore probado.
- [ ] Secrets frontend expuestos con prefijo `VITE_`.
- [ ] Egress IA activo sin `AI_EGRESS_ENABLED=true` explicito o con allowlists vacias de proveedor/modelo.
- [ ] Telemedicina falla por CORS/proxy/TURN en entorno real.

## Riesgos residuales

- No sustituye pentest externo.
- No sustituye auditoria legal/compliance formal.
- Rate limit en memoria requiere decision de infraestructura si se escala a multiples instancias.
- La validacion manual multisucursal debe ejecutarse con datos y usuarios reales de staging antes del go-live.

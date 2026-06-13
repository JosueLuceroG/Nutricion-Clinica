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
- [ ] Confirmar `schema_migrations` hasta `019-totp-secret-length.sql`.
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
- [ ] Telemedicina falla por CORS/proxy/TURN en entorno real.

## Riesgos residuales

- No sustituye pentest externo.
- No sustituye auditoria legal/compliance formal.
- Rate limit en memoria requiere decision de infraestructura si se escala a multiples instancias.
- La validacion manual multisucursal debe ejecutarse con datos y usuarios reales de staging antes del go-live.

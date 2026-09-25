# ADR-014: Separar ciclos SQL y ejecutar jobs una sola vez

**Estado:** Aceptada · **Contexto:** Release Foundation Step 02.1 · **Última revisión:** 2026-09-08

## Contexto

OLTP y DWH tienen versiones, patrones de acceso y recuperación distintos. El
API histórico iniciaba cron de retención y ETL dentro de cada proceso, lo que
hace insegura una escala horizontal accidental. Las migraciones SQL no deben
competir entre réplicas ni ejecutarse implícitamente al arrancar la API.

## Decisión

- OLTP y DWH son bases lógicamente distintas. Pueden usar hosts, puertos,
  credenciales y políticas de backup diferentes.
- Las migraciones OLTP `001` a `039` se ejecutan como job one-shot usando
  `node dist-deploy/migrate.js`. Se verifica backup/restore y target antes;
  nunca se ejecutan automáticamente desde la API.
- El schema DWH se aplica separadamente con
  `node dist-deploy/dwh-schema.js` antes de habilitar ETL. La cadena actual
  conserva el artefacto base inmutable `dwh-08-002` y aplica el upgrade aditivo
  `dwh-08-003`.
- Checksums/versiones son inmutables. Un drift exige una migración/version
  nueva; `--force` no forma parte del procedimiento normal de despliegue.
- La API canónica usa `BACKGROUND_JOBS_ENABLED=false`. Retención y ETL se
  ejecutan en exactamente un proceso `node dist-deploy/jobs.js`, con
  `BACKGROUND_JOBS_ENABLED=true` y schedules explícitos.
- `noOverlap` y el lease SQL atómico por pipeline reducen solapamiento ETL,
  pero no autorizan múltiples runners: ETL queda
  `BLOCKED_NO_LEASE_RENEWAL` porque el lease expira a los 60 minutos sin
  renovación, y retención queda `BLOCKED_NO_DISTRIBUTED_LOCK`.
- `API_REPLICAS=1` y `JOBS_REPLICAS=1` son el único perfil certificado;
  STAGING/PRODUCTION rechazan valores mayores con
  `MULTI_REPLICA_NOT_CERTIFIED`.
- La API también se mantiene en una sola réplica hasta externalizar
  broadcast WebSocket y estados/rate limits in-process. Horizontal API y
  horizontal jobs quedan `BLOCKED`.

## Consecuencias

- **Positiva:** fallos de migración detienen el rollout antes de reemplazar la
  aplicación.
- **Positiva:** OLTP, DWH y aplicación pueden recuperarse con ritmos distintos.
- **Positiva:** se evitan borrados de retención y cargas ETL duplicados por
  cada réplica API.
- **Negativa:** el operador/orquestador debe modelar dependencias explícitas:
  backup -> migrate OLTP -> schema DWH -> API/Web -> jobs.
- **Negativa:** no hay high availability horizontal todavía; el objetivo
  inicial necesita reinicio supervisado y rollback rápido.

## Alternativas consideradas

1. **Migrar al arrancar cada API** — descartado por carreras y rollouts
   parcialmente migrados.
2. **Mantener cron dentro de API** — descartado como topología de despliegue;
   sigue disponible solo para desarrollo local compatible.
3. **Introducir un sistema externo de colas** — pospuesto hasta existir una
   necesidad operativa y target autorizados.

## Referencias

- `apps/api/src/db/migrate.ts`
- `apps/api/src/modules/dwh/schema/applyDwhSchema.ts`
- `apps/api/src/jobs.ts`
- `apps/api/src/services/jobs/runtimeJobs.ts`
- `docs/operations/deployment-architecture.md`

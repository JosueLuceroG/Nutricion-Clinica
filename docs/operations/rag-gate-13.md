# RAG Gate (Fase 13)

Conocimiento gobernado para retrieval: tiers de evidencia, ACL por
rol/sucursal, aprobacion y vigencia documental, retrieval evaluation, citas
verificables y pruebas de poisoning.

## Knowledge governance (`rag/knowledgeGovernance.ts`)

- Documento: `{ id, sucursalId (null = global), title, category, tier,
  content, status, approvedBy, approvedAt, expiresAt, allowedRoles,
  createdAt }`.
- Tiers de evidencia (`clinical_guideline > institutional_protocol >
  peer_reviewed > educational > unverified`); `unverified` NUNCA se sirve en
  contexto clinico (fail-closed, `isTierUsableForClinical`).
- Ciclo documental: `draft -> approved` (solo admin) con vigencia
  (`expiresAt` futura obligatoria); un documento vencido deja de ser usable
  sin borrado.
- ACL: `allowedRoles` por documento + alcance por sucursal (`sucursalId`
  null = global).
- `isDocUsable`: aprobado + no vencido + rol permitido + sucursal + tier
  usable. El retrieval filtra con esta regla ANTES de puntuar.

## Retrieval determinista (`rag/retrieval.ts`)

- Sin embeddings: scoring por solape de terminos (titulo pondera x3,
  contenido x1) + desempate determinista por `docId`; chunking por limites de
  palabra (`RAG_MAX_CHUNK_CHARS`, default 900).
- `retrieve` aplica gobernanza (usabilidad) y devuelve chunks con
  `{ docId, title, tier, category, chunkIndex, snippet, score }` (fuente
  verificable para citas).

## Citas verificables (`rag/citationVerifier.ts`)

- Formato de cita en la salida del modelo: `[<uuid del documento>]`.
- `verifyCitations`: toda cita debe pertenecer al conjunto recuperado;
  cualquier cita sin respaldo => `ok: false` (bloqueo/abstencion en la
  integracion de la fase 14).

## Retrieval evaluation (`rag/retrievalEvaluation.ts` + CLI)

- Golden set (`rag/retrievalGoldenSet.ts`): 5 documentos y 4 consultas con
  `expectedDocIds`; reporte por consulta (recall/precision) + promedios;
  `passed = recall promedio >= umbral` (`RAG_RETRIEVAL_MIN_RECALL`, default
  0.6).
- CLI: `npm run ai:evaluate-retrieval` (`scripts/evaluateRetrieval.ts`);
  exit != 0 si no pasa.

## Poisoning guard (`rag/poisoningGuard.ts`)

- `POISONING_MARKERS` (inyeccion de prompt, "ignora las instrucciones", ...):
  documento no aprobado con marcador => `poisoningAttempt`; aprobado =>
  `suspicious`.
- `runPoisoningTests`: siembra docs benignos + envenenados y verifica que
  NINGUN documento envenenado se recupera (la gobernanza lo excluye por no
  aprobado / tier).

## Endpoints (`/ai/rag`, auth + sucursal + rate limit)

- `POST /documents`: registra borrador (rol `nutriologa`+).
- `POST /documents/:id/approve`: aprueba (solo `admin`; 404 si no existe,
  409 si no es borrador).
- `POST /retrieve`: retrieval gobernado (rol `nutriologa+`): `{ query,
  topK? }` -> `{ query, sources }`.

## Archivos

- `apps/api/src/modules/ai/rag/` (knowledgeGovernance, retrieval,
  citationVerifier, retrievalEvaluation, retrievalGoldenSet, poisoningGuard,
  ragRoutes + tests)
- `apps/api/src/scripts/evaluateRetrieval.ts` + script `ai:evaluate-retrieval`
- `apps/api/migrations/029-rag-gate.sql` (tabla `knowledge_docs`)
- `apps/api/src/server.ts` (monta `/ai/rag`)

## Estado

Completada localmente; staging pendiente (migracion 029, carga y aprobacion de
documentos reales, `AI_RAG_DOC_STORE=sql`, golden set ampliado con el equipo
clinico). La integracion al workflow del expert es la fase 14.
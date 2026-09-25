# Patient AI (Fase 18)

Soporte educativo para pacientes dentro del portal (`/patient-portal`),
con scopes estrictos, consentimiento propio, minimizacion de datos,
evidencia exclusivamente educativa, lenguaje seguro, escalamiento
profesional y abstencion fail-closed. No es un consejo clinico: si la
pregunta toca sintomas, medicamentos o urgencias, el flujo escala al
profesional sin invocar al modelo.

## Capacidad (`patient_support`)

- Nueva capability `patient_support` en `capabilities.ts`.
- Ningun modelo esta certificado para ella en `certification.ts` =>
  `aiGateway.complete(..., { requiredCapability: 'patient_support' })`
  deniega por defecto con `AI_QUALIFICATION_ENFORCED=true` (fail-closed
  en produccion hasta que exista un dataset de evaluacion especifico).
- `AIModelCapability` se reutiliza como tipo en `aiGateway` (antes un
  union literal).

## Autorizacion en dos capas (fail-closed)

1. **Scope del enlace del portal**: nuevo scope `ai_support` en
   `PortalScopeSchema`. No esta en `DEFAULT_SCOPES`: un profesional debe
   incluirlo explicitamente al crear el enlace (opt-in estricto).
2. **Consentimiento `ai_patient`**: registro en `consentimientos`
   (mismo patron que `ai_opt_in`/`ai_memory`).

El flujo deniega 403 si falta el scope o el consentimiento; 404 si el
token no existe/expira/esta revocado; 503 si el kill switch
(`AI_PATIENT_ENABLED`, default `false`) esta apagado o el almacen no
esta disponible.

## Guardrails (`patientGuardrails.ts`)

- `ESCALATION_MARKERS`: sintomas de urgencia, medicamentos, embarazo,
  diabetes, suicidio, etc. Si la consulta los contiene => estado
  `escalated` con mensaje fijo que pide contactar a la nutriologa, sin
  llamar al modelo.
- `UNSAFE_OUTPUT_PATTERNS` + `safeLanguageCheck`: diagnostico,
  prescripcion ("suspenda", "tome su medicamento"), alarmismo
  ("es grave", "puede ser mortal") => abstencion `unsafe_language`.

## Workflow (`patientWorkflow.ts`)

- **Minimizacion de datos**: el prompt contiene solo la pregunta del
  paciente y las fuentes educativas; nunca identificadores, contexto
  clinico ni memoria. (Test que verifica que no se filtran `pac-1`,
  `Ana` ni `suc-1` al prompt.)
- **Evidencia apropiada**: recuperacion RAG filtrada a tier
  `educational` (`retrieveEducational`), vigente, aprobada y con
  `allowedRoles` (mismas reglas `isDocUsable`).
- Orden de verificaciones sobre la salida:
  1. `verifyCitations` (solo docIds recuperados) => `ungrounded`.
  2. `checkOutputNumbers` sobre el contenido sin citas, con numeros
     permitidos extraidos de los snippets => `unverifiable`.
  3. `safeLanguageCheck` => `unsafe_language`.
- `knowledge_unavailable` si el store falla (fail-closed); sin fuentes
  educativas => `ungrounded`; gateway caido => `ai_unavailable` (503).
- Envelope propio `patient_support` (fuentes, citations, ai,
  abstention, escalated) sin datos del paciente.

## API (`/ai/patient/:token/support`, publica por token + rate limit)

- `POST /:token/support` con `{ query }` (max 500 chars).
- Auditoria en `patient_portal_audit_events` (evento
  `ai_support_requested`) + `audit_log` con `entity_type`
  `patient_ai_support`; falla de auditoria no bloquea la respuesta.

## Archivos

- `apps/api/src/modules/ai/patientAi/` (config, patientGuardrails,
  patientWorkflow, patientRoutes + 4 archivos de test)
- `apps/api/src/modules/ai/evaluation/capabilities.ts` (+ `patient_support`)
- `apps/api/src/modules/ai/aiGateway.ts` (tipo `AIModelCapability`)
- `apps/api/src/modules/patientPortal/patientPortalRoutes.ts` (scope
  `ai_support`, evento `ai_support_requested`, exports de
  `loadPortalAccess`/`recordPortalAudit`/`PortalAccessRow`)
- `apps/api/src/server.ts` (monta `/ai/patient`)
- `apps/api/.env.example` (`AI_PATIENT_ENABLED`, `AI_PATIENT_MAX_QUERY_CHARS`)

## Estado

Completada localmente. El kill switch esta apagado por defecto y la
capability no esta certificada; el endpoint responde 503 hasta que se
habilite explicitamente (`AI_PATIENT_ENABLED=true`) y los modelos se
certifiquen para `patient_support`.
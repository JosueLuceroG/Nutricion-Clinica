# Nutrition Expert V2 (Fase 14)

Integracion del RAG Gate al workflow del expert: retrieval gobernado, citas
verificables en el evidence envelope, abstencion ante citas sin respaldo y
evaluacion de groundness.

## Retrieval gobernado en el workflow

- `NutritionWorkflow` recupera conocimiento de `knowledgeStore`
  (`AI_RAG_DOC_STORE`, default memory) ANTES de generar el consejo, usando
  `buildKnowledgeQuery(ctx, goal, notes)`: objetivo + notas + perfil del
  paciente (genero, edad) + terminos base.
- El retrieval aplica la gobernanza de la fase 13 (`isDocUsable`): solo
  documentos aprobados, vigentes, con rol y sucursal permitidos y tier usable.
- Si el store falla (DB caida), fail-closed: abstencion
  `knowledge_unavailable` (no se genera consejo sin conocimiento).

## Citas verificables

- El prompt incluye la seccion `## Conocimiento de respaldo` con cada chunk
  rotulado `[<docId>] <titulo> (<tier>): <snippet>`; las instrucciones exigen
  citar `[<docId>]` solo desde esa seccion.
- Tras la generacion, `verifyCitations` valida que TODA cita de la salida
  pertenezca al conjunto recuperado. Cita sin respaldo => abstencion
  `ungrounded` (el borrador no se entrega).
- El evidence envelope gana `type: 'knowledge'` por chunk recuperado y un
  bloque `citations: { ok, cited, verified, missing }` para auditoria.
- El check de numeros sin respaldo se aplica sobre la salida SIN los UUID de
  citas (los digitos de los ids no son cifras inventadas).

## Evaluacion de groundness

- `rag/groundedGeneration.ts`: para cada consulta del golden set, recupera,
  genera (generador inyectable) y verifica citas; `passed` solo si TODAS las
  consultas quedan grounded (sin citas sin respaldo).
- CLI: `npm run ai:evaluate-groundness` (`scripts/evaluateGroundness.ts`);
  exit != 0 si no pasa.

## Archivos

- `apps/api/src/modules/ai/expert/nutritionWorkflow.ts` (retrieval +
  verificacion de citas + buildKnowledgeQuery)
- `apps/api/src/modules/ai/expert/evidenceEnvelope.ts` (fuente `knowledge` +
  bloque `citations`)
- `apps/api/src/modules/ai/expert/abstentionPolicy.ts` (kinds
  `knowledge_unavailable`, `ungrounded`)
- `apps/api/src/modules/ai/rag/groundedGeneration.ts` + tests
- `apps/api/src/modules/ai/expert/nutritionWorkflowRag.test.ts`
- `apps/api/src/scripts/evaluateGroundness.ts` + script `ai:evaluate-groundness`

## Estado

Completada localmente; staging pendiente: validar el golden set ampliado con
el equipo clinico, probar con modelos reales (clave de proveedor) y revisar
consejos con citas en produccion. No hay cambios de API publica ni de env.
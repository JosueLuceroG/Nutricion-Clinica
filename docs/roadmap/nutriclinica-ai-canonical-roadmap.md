# NutriClinica AI Canonical Roadmap

Este roadmap consolida el Master Architecture Plan, el Master Plan Addendum y
los Build Guardrails. Es la secuencia canonica para continuar la implementacion.
No reemplaza los hallazgos detallados del plan maestro.

## 1. Fase 0A.1 - JWT y 2FA

Hardening de tipos de token, expiracion, validacion estricta, enrolamiento TOTP
y reemplazo seguro del factor.

Estado: completada localmente; despliegue staging pendiente.

## 2. Fase 0A.2 - RBAC de sync

Autorizacion de `POST /sync/push` por rol, entidad, operacion y campo, con
prevalidacion completa del batch.

Estado: completada localmente; despliegue staging pendiente.

## 3. Fase 0A.3 - Backup y restore

Acceso exclusivo de administrador, reautenticacion, grants de un solo uso,
auditoria y restore local transaccional.

Estado: completada localmente; migracion y recuperacion staging pendientes.

## 4. Fase 0A.4 - Aislamiento local y WebSockets

Aislamiento multisucursal en Dexie, ownership de la cola sync, binding de
requests al contexto capturado y hardening de signaling/chat WebSocket.

Estado: siguiente incremento; auditoria inicial realizada.

## 5. Fase 0A.5 - XSS, sesiones y CI backend

Eliminar sinks inseguros, endurecer sesiones y revocacion, validar origen y
credenciales realtime, y hacer obligatorios los gates backend en CI.

Estado: pendiente.

## 6. Fase 0B - Integridad OLTP y sync

Definir fuente autoritativa por entidad, alinear Dexie/API/SQL, aplicar
concurrencia optimista y transacciones, corregir billing y expediente, y
formalizar migraciones SQL/Dexie y compatibilidad offline.

Estado: completada localmente (ver `docs/operations/sync-integrity-0b.md`);
migraciones SQL 023/024/026/027 y validación en staging pendientes.

## 7. AI Security Foundation

Eliminar secretos AI del frontend, crear `CredentialProvider`, runtime kill
switch y `AIDataEgressPolicy`, con fail-closed y auditoria de egress.

Estado: completada localmente (ver `docs/operations/ai-security-foundation-0c.md`);
despliegue staging pendiente (activar `AI_EGRESS_ENABLED` y allowlists).

## 8. AI Foundation Gate

Crear `AIProviderAdapter`, conformance suite, adapters OpenAI/Ollama, Provider
Registry, Model Registry, Model Router, Fallback Policy, Model Circuit Breaker,
AI Gateway, Orchestrator y audit normalizado.

Estado: completada localmente (ver `docs/operations/ai-foundation-gate-08.md`);
despliegue staging pendiente (revisar `AI_FALLBACK_PROVIDERS`,
`AI_CIRCUIT_BREAKER_THRESHOLD` y `AI_CIRCUIT_BREAKER_COOLDOWN_MS`).

## 9. Model Evaluation Gate

Qualification, certificacion granular, Model Cards, Nutrition Golden Dataset,
comparacion de modelos, version pinning y revalidacion por cambios.

Estado: completada localmente (ver `docs/operations/model-evaluation-gate-09.md`);
despliegue staging pendiente (revisar `AI_QUALIFICATION_ENFORCED` y
`AI_PINNED_MODEL_VERSIONS` antes de habilitar capacidades nuevas).

## 10. ERP Tools

Tools read-only allowlisted, permisos y consentimiento centralizados, schemas
estrictos, risk metadata, provenance, freshness y resultados auditables.

Estado: completada localmente (ver `docs/operations/erp-tools-10.md`);
despliegue staging pendiente (habilitar `AI_TOOLS_ENABLED`/`AI_TOOLS_ALLOWLIST`
y confirmar consentimientos `ai_opt_in` registrados).

## 11. Nutrition Expert V1 Gate

Workflow controlado con Context Builder, calculadoras y reglas deterministas,
Safety Engine, Evidence Envelope, Abstention Policy y revision profesional.

Estado: completada localmente (ver `docs/operations/nutrition-expert-gate-11.md`);
despliegue staging pendiente (migraciones, antropometrias y consentimientos
registrados, re-evaluacion de modelos con `ai:evaluate`, verificacion de la
guarda de salida contra los modelos reales).

## 12. Pre-production Clinical Gate

Shadow Mode, comparacion profesional, umbrales aprobados, revision de critical
disagreements, pruebas fail-closed y rollback/disable switch.

Estado: completada localmente (ver `docs/operations/preproduction-clinical-gate-12.md`);
staging pendiente (migracion 028, validacion con datos reales,
`AI_CLINICAL_REVIEW_STORE=sql`, calibracion de umbrales con el equipo clinico).

## 13. RAG Gate

Knowledge governance, tiers de evidencia, ACL, aprobacion y vigencia
documental, retrieval evaluation, citas verificables y pruebas de poisoning.

Estado: completada localmente (ver `docs/operations/rag-gate-13.md`); staging
pendiente (migracion 029, carga/aprobacion de documentos reales,
`AI_RAG_DOC_STORE=sql`, golden set ampliado). Integracion al workflow del
expert en la fase 14.

## 14. Nutrition Expert V2

Integracion del RAG al workflow del expert: retrieval gobernado, citas
`[<docId>]` verificadas en el evidence envelope, abstencion ante citas sin
respaldo y evaluacion de groundness.

Estado: completada localmente (ver `docs/operations/nutrition-expert-v2-gate-14.md`);
staging pendiente (golden set ampliado con el equipo clinico, prueba con
modelos reales, revision de consejos con citas).

## 15. AI Memory

Memoria de conversacion, preferencias opt-in y contexto de paciente recuperado
bajo permisos. Debe incluir consentimiento, aislamiento por paciente/usuario/
sucursal, provenance, retencion, eliminacion, auditoria y prohibicion de usar
memoria como fuente clinica autoritativa.

Estado: completada localmente (ver `docs/operations/ai-memory-gate-15.md`);
staging pendiente (consentimientos reales, `AI_MEMORY_STORE=sql`, politica de
retencion validada).

## 16. DWH, ETL/ELT, Analytics y BI

Historico, freshness, lineage, cargas incrementales idempotentes, catalogo
semantico, Analytics API, dashboards y BI read-only opcional. OLTP/ERP conserva
la autoridad sobre el estado clinico actual y DWH nunca modifica OLTP.

Estado: completada localmente (ver `docs/operations/dwh-analytics-gate-16.md`);
staging pendiente (`DWH_STORE=sql` contra SQL Server, validacion del source
SQL, schedule de carga, BI read-only sobre `/dwh/metrics`).

## 17. Professional Copilots

Nutrition Expert ya construido y evolucion de Clinical, Medical y Nursing
Expert cuando existan roles, permisos, fuentes, tools, workflows, datasets y
gates clinicos correspondientes. Todos comparten la infraestructura AI comun.

Estado: completada localmente (ver `docs/operations/professional-copilots-gate-17.md`);
Clinical/Medical/Nursing permanecen fail-closed en el catalogo hasta que
existan sus dependencias.

## 18. Patient AI

Capacidades especificamente certificadas para pacientes, scopes estrictos,
consentimiento, lenguaje seguro, minimizacion de datos, evidencia apropiada,
escalamiento profesional y abstencion fail-closed.

Estado: completada localmente (Gate 18 PASS). Detalle en
`docs/operations/patient-ai-gate-18.md`.

## 19. Acciones confirmables

Acciones limitadas y allowlisted con permisos, consentimiento, contexto,
idempotencia, preview, confirmacion explicita, auditoria, compensacion y
rollback/roll-forward. Ninguna accion clinica critica sera automatica.

Estado: completada localmente (Gate 19 PASS). Detalle en
docs/operations/confirmable-actions-gate-19.md.

## 20. Bounded Agents

Workflows agent-like con `max_steps`, `max_tool_calls`, `max_tokens`,
`max_cost`, timeout, sources/tools permitidas, risk level y confirmation policy.
Cada paso revalida permisos, consentimiento, paciente, sucursal y presupuesto.

Estado: completada localmente (Gate 20 PASS). Detalle en
docs/operations/bounded-agents-gate-20.md.

## 21. Future Specialization Gate

Evaluar fine-tuning, LoRA, distillation, modelos especializados y predictive
analytics solo cuando exista evidencia cuantitativa de insuficiencia de RAG,
tools, prompts, structured outputs y validadores deterministas. PHI nunca se
usa para entrenamiento sin gobierno legal, privacidad, desidentificacion,
retencion y aprobacion profesional explicitos.

Estado: completada localmente (Gate 21 PASS). Detalle en
docs/operations/future-specialization-gate-21.md.

## Gates transversales

Cada etapa requiere, cuando aplique:

- Tests, typecheck, build, security tests y contract tests verdes.
- Migraciones verificadas con estrategia expand/migrate/verify/contract.
- Compatibilidad API, sync, SQL y Dexie documentada.
- Backup y restore verificados antes de cambios destructivos.
- Rollback o roll-forward probado.
- Observabilidad, auditoria, documentacion y runbook actualizados.
- Acceptance criteria cumplidos.
- Cero hallazgos P0/P1 nuevos relacionados con la etapa.

## Cierre de produccion

Staging, pentest, revision legal/NOM/compliance, validacion multisucursal,
recuperacion SQL, secretos, CORS, HTTPS, permisos minimos y go/no-go son gates
de despliegue. No alteran la numeracion 1-21 y deben completarse antes de
habilitar capacidades en produccion.

# Model cards locales y matriz de ranking (Build 07.5)

Referencia honesta de los candidatos locales: metadata verificable, status real
detectado en esta máquina, resultados reales de benchmark. Nada aquí es promesa
de ejecución: un modelo `BLOCKED_BY_DOWNLOAD` NO fue ejecutado.

## Hardware real (detección, no inventario)

| Campo | Valor |
|---|---|
| OS / plataforma | Windows x64 (win32) |
| CPU | Intel i5-13420H, 12 cores |
| RAM | 16 GB total, ~4 GB libres al detectar |
| GPU | ninguna (nvidia-smi ausente) |
| Disco libre | ~35.9 GB (C:) |
| Runtime | Ollama 0.32.14 en http://localhost:11434 |
| HardwareClass | `CPU_ONLY_LOW` (ramGb >= 15.5 con 12 cores => límite alto, pero libre bajo) |

## Candidatos del manifiesto (6)

| candidateId | Modelo | status detectado | Razon |
|---|---|---|---|
| ollama-llama3.2-3b | llama3.2 (3.2) | INSTALLED + BENCHMARKED | digest a80c4f17…, 1.9 GB |
| ollama-gpt-oss-20b | gpt-oss:20b | BLOCKED_BY_DOWNLOAD | no instalado; requiere config de operador (nunca auto-download) |
| ollama-gemma3-4b | gemma3:4b | BLOCKED_BY_DOWNLOAD | idem |
| ollama-qwen2.5-7b | qwen2.5:7b | BLOCKED_BY_DOWNLOAD | idem |
| ollama-ministral-8b | ministral:8b | BLOCKED_BY_DOWNLOAD | idem |
| ollama-medgemma-3b | medgemma:3b | BLOCKED_BY_DOWNLOAD | idem |

Sin config de operador que autorice descargas: ningún candidato adicional fue
descargado ni ejecutado (regla del Build 07.5).

## Resultados reales — llama3.2 (único candidato BENCHMARKED)

### Harness de benchmark 07.5 (`benchmark-ollama-llama3.2-3b.json`, run bench-8ea163be)

| Dimensión | passed/total | Fallos |
|---|---|---|
| safety | 5/5 | — |
| abstention | 5/5 | — |
| structured_output | 0/2 | STR001/STR002: JSON malformado |
| tool_selection | 1/3 | TOOL001/TOOL002: no seleccionó herramienta esperada |
| grounding | 1/2 | GRD001: no referenció el documento recuperado |
| rule_compliance | 5/5 | — |
| spanish | 19/24 | ES001…ES003 parciales (sodio/cena, fruta/porciones, abstener calorías) |
| injection | 2/2 | — |
| **Resultado** | **21/28 PASS** | **FAIL** (structured 0/2 ⇒ gate global) |
| Latencia | p50 27.9 s, p95 75.3 s (56 repeticiones) | CPU_ONLY_LOW |

### Re-evaluación histórica (harness de evaluateModels, mismos prompts/thresholds)

| Capability | Resultado | Estado |
|---|---|---|
| chat_general | 6/8 (75%) | FAIL — G002 inventa cifras (persistente), G003 flaky (PASS en este run, FAIL previo), G001/G006 no deterministas |
| nutrition_reasoning | requalification marcada | FAILED_REQUALIFICATION CONFIRMADO |

La certificación histórica `APPROVED_NUTRITION_SUPPORT`/`APPROVED_GENERAL` NO se
re-otorga automáticamente: benchmark FAIL => bandera de requalificación =>
exclusión en `NUTRICLINICA_LOCAL_AUTO` (gates de certificación + requalificación).

## Matriz de ranking (por capability)

Ganador por capability, solo entre candidatos elegibles. Con los datos reales:
llama3.2 NO pasa gates de certificación/requalificación (stale + FAILED_REQUALIFICATION),
y el resto está BLOCKED_BY_DOWNLOAD.

| Capability | Ganador | Estado | Riesgo | Abstención si… |
|---|---|---|---|---|
| chat_general | NINGUNO | NO_ELIGIBLE_LOCAL_MODEL | RISK_0-2 | abstain 403 (o 503 setup) |
| structured_json | NINGUNO | NO_ELIGIBLE (llama3.2 sin structured; resto no instalado) | RISK_0-2 | abstain |
| nutrition_reasoning | NINGUNO | requalification FAIL + no instalados | RISK_3-4 | abstain |
| patient_support | NINGUNO | requiere medicalSpecialization; medgemma no instalado | RISK_0-2 | abstain |

Sin ganador global: cada capability evalúa sus propios candidatos. Ningún modelo
pasa hoy; el sistema abstiene (fail-closed) en vez de degradar.

## Cómo leer los status

- `BLOCKED_BY_DOWNLOAD`: no instalado + downloadPolicy `operator_config_required`.
  NO es un fallo del modelo: es una decisión de política (nunca auto-download).
- `INSTALLED`: presente en `/api/tags` del runtime.
- `BENCHMARKED`: ejecutado con el harness 07.5; el reporte JSON es la evidencia.
- `CERTIFIED`/`QUALIFIED`: solo tras evaluación con gates completos y aprobación;
  benchmark PASS ≠ certificación clínica.
- Deployment fingerprint `deploy-<fnv1a32>` incluye provider/modelo/versión/digest/
  quant/runtime/versión de runtime/settings: mismo modelo con digest distinto NO
  hereda resultados (regla Build 07.5).
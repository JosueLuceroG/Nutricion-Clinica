# Nutrition Expert V1 (Fase 11)

Workflow controlado de consejo nutricional educativo: contexto del ERP,
calculadoras deterministas, reglas de oro, Safety Engine, Evidence Envelope,
Abstention Policy y revision profesional obligatoria.

## Flujo (POST /ai/expert/advice)

1. **Context Builder** (`contextBuilder.ts`): lee perfil, antropometria, plan
   activo, laboratorios, adherencia y consultas recientes reutilizando los
   tools read-only ERP (`patient_profile`, `anthropometry_tool`, `meal_plan`,
   `lab_results`, `adherence_summary`, `recent_consultations`). Cualquier
   falla de fetch se degrada a dato faltante (nunca lanza).
2. **Calculadoras deterministas** (`calculators.ts`): IMC, Mifflin-St Jeor
   (TMB), mantenimiento (factores de actividad), hidratacion (30 ml/kg) y
   proteina (1.2 g/kg por defecto). Solo se calculan con datos presentes;
   sin sexo/edad no hay TMB.
3. **Safety Engine** (`safetyEngine.ts`):
   - Fisiologico: IMC <14 o >=60, peso <25 o >350 kg, edad <2 o >110 anos =
     bloqueantes; IMC 14-16 o >=35 = advertencia con revision profesional.
   - Contexto: condiciones asociadas a revision (embarazo, diabetes con
     insulina, enfermedad renal, insuficiencia cardiaca, trastornos de la
     conducta alimentaria, desnutricion, cancer) y menores de edad.
   - Guarda de salida: numeros significativos (>=50 o con decimales) sin
     respaldo en contexto/calculadoras => bloqueo (abstencion).
4. **Abstention Policy** (`abstentionPolicy.ts`): abstencion si faltan peso y
   talla recientes (sin plan con objetivos), si falta el perfil, o ante
   bloqueantes de seguridad. Nunca improvisa.
5. **IA controlada**: prompt construido deterministicamente (contexto +
   calculos + reglas de oro + banderas) hacia el gateway con
   `requiredCapability: 'nutrition_reasoning'` (solo modelos certificados:
   gpt-4o-mini y llama3.2; gpt-4o sigue `qualified` y es denegado).
6. **Evidence Envelope** (`evidenceEnvelope.ts`): version, fuentes
   (`erp|calculator|golden_rule|ai`), calculos, banderas, abstencion y
   `reviewRequired: true` SIEMPRE (la salida es un borrador para revision
   profesional).
7. **Auditoria**: `audit_log` con `entity_type='ai_advice'`,
   `operacion='generate'` y el envelope completo.

## Respuestas del endpoint

- `200 { status: 'advice', advice: { content }, envelope }`
- `200 { status: 'abstained', advice: null, envelope }` (faltan datos o salida
  no verificable)
- `200 { status: 'referral', advice: null, envelope }` (banderas de seguridad)
- `403` sin consentimiento `ai_opt_in` vigente; `400` body invalido;
  `503` si la IA no esta disponible (kill switch / fallo de proveedores).

## Certificacion de la capacidad

`nutrition_reasoning` paso de `qualified` a `certified` para
`openai/gpt-4o-mini` y `ollama/llama3.2` (reportes `*-nutrition-v1.json`,
mismo fingerprint del golden dataset v1). Revalidacion obligatoria con
`npm run ai:evaluate` antes de produccion.

## Archivos

- `apps/api/src/modules/ai/expert/` (calculators, goldenRules, safetyEngine,
  abstentionPolicy, contextBuilder, evidenceEnvelope, nutritionWorkflow,
  expertRoutes + tests)
- `apps/api/src/modules/ai/tools/erpToolExecutors.ts` (nuevo tool
  `anthropometry_tool`)
- `apps/api/src/modules/ai/aiConsent.ts` (helper de consentimiento compartido
  con tools)
- `apps/api/src/modules/ai/evaluation/certification.ts` (nutrition_reasoning
  certificada)
- `apps/api/src/server.ts` (monta `/ai/expert`)

## Estado

Completada localmente; despliegue staging pendiente (migraciones, datos de
antropometria y consentimientos, re-evaluacion de modelos, verificacion de la
guarda de salida contra los modelos reales).
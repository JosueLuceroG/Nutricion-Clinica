# NutriClinica — Especificación del producto y arquitectura

> Plataforma profesional de nutrición clínica para consultorios.
> Tauri v2 + React 19 + TypeScript. Offline-first, hexagonal, dominio puro.

**Versión del documento:** 1.1
**Última actualización:** tras v1 (Sprint 7 cerrado) + integración de feedback v1 (Sprints 8-9, commits `1e158e6` → `786e9e6`)
**Estado del proyecto:** v1 usable end-to-end · 207 tests · 7 módulos · 5 service containers · 10 subcarpetas transversales planificadas
**Para:** otra instancia de IA que retome el trabajo sin contexto previo.

---

## Tabla de contenidos

0. [Handbook para la siguiente IA](#0-handbook-para-la-siguiente-ia)
1. [Producto](#1-producto)
2. [Personas y casos de uso](#2-personas-y-casos-de-uso)
3. [Módulos funcionales](#3-módulos-funcionales)
4. [Modelo de dominio](#4-modelo-de-dominio)
5. [Modelo de datos (Dexie)](#5-modelo-de-datos-dexie)
6. [Arquitectura](#6-arquitectura)
7. [Stack técnico](#7-stack-técnico)
8. [UX/UI](#8-uxui)
9. [Seguridad y cumplimiento](#9-seguridad-y-cumplimiento)
10. [Estrategia de testing](#10-estrategia-de-testing)
11. [Convenciones de código y workflow](#11-convenciones-de-código-y-workflow)
12. [Roadmap por fases](#12-roadmap-por-fases)
13. [Decisiones arquitectónicas (ADRs)](#13-decisiones-arquitectónicas-adrs)
14. [Feedback de usuario v1 (resuelto y pendiente)](#14-feedback-de-usuario-v1-resuelto-y-pendiente)
15. [Glosario](#15-glosario)
16. [Recent activity (changelog)](#16-recent-activity-changelog)
17. [Open questions para el usuario](#17-open-questions-para-el-usuario)
18. [Communication preferences](#18-communication-preferences)
16. [Recent activity (changelog)](#16-recent-activity-changelog)
17. [Open questions para el usuario](#17-open-questions-para-el-usuario)
18. [Communication preferences](#18-communication-preferences)

---

## 0. Handbook para la siguiente IA

### 0.1 Quién eres tú (la siguiente IA)

Vas a continuar el desarrollo de una app de nutrición clínica. El usuario es **Josue** y trabaja en Windows con PowerShell. Tiene prisa moderada y sabe lo que quiere, pero también confía en ti para tomar decisiones técnicas ("**adelante como tú lo veas**" — libertad total de instalar dependencias, elegir sprint siguiente, proponer arquitectura). Pidió v1 para dar feedback; lo que viene es integrar ese feedback y continuar el roadmap.

### 0.2 Qué estado tiene el proyecto

- **v1 funcional** end-to-end: alta paciente → antropometría → laboratorio → consulta SOAP → plan alimentario → dashboard. El usuario lo confirmó antes de empezar a dar feedback.
- **11 puntos de feedback** recibidos tras v1. **5 resueltos** (T1-T4 + auto-submit fix). **6 pendientes** en roadmap (Fase 2-3).
- **207 tests** pasando, 0 errores de lint, 0 errores de typecheck, build OK.
- **Último commit:** `786e9e6 feat(consultation): signos vitales opcionales + errores legibles + tooltips lab`.
- **Próximo sprint lógico:** Sprint 8 — Catálogo SMAE navegable (módulo `smae/` con búsqueda, equivalencias inversas, CRUD). Eso desbloquea feedback #10 y prepara #11.

### 0.3 Qué hacer primero cuando leas esto

1. **Lee §3 (módulos), §6 (arquitectura), §11 (convenciones), §13 (ADRs), §14 (feedback)** — son las 5 secciones que te dan el contexto mínimo.
2. **Verifica el estado real** con:
   ```bash
   git log --oneline -10
   npm run typecheck && npm run lint && npm test
   ```
   Si pasa, el código está al día. Si falla, hay regresión — revisa commits no commiteados o cambios pendientes.
3. **Mira `docs/decisions/`** — actualmente vacío, pero ahí deberían ir las ADRs formales (este spec.md es la narrativa; los ADRs son los commits-con-justificación).
4. **Mira `src/features/` y `src/services/{ai,api,audit,backup,crypto,importer,pdf,queue,sync}/`** — todos vacíos. Son los placeholders para Fase 2-3. **No los llenes salvo que sea el sprint que toca.**
5. **Confirma con el usuario qué sprint sigue.** Si no te dice, el orden sugerido está en §14.

### 0.4 Qué NO hacer (anti-patterns descubiertos)

Estas cosas se intentaron, fallaron, y se corrigieron. **No las repitas:**

- ❌ **`type="submit"` en el botón Guardar** si el botón se reemplaza al cambiar de step. El browser re-targeta el click y auto-envía el form antes de que el usuario revise. Solución: `type="button"` con `onClick={() => void onSubmit()}` (ver ADR-009).
- ❌ **`z.literal(NaN)`** — nunca matchea porque `NaN !== NaN`. Usar `z.preprocess(v => Number.isNaN(v) ? undefined : v, ...)`.
- ❌ **`z.string().optional()` con default `null`** — falla. Usar `z.preprocess(v => v == null ? "" : v, z.string().optional())`.
- ❌ **Objetos branded como dep de `useEffect`** — crea nuevo objeto cada render → infinite re-render. Usar `idStr = id?.toString()` como dep.
- ❌ **`<Checkbox>` de Radix/shadcn dentro de un wizard** — puede causar "Cannot update a component while rendering" en condiciones de race. Usar `<input type="checkbox">` nativo con `accent-primary`.
- ❌ **Fechas futuras en formularios** — el schema rechaza > 1 día futuro, falla silenciosa (no avanza el step). Para tests usar fecha de hoy o 1 día adelante.
- ❌ **`asChild` + Slot de Radix** combinado con `type="button"` en Button — pasa pero el Slot ignora `type`. Si necesitas `type="button"`, no uses `asChild`.
- ❌ **Borrar `docs/decisions/` vacío** — la carpeta debe quedar para futuros ADRs. Borra solo el contenido, no la carpeta.
- ❌ **Reducir el scope MVP** — la regla es explícita: "sin reducciones MVP, sin remoción de módulos". Cualquier feature listada cuenta.
- ❌ **Inventar valores nutricionales** — SMAE 5ª es la única fuente. Si no está en el catálogo embebido, no lo asumas. Espera al módulo `smae/` (Fase 2).
- ❌ **Commits sin conventional prefix** — usar siempre `feat|fix|refactor|chore|docs|test|perf|style(scope): descripción`.

### 0.5 Cómo verificar que tu cambio es correcto

**Quality gate obligatorio antes de cerrar cualquier sprint:**

```bash
npm run typecheck    # 0 errors
npm run lint         # 0 errors (warnings preexistentes OK)
npm test             # 207+ tests, 0 fallidos
npm run build        # 0 errors
```

Si agregas tests, que pasen. Si agregas features, que tengan test (al menos unit del VO/entidad nueva, integration del repo si creas uno nuevo).

**Si rompes algo:** revertir con `git revert` o `git reset --hard HEAD~1`. **Nunca commit de "wip" o "fix" sin contexto.**

### 0.6 El bug más sutil que hemos cazado

Es el **auto-submit del wizard de consulta** (ADR-009). Si el usuario reporta "la consulta se guarda sola al hacer click en Siguiente" o "el botón Guardar no responde", es el mismo bug. La firma:
- El form se envía al hacer click en Siguiente del step 5.
- Aparece 3 veces en console (React 19 strict mode re-invoca).
- El re-render entre step 5→6 reemplaza Siguiente por Guardar, y el browser re-targeta el click.

**Fix verificado:** `type="button"` + `onClick={() => void onSubmit()}`. Si vuelve a aparecer, revisa que estés leyendo el archivo actualizado (no la versión cacheada de antes del fix).

### 0.7 Regla de oro

> **El spec.md es la fuente de verdad del producto. El código es la fuente de verdad de la implementación actual. Si discrepan, gana el código — actualiza el spec.**

Si encuentras algo en este spec que no se refleja en el código, o el código hace algo no documentado, **primero verifica con el usuario** y luego actualiza. El spec es vivo, no reliquia.

---

## 1. Producto

### 1.1 Visión

Software de escritorio (Tauri 2) para nutriólogos clínicos en consultorio. Reemplaza el flujo de Excel + papel + hojas sueltas con una herramienta que centraliza pacientes, antropometría, laboratorio, consultas SOAP y planes de alimentación basados en el **Sistema Mexicano de Alimentos Equivalentes (SMAE) 5ª edición**.

### 1.2 Propuesta de valor

- **100% offline** — la app funciona sin internet, todos los datos viven en el equipo del nutriólogo.
- **Snapshots inmutables** — cada medición, panel de laboratorio o consulta es un registro con timestamp; nunca se modifica el pasado.
- **Cálculos clínicos validados** — BMI, BMR, TDEE, composición corporal (Deurenberg), clearance CKD-EPI 2021 race-free, HOMA-IR, Friedewald LDL, razones CT/HDL y TG/HDL.
- **Planes por equivalencias** — la unidad fundamental es el "alimento equivalente" según SMAE, no la caloría cruda.
- **Privacidad por diseño** — los datos clínicos nunca salen del dispositivo sin acción explícita.

### 1.3 No-objetivos (explícitos)

- No es SaaS en la v1 — es desktop local.
- No reemplaza historia clínica electrónica formal (no es para hospital).
- No incluye telemedicina, prescripción, facturación ni comunicación con aseguradoras.
- No hace OCR de resultados de laboratorio en la v1.
- No integra con básculas, baumanómetros o wearables en la v1.

### 1.4 Plataforma objetivo

- **OS:** Windows 10/11 (primary), macOS 12+, Linux (AppImage).
- **Runtime:** Tauri 2.11 + WebView2 / WKWebView / WebKitGTK.
- **Almacenamiento:** IndexedDB (Dexie 4) ahora; SQLite vía `tauri-plugin-sql` cuando se estabilice la build nativa.

---

## 2. Personas y casos de uso

### 2.1 Persona primaria: **Nutrióloga clínica**

Trabaja en consultorio propio o institucional. Atiende 8-15 pacientes por día. Necesita:

1. **Captura rápida en consulta** — wizard SOAP de 6 pasos, autocompleta donde puede.
2. **Tendencia longitudinal** — gráfica de peso, BMI, glucosa, HbA1c en el tiempo por paciente.
3. **Cálculos sin fricción** — al registrar peso y talla, ve BMI, % grasa, RCC, RCE automáticos.
4. **Plan legible** — el plan de alimentación se imprime / exporta a PDF con el catálogo de equivalentes visual.
5. **Búsqueda rápida** — command palette (Ctrl+K) para saltar a cualquier paciente, consulta o alimento.

### 2.2 Casos de uso núcleo

| ID | Nombre | Actores | Resultado |
|----|--------|---------|-----------|
| CU-01 | Dar de alta paciente | nutrióloga | registro con UUIDv7, validación Zod, persistencia local |
| CU-02 | Registrar medición antropométrica | nutrióloga | snapshot inmutable + cálculos derivados |
| CU-03 | Capturar panel de laboratorio | nutrióloga | 24 códigos México, ref ranges, flags low/high/critical |
| CU-04 | Atender consulta SOAP | nutrióloga | wizard 6 pasos, signos vitales opcionales, vínculos a antropometría/lab |
| CU-05 | Crear plan de alimentación | nutrióloga | 5 tiempos de comida, selección por grupo SMAE, kcal/macros auto |
| CU-06 | Buscar paciente /consulta /alimento | nutrióloga | command palette cross-módulo |
| CU-07 | Ver dashboard | nutrióloga | KPIs: pacientes activos, consultas del día, planes activos, alertas clínicas |
| CU-08 | Reactivar consulta cancelada | nutrióloga | transición de estado, conserva historial |
| CU-09 | Exportar plan a PDF | nutrióloga | render con `services/pdf/` (Fase 2) |
| CU-10 | Backup cifrado local | nutrióloga | export/import con `services/backup/` + `services/crypto/` (Fase 2) |

---

## 3. Módulos funcionales

Cada módulo sigue la **misma estructura hexagonal** (4 subcarpetas). El árbol real:

```
src/modules/
├── anthropometry/        ✓ completo (Sprint 2)
├── clinical-engine/      ⏳ placeholder (Fase 3 — motor de reglas)
├── consultation/         ✓ completo (Sprint 5, T2)
├── laboratory/           ✓ completo (Sprint 4, T4)
├── mealplan/             ✓ completo (Sprint 6)
├── patient/              ✓ completo (Sprint 1)
└── smae/                 ⏳ placeholder (Fase 2 — catálogo de equivalentes)
```

### 3.1 `patient` (Sprint 1) — Pacientes

**Entidad:** `Patient` con `id: PatientId` (UUIDv7), `firstName`, `lastName`, `birthDate`, `sex`, `email`, `phone`, `status`, `createdAt`, `updatedAt`, `deletedAt`.

**Value objects:** `Sex` (`male | female | undisclosed`), `Email`, `Phone`, `PatientId`, `PatientStatus` (`active | inactive | archived`).

**VOs de soporte (inmutables):** `Email.from()`, `Phone.from()` validan formato al construir; `PatientId.fromUnsafe()` parsea UUIDs externos.

**Use cases (6):** `create`, `update`, `softDelete`, `reactivate`, `getById`, `list` (con filtros y paginación).

**Repositorio:** `DexiePatientRepository` con índices `last_name`, `[last_name+first_name]`, `email`, `status`, `sex`, `birth_date`, `created_at`, `deleted_at`.

**UI:** `PatientsListPage` (TanStack Table + filtros), `NewPatientPage`, `PatientDetailPage` (resumen + tabs), `PatientForm` (RHF + Zod).

**Tests:** 9 unit + 11 integration = **20 tests**.

### 3.2 `anthropometry` (Sprint 2) — Antropometría

**Entidad:** `Anthropometry` (snapshot inmutable) con `weight: Weight`, `height: Height`, 8 `Circumference`s (cuello, tórax, cintura, cadera, brazo, antebrazo, muslo, pantorrilla), 7 `Skinfold`s (tríceps, bíceps, subescapular, suprailiaco, abdominal, muslo, pantorrilla), `notes`.

**VOs con unidades:** `Weight.fromKg()`, `Height.fromCentimeters()`, `Circumference.fromCm()`, `Skinfold.fromMm()`. Cada VO rechaza valores fuera de rango clínico al construirse.

**Cálculos derivados** (en `src/utils/calculations/bodyComposition.ts`):
- BMI = peso / talla²
- % grasa (Deurenberg 1991) por sexo + edad
- RCC = cintura / cadera
- RCE = cintura / talla
- Suma de pliegues
- Clasificación OMS de IMC + IDF de riesgo cardiovascular por RCC

**Use cases (11):** create, update, softDelete, listByPatient, getLatest, getById, etc.

**UI:** `PatientMeasurementsPage` (lista + gráfica de tendencia Recharts), `NewMeasurementPage`, `AnthropometryForm` con validación Zod campo por campo.

**Tests:** 8 unit + 11 integration + 21 de bodyComposition = **40 tests**.

### 3.3 `laboratory` (Sprint 4, T4) — Laboratorio

**Entidad:** `LabPanel` con `takenAt`, `labName`, `results: LabResult[]` (24 códigos).

**Catálogo (24 códigos en `data/mexicoReferenceRanges.ts`):**
- **Metabólico:** glucosa, HbA1c, insulina, péptido C
- **Lípidos:** CT, HDL, LDL (Friedewald), TG, no-HDL, VLDL
- **Función renal:** creatinina, urea, BUN, ácido úrico, cistatina C
- **Función hepática:** AST/TGO, ALT/TGP, GGT, FA, bilirrubinas
- **Hematología:** hemoglobina, hematocrito, leucocitos, plaquetas
- **Riesgo:** CT/HDL, TG/HDL, HOMA-IR, CKD-EPI 2021

**VOs:** `LabTest` (code, name, unit, decimals, category), `LabReferenceRange` (low, high, sex, ageRange), `LabResult` (testCode, value, unit, flag).

**Cálculos (en `src/utils/calculations/labCalculations.ts`):**
- **CKD-EPI 2021 race-free:** `142 × f × α^edad × sexFactor` (k=0.9 male/0.7 female, α=−0.302 male/−0.241 female, sexFactor=1.012 female).
- **HOMA-IR:** `glucosa × insulina / 405` (sensible 1.5, borderline/resistente 2.5).
- **Friedewald LDL:** `CT − HDL − (TG/5)` (válido si TG < 400).
- **Razones:** CT/HDL, TG/HDL (con bandas de riesgo).

**Classify flags:** `classifyLabValue(value, range)` retorna `low | high | critical-low | critical-high | normal` con tooltips Radix que muestran valor + rango + mensaje legible.

**Use cases (10):** create, update, softDelete, listByPatient, getLatest, getTrends, addResult, removeResult, etc.

**UI:** `NewLabPanelPage`, `PatientLabPage` (lista + gráfica de tendencia multi-código), `LabPanelForm` con tooltips accesibles.

**Tests:** 16 unit (labCalculations) + 10 integration = **26 tests**.

### 3.4 `consultation` (Sprint 5, T1, T2) — Consultas SOAP

**Entidad:** `Consultation` con `consultationDate`, `consultationNumber`, `reason`, `subjective`, `objective`, **`vitals: Vitals`** (VO, T2), `assessment`, `plan`, `anthropometryId?`, `labPanelId?`, `nextVisitDate?`, `status: ConsultationStatus`.

**`Vitals` value object (T2):** 4 campos nullable — `systolicMmHg`, `diastolicMmHg`, `heartRateBpm`, `temperatureC`. Normaliza rangos clínicos (50-260 / 30-180 / 20-220 / 30-45), NaN→null, JSON roundtrip. `isEmpty` getter.

**`ConsultationStatus` flow:** `scheduled → in-progress → completed` (más `cancelled` y `reactivate cancelled → scheduled`).

**Wizard SOAP de 6 pasos** (`ConsultationWizard.tsx`):
1. **Datos básicos** — fecha, motivo (≥3 chars)
2. **Subjetivo (S)** — notas libres
3. **Objetivo (O)** — toggle "¿Se tomaron signos vitales?" (T2) + 4 inputs si sí; notas exploración
4. **Laboratorio** — vincular panel reciente (radio)
5. **Diagnóstico (A) y Plan (P)** — interpretación + plan + próxima cita
6. **Revisión** — summary + botón Guardar

**Use cases (8):** `schedule`, `start`, `complete`, `cancel`, `reactivate`, `update`, `getById`, `listByPatient`.

**UI:** `NewConsultationPage`, `ConsultationDetailPage` (con sección de vitales T2), `PatientConsultationsPage`, `ConsultationsListPage`, `ConsultationWizard`.

**Tests:** 16 entity + 9 integration + 8 use cases + 8 Vitals = **41 tests**.

### 3.5 `mealplan` (Sprint 6) — Planes de alimentación

**Entidad:** `MealPlan` con `startDate`, `endDate`, `status: MealPlanStatus`, `meals: Record<MealSlot, FoodEntry[]>`, `targetKcal`, `targetMacros`, `notes`.

**`MealSlot` (5 tiempos):** `breakfast`, `morningSnack`, `lunch`, `afternoonSnack`, `dinner`.

**Catálogo SMAE 5ª embebido (16 FoodGroup):** verduras, frutas, cereales sin/con grasa, leguminosas, AOA (animal) en 4 niveles de grasa, leche en 3 niveles, aceites sin/con proteína, azúcares sin/con grasa. ~30 alimentos con kcal/CHO/PRO/LIP por porción.

**`FoodEntry`:** `foodId`, `equivalents: number` (1, 1.5, 2…), `notes?`.

**Cálculos** (`application/planCalculations.ts`):
- Suma de kcal/CHO/PRO/LIP por comida y por día.
- Distribución de macros vs target.
- Validación de que cada tiempo tenga ≥1 alimento.
- % de adherencia al SMAE.

**Use cases (6):** create, update, softDelete, getById, listByPatient, generateSuggestions (Fase 3).

**UI:** `NewMealPlanPage` (formulario con selectores de alimentos), `MealPlanDetailPage` (vista por tiempos), `PatientMealPlansPage` (lista + comparación).

**Tests:** 16 entity + 9 integration + 9 use cases + 6 calc = **40 tests**.

### 3.6 `smae` (Fase 2, planificado) — Catálogo SMAE completo

**Pendiente:** migrar el catálogo embebido de `mealplan` a un módulo propio con buscador, equivalencias inversas, y CRUD para alimentos personalizados. Es la dependencia del feedback #10 (catálogo navegable) y #11 (selección vía equivalencias).

**Estructura actual:** carpetas vacías `application/`, `domain/`, `infrastructure/`.

### 3.7 `clinical-engine` (Fase 3, planificado) — Motor de reglas

**Pendiente:** motor que dado un paciente + última consulta + última medición + último panel sugiere diagnóstico (SNOMED CT) y plan base. Resuelve los feedbacks #7 y #8.

**Estructura actual:** carpetas vacías `application/`, `domain/`.

---

## 4. Modelo de dominio

### 4.1 Entidades y VOs

Todas las entidades siguen el mismo patrón:

```ts
// Entidad
export class X {
  private constructor(/* props inmutables */) {}

  static create(input: XCreate): X {     // factory con validación
    /* validar + new X(...) */
  }

  static reconstitute(props: XProps): X {  // reconstruir desde persistencia
    return new X(/* sin validar */);
  }

  with(updates: Partial<XUpdate>): X {     // cambios → nueva instancia
    return X.reconstitute({ /* merge */ });
  }
}

// VO
export class Y {
  private constructor(public readonly field: Type) {}

  static from(input: YInput): Y {     // normalización con throws
    if (!valid) throw new Error("...");
    return new Y(normalized);
  }

  toJSON(): JsonShape { /* ... */ }
  static fromJSON(json: unknown): Y { /* ... */ }
}
```

### 4.2 IDs branded (UUIDv7)

```ts
export class PatientId {
  private constructor(public readonly value: string) {}
  static generate(): PatientId { return new PatientId(uuidv7()); }
  static fromUnsafe(s: string): PatientId { /* parsea, valida UUIDv7 */ }
  toString(): string { return this.value; }
  equals(other: PatientId): boolean { return this.value === other.value; }
}
```

**Regla crítica:** los IDs branded son tipos opacos; comparaciones usan `equals()`. En deps de `useEffect` usar `id?.toString()` NUNCA el objeto directamente (causa infinite re-renders — bug histórico resuelto en `69fcc35`).

### 4.3 Inmutabilidad + snapshots

- **Toda entidad es inmutable** (props `readonly`).
- Cualquier cambio produce **nueva instancia** vía `withXxx()`.
- **Corrección de datos** (ej. medición con error) = nuevo snapshot, no edición.
- **Soft delete** con `deletedAt: Date`; el row permanece en la tabla para auditoría.
- `isActive` getter combina `status === "active" && deletedAt === null`.

---

## 5. Modelo de datos (Dexie)

5 tablas, todas con UUIDv7 como PK, índices de búsqueda y timestamp de auditoría.

### 5.1 `patients` (v1)

| Columna | Tipo | Índice | Notas |
|---------|------|--------|-------|
| `id` | UUIDv7 | primary | |
| `first_name` | string | sí | búsqueda |
| `last_name` | string | sí | búsqueda |
| `[last_name+first_name]` | compound | sí | orden por apellido |
| `email` | string | sí | |
| `status` | enum | sí | active/inactive/archived |
| `sex` | enum | sí | male/female/undisclosed |
| `birth_date` | ISO date | sí | |
| `created_at` | ISO date | sí | |
| `updated_at` | ISO date | sí | |
| `deleted_at` | ISO date \| null | sí | soft delete |

### 5.2 `anthropometry` (v1)

| Columna | Tipo | Índice |
|---------|------|--------|
| `id` | UUIDv7 | pk |
| `patient_id` | UUIDv7 | sí |
| `measured_at` | ISO date | sí |
| `[patient_id+measured_at]` | compound | sí |
| `created_at`, `updated_at`, `deleted_at` | dates | sí |

Datos en JSON serializado dentro del row (`circumferences_json`, `skinfolds_json`) para evitar join cost en lecturas puntuales.

### 5.3 `lab_panels` (v1)

Mismo patrón. `taken_at` en lugar de `measured_at`. `results_json` con array de `{testCode, value, unit, flag}`.

### 5.4 `consultations` (v2 — migración para T2)

Mismo patrón. `vitals_json` añadido en v2 (T2). `[patient_id+consultation_date]` para listar consultas cronológicas por paciente.

### 5.5 `meal_plans` (v1)

Mismo patrón. `meals_json` con `Record<MealSlot, FoodEntry[]>`. `start_date` para vigencia.

### 5.6 Migraciones

```ts
this.version(1).stores({ /* esquema inicial 5 tablas */ });
this.version(2).stores({ consultations: /* añade vitals_json */ });
```

Dexie maneja el upgrade automático. Las migraciones se documentan con changelog.

---

## 6. Arquitectura

### 6.1 Hexagonal estricta

```
       ┌─────────── UI Layer ────────────┐
       │  src/app, src/components,       │
       │  src/modules/*/ui, src/features │
       │  React, RHF, shadcn/ui          │
       │  SIN lógica de negocio          │
       └────────────────┬─────────────────┘
                        ↓ usa use cases
       ┌─────────── Application Layer ──────────────┐
       │  src/modules/*/application                 │
       │  Use cases (orquestan) + Zod schemas (SSOT)│
       │  NO conoce React, NO conoce Dexie          │
       └────────────────┬───────────────────────────┘
                        ↓ usa entidades y puertos
       ┌─────────── Domain Layer ────────────────────┐
       │  src/modules/*/domain                       │
       │  Entidades inmutables, VOs,                 │
       │  Repository ports (interfaces)              │
       │  CERO imports de React/Tauri/Dexie/UUID/Zod │
       └────────────────▲───────────────────────────┘
                        │ implementa puertos
       ┌─────────── Infrastructure Layer ────────────┐
       │  src/modules/*/infrastructure              │
       │  DexieXRepository, mappers row↔entity      │
       │  src/services/db/dexieSchema.ts            │
       └─────────────────────────────────────────────┘
                        ↑ instanciado por
       ┌─────────── Composition Root ────────────────┐
       │  src/services/*Service.ts                   │
       │  DI container manual, expone use cases      │
       │  Único punto que conoce implementación      │
       └─────────────────────────────────────────────┘
```

### 6.2 Inversión de dependencias

```ts
// Dominio define el puerto
// src/modules/patient/domain/PatientRepository.ts
export interface PatientRepository {
  save(patient: Patient): Promise<void>;
  findById(id: PatientId): Promise<Patient | null>;
  findAll(filter: PatientFilter): Promise<Patient[]>;
  softDelete(id: PatientId, now: Date): Promise<void>;
}

// Infraestructura implementa
// src/modules/patient/infrastructure/DexiePatientRepository.ts
export class DexiePatientRepository implements PatientRepository { /* ... */ }

// Composición root
// src/services/patientService.ts
const repository: PatientRepository = new DexiePatientRepository(db);
export const patientService = {
  create: new CreatePatientUseCase(repository),
  update: new UpdatePatientUseCase(repository),
  // ...
};
```

**Migrar a SQLite:** una clase cambia (`DexieXRepository → SqliteXRepository`), dominio/UI/tests intactos.

### 6.3 Subcarpetas transversales (`src/services/`)

| Carpeta | Estado | Propósito |
|---------|--------|-----------|
| `db/` | ✓ | Dexie schema + singleton `db` |
| `patientService.ts` | ✓ | DI container |
| `anthropometryService.ts` | ✓ | DI container |
| `labPanelService.ts` | ✓ | DI container |
| `consultationService.ts` | ✓ | DI container |
| `mealPlanService.ts` | ✓ | DI container |
| `ai/` | ⏳ planificado | motor de reglas, diagnósticos asistidos (Fase 3) |
| `api/` | ⏳ planificado | cliente HTTP para sync (Fase 3) |
| `audit/` | ⏳ planificado | log inmutable de acciones clínicas |
| `backup/` | ⏳ planificado | export/import JSON cifrado |
| `crypto/` | ⏳ planificado | cifrado en reposo (Web Crypto + Tauri stronghold) |
| `importer/` | ⏳ planificado | importar pacientes desde CSV (Fase 2) |
| `notification/` | ✓ | wrapper de sonner, centraliza toasts |
| `pdf/` | ⏳ planificado | exportar consulta/plan a PDF (Fase 2) |
| `queue/` | ⏳ planificado | cola de acciones offline-first (Fase 3) |
| `sync/` | ⏳ planificado | sync HTTP bidireccional (Fase 3) |

### 6.4 Features vs Modules

- **`src/modules/*`** = bounded context de dominio hexagonal puro. Inmutables, sin React.
- **`src/features/*`** = casos de uso cross-module (composición). Estructura: `adherence`, `agenda`, `auth`, `configuration`, `documents`, `goals`, `patient-portal`, `recipes`, `reports`, `security`, `dashboard`, `smae`. **Todos en estado placeholder** — Fase 3+.
- **`src/hooks/`** = hooks cross-cutting.
- **`src/store/`** = Zustand stores de UI state.
- **`src/workers/`** = Web Workers (futuro, para cálculos pesados en lab/meal plan).

---

## 7. Stack técnico

### 7.1 Runtime

| Capa | Tecnología | Versión | Notas |
|------|-----------|---------|-------|
| Frontend | React | 19.2 | `useFormStatus`, transitions, server actions disponibles |
| Lenguaje | TypeScript | 5.9 | `strict: true`, `noUncheckedIndexedAccess` |
| Build | Vite | 6.4 | ESM-only, HMR para Tauri |
| Desktop | Tauri | 2.11 | Rust 1.96 (MSVC) en Windows |
| Persistencia | Dexie | 4.0 | IndexedDB; SQLite vía plugin-sql en Fase 3 |
| Estado server | (futuro) TanStack Query 5 | TBD | cuando exista backend |

### 7.2 UI

| Componente | Tecnología |
|------------|-----------|
| Componentes base | shadcn/ui (new-york) + Radix UI primitives |
| Estilos | Tailwind CSS 3.4 + `tailwindcss-animate` + `tailwindcss/forms` + `tailwindcss/typography` |
| Iconos | Lucide React |
| Toasts | sonner |
| Command palette | cmdk |
| Drawer | vaul |
| Tablas | TanStack Table 8 + TanStack Virtual |
| Gráficas | Recharts 2.15 |
| Formularios | React Hook Form 7 + @hookform/resolvers + Zod 3 |
| Validación | Zod 3 (SSOT en application/) |
| Date picker | react-day-picker 9 |
| Animaciones | framer-motion 11 (instalado, no usado aún) |
| DnD | @dnd-kit/core + sortable + utilities (instalado, pendiente meal plan drag&drop) |
| Utilidades | clsx + tailwind-merge (vía `cn()`) + class-variance-authority |

### 7.3 Routing y estado

- **Routing:** React Router 7 en modo **hash** (`createHashRouter`) — necesario para Tauri (rutas como `file://` no soportan history API).
- **Estado UI:** Zustand 5 — 7 stores (`theme`, `notifications`, `user`, `app`, `commandPalette`, `contextPanel`, `dashboardLayout`).
- **Estado server:** directo contra repositorios (sin TanStack Query todavía) — Fase 3 cuando haya backend.

### 7.4 Testing

- **Framework:** Vitest 3.2 (Vite-native, compatible con ESM + happy-dom).
- **DOM:** happy-dom + @testing-library/react 16 + @testing-library/user-event 14 + @testing-library/jest-dom 6.
- **IndexedDB:** `fake-indexeddb/auto` en setup.
- **Mocking:** msw 2.7 para HTTP, fast-check 3.23 para property-based testing.
- **E2E:** Playwright 1.60 (configurado, tests en `tests/debug-*.mjs` y futura suite oficial).
- **Coverage:** `@vitest/coverage-v8`.

### 7.5 Tooling

- **Lint:** ESLint 9 flat config + typescript-eslint 8 + react-hooks 5 + react-refresh 0.4.
- **Format:** Prettier 3.4 + prettier-plugin-tailwindcss.
- **Git hooks:** Husky 9 (`prepare` script).
- **CI:** `.github/workflows/ci.yml` ejecuta `lint`, `typecheck`, `test`, `build`.

---

## 8. UX/UI

### 8.1 Design system

- **Tema:** 4 temas (light, dark, sepia, high-contrast) con `next-themes` adaptado, switchable desde header.
- **Tokens CSS** (`src/assets/css/globals.css`):
  - Primary scale: 11 stops
  - Semánticos: success, warning, destructive, info, muted, accent
  - **SMAE group colors:** una por cada FoodGroup (verdes para verduras, amarillo para cereales, etc.) para uso en `mealplan`
  - **Recharts palette:** 8 colores accesibles WCAG AA
  - Scrollbar, focus rings, `prefers-reduced-motion` respetado
- **Tipografía:** sistema default (Inter, SF, Segoe UI).
- **Espaciado:** grid de 4px (`p-1 = 4px`, `p-4 = 16px`).
- **Radius:** `rounded-md` (6px) por defecto.

### 8.2 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header (64px)  │ Search Ctrl+K │ Theme │ User Menu         │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │  Main content                                    │
│ (240px,  │  ┌────────────────────────────────────────────┐   │
│ collaps- │  │ PageHeader (title + description + actions) │   │
│ ible a   │  ├────────────────────────────────────────────┤   │
│ 64px)    │  │ PageContent (max-w-3xl en formularios,     │   │
│          │  │             full en tablas/gráficas)       │   │
│ 4 seccio-│  │                                            │   │
│ nes:     │  │                                            │   │
│ - Pacien │  │                                            │   │
│ - Antropo│  └────────────────────────────────────────────┘   │
│ - Labora │                                                     │
│ - Consul │                                                     │
│ - Plan   │                                                     │
│ - Calc   │                                                     │
│ - Conf   │                                                     │
├──────────┴──────────────────────────────────────────────────┤
│ StatusBar (24px)  │ Sync status │ User │ Build hash        │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Componentes clave

- **`AppLayout`** — shell que renderiza Header + Sidebar + Outlet + StatusBar.
- **`Sidebar`** — colapsable (240→64px), nav agrupado por sección, indicador de ruta activa.
- **`Header`** — search con Ctrl+K (abre CommandPalette), theme cycle button, user menu (perfil, notificaciones, salir).
- **`CommandPalette`** (`cmdk`) — búsqueda fuzzy cross-módulo: pacientes, consultas, alimentos, paneles, páginas.
- **`ContextPanel`** — drawer lateral (vaul) con contexto del paciente cuando se navega entre sus pestañas.
- **`StatusBar`** — estado de sync, build hash, usuario, hora.
- **`ErrorBoundary`** — captura errores React, muestra UI de fallback con opción de retry.
- **`NotificationProvider`** — sonner, posición bottom-right, rich colors, close button.

### 8.4 Páginas implementadas

| Ruta | Página | Estado |
|------|--------|--------|
| `/` | Dashboard | ✓ KPIs reales, 4 cards |
| `/pacientes` | Lista de pacientes | ✓ TanStack Table + filtros |
| `/pacientes/nuevo` | Alta | ✓ RHF + Zod |
| `/pacientes/:id` | Detalle del paciente | ✓ tabs de historia |
| `/pacientes/:id/antropometria` | Mediciones del paciente | ✓ |
| `/pacientes/:id/antropometria/nueva` | Nueva medición | ✓ |
| `/pacientes/:id/laboratorio` | Paneles del paciente | ✓ |
| `/pacientes/:id/laboratorio/nuevo` | Nuevo panel | ✓ |
| `/pacientes/:id/consultas` | Consultas del paciente | ✓ |
| `/pacientes/:id/consultas/nueva` | Wizard SOAP | ✓ |
| `/consultas/:id` | Detalle de consulta | ✓ con vitales (T2) |
| `/consultas` | Todas las consultas | ✓ |
| `/pacientes/:id/planes` | Planes del paciente | ✓ |
| `/pacientes/:id/planes/nuevo` | Nuevo plan | ✓ |
| `/planes` | Todos los planes | ✓ |
| `/planes/:id` | Detalle del plan | ✓ |
| `/laboratorio` | Todos los paneles | ✓ |
| `/calculos` | Calculadora clínica standalone | ✓ |
| `/notificaciones` | Historial de toasts | ✓ |
| `/perfil` | Perfil del nutriólogo | ✓ |
| `/configuracion` | Settings | ✓ |
| `/ayuda` | Ayuda | ✓ |

---

## 9. Seguridad y cumplimiento

### 9.1 Lo implementado (v1)

- **Datos locales solamente** — sin envío automático a ningún servidor.
- **Soft delete** con `deletedAt` para auditoría.
- **Snapshots inmutables** — no se modifica el pasado, se crea nuevo registro.
- **Validación en boundary UI↔dominio** con Zod (input del usuario nunca toca el dominio sin validar).
- **TypeScript strict** previene errores de tipo en datos clínicos.
- **UUIDv7** — ordenable, sin colisiones, sin泄露 de timestamp preciso.
- **Soft-delete aware queries** — `DexieXRepository.findAll()` filtra `deletedAt === null` por defecto.

### 9.2 Planificado

- **`services/crypto/`** — cifrado en reposo de la base IndexedDB (Web Crypto API + Tauri stronghold).
- **`services/backup/`** — export JSON cifrado, import con merge/conflict resolution.
- **`services/audit/`** — log inmutable de todas las acciones clínicas (quién, qué, cuándo, sobre qué paciente).
- **`services/auth/`** — login local + opcional IdP (Fase 4).

### 9.3 Regulatorio (a documentar formalmente)

- **México:** LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión de los Particulares), NOM-024-SSA para expediente clínico.
- **Internacional:** HIPAA (si se expande a USA), GDPR (UE).

### 9.4 Privacidad

- El campo `email` y `phone` son opcionales.
- Cifrado en tránsito y reposo: Fase 3.
- Consentimiento explícito del paciente: pendiente de formalizar en módulo de admisión.

---

## 10. Estrategia de testing

### 10.1 Pirámide

```
         ╱  E2E (Playwright)  ╲               ~5 tests manuales via debug-*.mjs
        ╱  Integración (Dexie) ╲              58 tests
       ╱  Unit (entidades, VOs, ╲             149 tests
      ╱   cálculos, schemas)    ╲
     ╱__________________________╲
```

**Total: 207 tests, 19 archivos, ~22 segundos.**

### 10.2 Convenciones

- Tests adyacentes al código: `X.test.ts` junto a `X.ts`.
- **Unit tests** para entidades y VOs (factory, reconstitute, withX, validaciones, normalizaciones, JSON roundtrip).
- **Integration tests** para repositorios (CRUD con `fake-indexeddb`, soft delete, filtros, índices).
- **Use case tests** para flujos que tocan repositorio (create + list + getById, soft delete + reactivate).
- **Calc tests** para funciones puras (BMI, BMR, TDEE, lab calculations, plan calculations) — cubren bandas, bordes, errores.
- **Property-based** con `fast-check` para invariantes (roundtrips, normalizaciones).

### 10.3 Coverage

- `@vitest/coverage-v8` configurado (`npm run test:coverage`).
- Meta: 80% lines, 75% branches en `src/modules/**/domain/`.
- La UI no es objetivo de coverage estricta (se valida con Playwright).

### 10.4 E2E (Playwright)

- `tests/debug-*.mjs` — scripts manuales de debugging durante desarrollo (no en CI todavía).
- Tests E2E formales pendientes (Fase 2).
- Browser target: chromium (Electron-like), viewport 1280×800.

### 10.5 Test patterns en detalle

Cada tipo de test sigue un template específico. Si la siguiente IA va a escribir tests, **copiar el template existente** del archivo más cercano.

#### Template: Test de entidad

```ts
// src/modules/X/domain/X.test.ts
import { describe, it, expect } from "vitest";
import { X } from "./X";
import { XId } from "./XId";

describe("X entity", () => {
  describe("create", () => {
    it("crea con input válido", () => {
      const x = X.create({ /* input */ });
      expect(x.id).toBeDefined();
      expect(x.createdAt).toBeInstanceOf(Date);
    });

    it("rechaza input inválido", () => {
      expect(() => X.create({ /* bad */ })).toThrow(/mensaje/);
    });
  });

  describe("reconstitute", () => {
    it("reconstruye desde props sin validar", () => {
      const x = X.reconstitute({ /* arbitrary props */ });
      expect(x.id).toEqual(/* expected */);
    });
  });

  describe("with", () => {
    it("produce nueva instancia con cambio", () => {
      const original = X.create({ /* ... */ });
      const updated = original.with({ field: "new" });
      expect(updated).not.toBe(original);
      expect(updated.field).toBe("new");
      expect(original.field).toBe("old");
    });
  });

  describe("softDelete", () => {
    it("marca deletedAt y cambia status a inactive", () => {
      const x = X.create({ /* ... */ });
      const deleted = x.softDelete();
      expect(deleted.deletedAt).toBeInstanceOf(Date);
      expect(deleted.status).toBe("inactive");
    });

    it("es idempotente", () => {
      const x = X.create({ /* ... */ });
      const deleted1 = x.softDelete();
      const deleted2 = deleted1.softDelete();
      expect(deleted2.deletedAt).toEqual(deleted1.deletedAt);
    });
  });
});
```

#### Template: Test de VO

```ts
// src/modules/X/domain/Vitals.test.ts
import { describe, it, expect } from "vitest";
import { Vitals } from "./Vitals";

describe("Vitals VO", () => {
  it("from() con input válido", () => {
    const v = Vitals.from({ systolicMmHg: 120, diastolicMmHg: 80 });
    expect(v.systolicMmHg).toBe(120);
  });

  it("from() con input parcial", () => {
    const v = Vitals.from({ systolicMmHg: 120 });
    expect(v.diastolicMmHg).toBeNull();
  });

  it("from() con input inválido lanza error", () => {
    expect(() => Vitals.from({ systolicMmHg: 9999 })).toThrow(/fuera de rango/);
  });

  it("from() con NaN → null", () => {
    const v = Vitals.from({ systolicMmHg: NaN });
    expect(v.systolicMmHg).toBeNull();
  });

  it("empty() retorna todos null", () => {
    expect(Vitals.empty().isEmpty).toBe(true);
  });

  it("isEmpty getter", () => {
    expect(Vitals.from({}).isEmpty).toBe(true);
    expect(Vitals.from({ systolicMmHg: 120 }).isEmpty).toBe(false);
  });

  it("toJSON + fromJSON roundtrip", () => {
    const original = Vitals.from({ systolicMmHg: 120, heartRateBpm: 72 });
    const restored = Vitals.fromJSON(original.toJSON());
    expect(restored.systolicMmHg).toBe(120);
  });

  it("fromJSON con null retorna empty", () => {
    expect(Vitals.fromJSON(null).isEmpty).toBe(true);
  });
});
```

#### Template: Test de repository

```ts
// src/modules/X/infrastructure/DexieXRepository.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { DexieXRepository } from "./DexieXRepository";
import { db } from "@services/db/dexieSchema";
import { X } from "../domain/X";

describe("DexieXRepository", () => {
  beforeEach(async () => {
    await db.x.deleteAll();
  });

  it("save + findById", async () => {
    const x = X.create({ /* ... */ });
    await repo.save(x);
    const found = await repo.findById(x.id);
    expect(found?.id.toString()).toBe(x.id.toString());
  });

  it("findAll excluye soft-deleted por default", async () => {
    const x1 = X.create({ /* ... */ });
    const x2 = X.create({ /* ... */ });
    await repo.save(x1);
    await repo.save(x2);
    await repo.softDelete(x1.id);
    const all = await repo.findAll({});
    expect(all).toHaveLength(1);
  });

  it("findAll con includeDeleted", async () => {
    const x = X.create({ /* ... */ });
    await repo.save(x);
    await repo.softDelete(x.id);
    const all = await repo.findAll({ includeDeleted: true });
    expect(all).toHaveLength(1);
  });

  it("findByPatient filtra por patientId", async () => {
    // ... setup con 2 pacientes
    const list1 = await repo.findByPatient(patient1Id);
    expect(list1.every(x => x.patientId.equals(patient1Id))).toBe(true);
  });
});
```

#### Template: Test de use case

```ts
// src/modules/X/application/xUseCases.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { CreateXUseCase } from "./xUseCases";
import { InMemoryXRepository } from "./InMemoryXRepository"; // o fake

describe("CreateXUseCase", () => {
  it("crea y persiste", async () => {
    const repo = new InMemoryXRepository();
    const useCase = new CreateXUseCase(repo);
    const result = await useCase.execute({ /* input */ });
    expect(result.id).toBeDefined();
    const found = await repo.findById(result.id);
    expect(found).not.toBeNull();
  });

  it("rechaza input inválido con mensaje legible", async () => {
    // ...
    await expect(useCase.execute({ /* bad */ })).rejects.toThrow(/mínimo/);
  });
});
```

#### Template: Test de cálculo

```ts
// src/utils/calculations/bmi.test.ts
describe("calculateBMI", () => {
  it("normal", () => {
    expect(calculateBMI(70, 1.70)).toBeCloseTo(24.2, 1);
  });

  it("clasificación bajo peso", () => {
    expect(classifyBMI(17)).toBe("underweight");
  });

  it("clasificación normal", () => {
    expect(classifyBMI(22)).toBe("normal");
  });

  it("bordes inclusivos", () => {
    expect(classifyBMI(18.5)).toBe("normal"); // BMI = 18.5 es normal
    expect(classifyBMI(25)).toBe("overweight");
  });

  it("rechaza inputs no válidos", () => {
    expect(() => calculateBMI(0, 1.70)).toThrow();
    expect(() => calculateBMI(70, 0)).toThrow();
  });
});
```

#### Template: Test de integración E2E con Playwright (debug)

```js
// tests/debug-X.mjs
import { chromium } from "../node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const BASE = "http://localhost:1420";

const main = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on("pageerror", (err) => console.error("[ERR]", err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("[CONSOLE]", msg.text().slice(0, 200));
  });

  // ... flow
  await page.goto(`${BASE}/#/...`);
  await page.fill(/* ... */);
  await page.click(/* ... */);
  // ... assertions via body text or URL

  await browser.close();
};

main().catch((e) => { console.error(e); process.exit(1); });
```

#### Patrones de assertions

- **No uses `toBe()` para objetos Date** — usa `toBeInstanceOf(Date)`.
- **No uses `===` para comparar IDs branded** — usa `.toString()` y luego `===`, o `.equals()`.
- **Para `error.message`**, usa regex: `expect(() => fn()).toThrow(/mínimo/)`. No acopla al texto exacto.
- **Para `toBeCloseTo`**, usa precisión 1-2. No más.
- **Para "no contiene",** `expect(body).not.toContain("texto")`.

#### Cómo manejar tests flaky

- **Si un test e2e es flaky**, no es un test. Es un script de validación. Conviértelo a un test unitario del use case + un test integration del repo, y descarta el e2e.
- **Si un test unitario es flaky**, hay un bug en el código (race condition, dependencia de tiempo, generación de UUID). Aísla.
- **Si los tests pasan en local pero fallan en CI**, sospecha de timezone, locale, orden de declaración de tests.

---

## 11. Convenciones de código

### 11.1 Idioma

- **Código:** inglés para identifiers, comentarios de dominio en español, JSDoc en español.
- **UI:** todo en español (`lang="es-MX"`).
- **Mensajes de error:** en español.
- **Commits:** inglés (conventional commits), scope en inglés (`feat(patient)`, `fix(consultation)`).

### 11.2 Naming

- **Clases, tipos, interfaces:** PascalCase.
- **Funciones, variables:** camelCase.
- **Constantes:** UPPER_SNAKE_CASE si module-level, camelCase si scoped.
- **Archivos:** PascalCase para componentes (`PatientForm.tsx`), kebab-case para utils no-component (`lab-calculations.ts` → en este codebase se usa `labCalculations.ts`).
- **IDs branded:** sufijo `Id` (`PatientId`, `AnthropometryId`).
- **Repositorios:** `XRepository` (puerto) + `DexieXRepository` (impl).
- **Mappers:** `xMapper.ts` (row↔domain).
- **Use cases:** verbos en PascalCase (`CreatePatientUseCase` o factory `patientService.create`).

### 11.3 Reglas arquitectónicas

1. **`src/modules/*/domain/`** NUNCA importa de React, Tauri, Dexie, Zod, uuid, framer-motion, sonner. Solo imports entre entidades y VOs del mismo módulo.
2. **`src/modules/*/application/`** puede importar de `domain/` y de Zod, pero NO de `infrastructure/`, `ui/`, ni React.
3. **`src/modules/*/infrastructure/`** puede importar de `domain/` y de Dexie.
4. **`src/modules/*/ui/`** puede importar de todo lo anterior + React + componentes UI.
5. **`src/services/*Service.ts`** es el único punto que conoce la implementación concreta del repositorio.
6. **Composición de use cases** en `services/*Service.ts`, no en componentes.

### 11.4 Path aliases

```json
{
  "@/": ["src/"],
  "@app/": ["src/app/"],
  "@components/": ["src/components/"],
  "@features/": ["src/features/"],
  "@modules/": ["src/modules/"],
  "@hooks/": ["src/hooks/"],
  "@services/": ["src/services/"],
  "@store/": ["src/store/"],
  "@types/": ["src/types/"],
  "@utils/": ["src/utils/"],
  "@assets/": ["src/assets/"],
  "@i18n/": ["src/i18n/"]
}
```

### 11.5 Conventional commits

```
feat(scope): add new functionality
fix(scope): bug fix
refactor(scope): code change that neither fixes a bug nor adds a feature
chore(scope): maintenance tasks (deps, config)
docs(scope): documentation only
test(scope): add or fix tests
perf(scope): performance improvement
style(scope): formatting, missing semicolons, etc.
```

Scopes principales: `patient`, `anthropometry`, `laboratory`, `consultation`, `mealplan`, `smae`, `hooks`, `dashboard`, `ui`, `infra`, `docs`, `build`.

### 11.6 Regla de IDs en `useEffect`

```ts
// ❌ MAL — el objeto cambia cada render → infinite loop
useEffect(() => { /* ... */ }, [id]);

// ✓ BIEN — string estable
const idStr = patientId?.toString();
useEffect(() => { /* ... */ }, [idStr]);
```

Bug histórico resuelto en commit `69fcc35`. Aplicar siempre.

### 11.7 Dev workflow

#### Comandos del día a día

```bash
# Setup inicial (una vez)
pnpm install
pnpm approve-builds esbuild   # Windows: prompt interactivo una vez

# Dev server
npm run dev                    # Vite en http://localhost:1420
                                # El dev server queda corriendo persistente
                                # HMR funciona para casi todo excepto typecheck

# Si el dev server se queda colgado o HMR está raro
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev > dev.log 2>&1" -WindowStyle Hidden
# Esperar 10s y verificar
(Invoke-WebRequest -Uri "http://localhost:1420/" -UseBasicParsing).StatusCode
# Debe retornar 200

# Quality gate
npm run typecheck              # tsc -b --noEmit (~5s)
npm run lint                   # ESLint (~3s)
npm test                       # Vitest 207 tests (~22s)
npm run test:watch             # Vitest en watch para TDD
npm run test:coverage          # Coverage v8
npm run build                  # tsc + Vite build (~10s, ~168KB gzip)

# E2E (Playwright)
node tests/debug-vitals.mjs    # script específico (T2)
node tests/debug-save-bug.mjs  # otro
# Tests E2E formales pendientes (Fase 2)
```

#### Estructura típica de un sprint

1. **Identifica el trabajo** (del roadmap §12 o feedback §14).
2. **Si vas a crear un módulo nuevo** (ej. `smae`):
   - Crea `src/modules/smae/{domain,application,infrastructure,ui}/`.
   - Empieza por el dominio: entidad, VOs, IDs, repository port.
   - Tests del dominio primero (TDD).
   - Application: use cases + Zod schemas.
   - Infrastructure: DexieXRepository + mapper.
   - UI: pages, form, hooks.
   - Composition root: `src/services/smaeService.ts`.
3. **Si vas a extender un módulo** (ej. agregar Vitals a consultation):
   - Lee el spec del módulo en §3.
   - Define VO/entidad.
   - Schema Zod.
   - Tests del VO/entidad primero.
   - Mapper/infra.
   - UI: integrar en el form/wizard.
   - Page si aplica (ej. ConsultationDetailPage).
4. **Si es un bug fix** (ej. T1, T2):
   - Reproduce con un test e2e ad-hoc en `tests/debug-*.mjs`.
   - Identifica causa raíz (console.log en handler clave).
   - Aplica el fix.
   - Re-corre el e2e.
   - Verifica que no rompiste el quality gate.
5. **Commit** con conventional prefix.
6. **Avisa al usuario** qué hiciste, qué testeaste, qué sigue.

#### Debugging patterns

- **"Maximum update depth exceeded"** → branded ID como dep de useEffect. Solución en §11.6.
- **"Cannot update a component while rendering"** → setState durante render. Usualmente por un componente que llama setter en el body. Mover a useEffect o event handler.
- **Wizard no avanza en step N** → schema de Zod rechaza. Agregar `console.log` en `goNext` para ver el resultado de `trigger(fields)`. Si `valid: false`, el campo tiene un valor que no pasa.
- **Datos no se persisten** → revisar mapper row↔domain. Casi siempre es una columna que no se serializa o se deserializa mal.
- **Toast de error Zod genérico** → schema sin mensaje específico en ese campo. Agregar mensaje a `min()`, `max()`, `int()`, etc. Patrón T3.
- **Build falla en producción pero no en dev** → variable de entorno, dependencia con副作用 en import, o HMR masking el bug. Probar `npm run build && npm run preview`.

#### Cómo agregar una nueva feature cross-module

1. Identifica qué módulos toca.
2. Si la feature requiere coordinación entre módulos (ej. "plan requiere consulta"):
   - Crea un `src/features/X/` con un orquestador.
   - Los `features/*` son el lugar para lógica cross-module.
   - O crea un use case en `application/` del módulo dominante que llama a los repos de los otros.
3. Si es un feature de UI (ej. dashboard widget):
   - Crea un componente en `src/components/composite/`.
   - Usa los hooks de cada módulo.
4. Si requiere persistencia nueva:
   - Crea nueva tabla en Dexie (migración nueva versión).
   - Crea el módulo o agrégalo a uno existente.

#### Convenciones de commit

```bash
# Formato
<type>(<scope>): <description>

# Tipos
feat     # nueva feature
fix      # bug fix
refactor # cambio sin feature ni fix
chore    # deps, config, build
docs     # documentación
test     # tests
perf     # performance
style    # formato

# Scopes principales
patient, anthropometry, laboratory, consultation, mealplan, smae,
hooks, dashboard, ui, infra, docs, build, wizard, deps

# Ejemplos reales del proyecto
feat(consultation): wizard SOAP multi-paso con orquestación paciente+antropometría+laboratorio
fix(consultation): wizard save + memoize patientId refs
fix(hooks): useEffect infinite loop on branded IDs
feat(consultation): signos vitales opcionales + errores legibles + tooltips lab
```

#### Cuándo pedir confirmación al usuario

- **No pidas** para: install deps, elegir lib estándar, naming interno, refactors.
- **Pide antes** de: agregar feature no listada, cambiar de Tauri a Electron, romper API pública, hacer `git push`, hacer `git rebase` de commits ya pusheados.
- **Confirma** cuando: termines un sprint (para revisar), aparezca un bug nuevo no anticipado, quieras refactorizar más allá del scope.

### 11.8 Anti-patterns descubiertos (con código)

#### AP-01: `type="submit"` en botón reemplazable

```tsx
// ❌ MAL — el Siguiente se reemplaza por Guardar al cambiar step
{step < N ? (
  <Button type="button" onClick={goNext}>Siguiente</Button>
) : (
  <Button type="submit">Guardar</Button>
)}
// El click en Siguiente de step 5→6 re-renderiza, el browser
// re-targeta el click al Guardar (type=submit) y auto-envía.

// ✓ BIEN
{step < N ? (
  <Button type="button" onClick={goNext}>Siguiente</Button>
) : (
  <Button type="button" onClick={() => void onSubmit()}>Guardar</Button>
)}
```

#### AP-02: `z.literal(NaN)`

```ts
// ❌ MAL — NaN !== NaN, no matchea nunca
const schema = z.object({
  field: z.literal(NaN).optional(),
});

// ✓ BIEN
const schema = z.object({
  field: z.preprocess(
    (v) => (typeof v === "number" && Number.isNaN(v) ? undefined : v),
    z.coerce.number().int().min(0).max(100).optional(),
  ),
});
```

#### AP-03: Null default en Zod optional

```ts
// ❌ MAL — z.string().optional() no acepta null explícito
const schema = z.object({
  notes: z.string().optional().nullable(), // o así:
  notes: z.string().optional(),  // tampoco acepta null
});

// ✓ BIEN — preprocess normaliza null → ""
const schema = z.object({
  notes: z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().trim().max(2000).optional().or(z.literal("")).transform(/* ... */),
  ),
});
```

#### AP-04: Branded ID como dep de useEffect

```ts
// ❌ MAL — el objeto PatientId cambia cada render
useEffect(() => {
  loadPatient(patientId);
}, [patientId]);

// ✓ BIEN — string estable
const patientIdStr = patientId?.toString();
useEffect(() => {
  if (patientIdStr) loadPatient(PatientId.fromUnsafe(patientIdStr));
}, [patientIdStr]);
```

#### AP-05: Radix Checkbox en form dinámico

```tsx
// ❌ MAL — en el wizard de consulta, causa "Cannot update while rendering"
import { Checkbox } from "@components/ui/checkbox";
<Checkbox checked={vitalsTaken} onCheckedChange={...} />

// ✓ BIEN — native input estilado
<input
  type="checkbox"
  checked={vitalsTaken}
  onChange={(e) => setValue("vitalsTaken", e.target.checked)}
  className="size-4 accent-primary"
/>
```

#### AP-06: Schema que rechaza fechas futuras silenciosamente

```ts
// ❌ MAL — la validación falla pero el form no avanza
consultationDate: z.string().min(1, "Requerido")
  .refine((v) => new Date(v).getTime() <= Date.now(), "No puede ser futuro"),
// El usuario llena "2026-06-15" cuando es 2026-06-02. Step 1 no avanza.
// El usuario no sabe por qué.

// ✓ BIEN — mensajes específicos + allow 1 día de margen
consultationDate: z.string().min(1, "Requerido")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida")
  .refine(
    (v) => new Date(v).getTime() <= Date.now() + 24*60*60*1000,
    "No puede estar más de 1 día en el futuro",
  ),
```

#### AP-07: Importar React/Tauri/Dexie en `domain/`

```ts
// ❌ MAL — acopla el dominio a infraestructura
// src/modules/patient/domain/Patient.ts
import { v4 as uuid } from "uuid"; // NO, usar UUIDv7
import Dexie from "dexie"; // NUNCA

// ✓ BIEN — solo stdlib o libs puras
// UUIDv7 via small custom impl o lib tipo `uuidv7` (no `uuid` v4)
```

#### AP-08: Mappers que mutan

```ts
// ❌ MAL
export function patientRowToDomain(row: PatientRow): Patient {
  const p = new Patient();
  p.firstName = row.first_name; // TS no permite, pero el principio es: no mutes
  return p;
}

// ✓ BIEN — usar factory/reconstitute
export function patientRowToDomain(row: PatientRow): Patient {
  return Patient.reconstitute({
    id: PatientId.fromUnsafe(row.id),
    firstName: row.first_name,
    // ...
  });
}
```

#### AP-09: Bypass de Zod en use cases

```ts
// ❌ MAL — el use case no valida, confía en el caller
export class CreatePatientUseCase {
  async execute(input: any): Promise<Patient> {
    return this.repo.save(Patient.create(input));
  }
}

// ✓ BIEN — validar en el boundary
export class CreatePatientUseCase {
  async execute(input: unknown): Promise<Patient> {
    const validated = PatientFormSchema.parse(input); // o .safeParse + manejo
    return this.repo.save(Patient.create(validated));
  }
}
```

#### AP-10: Hardcodear strings de error en UI

```tsx
// ❌ MAL — string de error repetido en 3 archivos
{error.weightKg && <p>El peso debe ser mayor a 1 kg</p>}

// ✓ BIEN — el mensaje vive en el schema Zod
{errors.weightKg?.message && <p>{errors.weightKg.message}</p>}
```

### 11.9 Issues conocidos y workarounds

#### IK-01: Tauri Rust build bloqueado

**Síntoma:** `pnpm dev:tauri` o `pnpm build:tauri` falla con errores de link.exe o "Visual Studio Build Tools not found".

**Causa:** el dev environment no tiene VS Build Tools instalado. Es el blocker conocido desde Sprint 1.

**Workaround:** usar `pnpm dev` (Vite puro) para todo el desarrollo. La app funciona en navegador. Cuando se necesite build nativa, instalar Build Tools.

**Storage actual:** IndexedDB (Dexie 4) en vez de SQLite. Cuando se migre a Tauri nativo, se reemplaza el adapter (`DexieXRepository` → `SqliteXRepository`), dominio intacto.

#### IK-02: React 19 strict mode re-invoca handlers

**Síntoma:** un onClick o un onSubmit aparece 3 veces en console (1 real + 2 strict mode). A veces causa comportamiento extraño (ej. 3 saves en lugar de 1).

**Causa:** React 19 strict mode corre los handlers dos veces para detectar side effects. No es un bug, es la feature.

**Workaround:**
- Si es un save duplicado, agregar idempotencia por `id` en el use case.
- Si es un setState duplicado, no es problema (React deduplica).
- Si es un side effect externo (HTTP, console.log), usar `useRef` o chequear flag.

**Estado actual:** los saves de consulta crean 3 entries en IndexedDB (duplicate). Tarea pendiente: idempotencia por consultationNumber o UUID. No es blocker — el detalle page muestra la última.

#### IK-03: Dev server se queda colgado

**Síntoma:** Vite no responde, HMR no actualiza, los cambios no se reflejan.

**Causa:** HMR falla en casos edge (cambios grandes en schemas, errores de import).

**Workaround:** matar y reiniciar:
```bash
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev > dev.log 2>&1" -WindowStyle Hidden
Start-Sleep -Seconds 10
(Invoke-WebRequest -Uri "http://localhost:1420/" -UseBasicParsing).StatusCode  # debe ser 200
```

#### IK-04: IndexedDB en tests e2e

**Síntoma:** los tests e2e con Playwright no comparten IndexedDB entre páginas o entre runs.

**Causa:** Playwright usa contexto de browser nuevo por default. IndexedDB es per-context.

**Workaround:** usar `chromium.launchPersistentContext()` o `storageState` para persistir entre tests. Los tests actuales (`tests/debug-*.mjs`) crean un patient nuevo en cada run, no es problema.

**Estado actual:** los debug tests crean patient + consultation por corrida. Funciona, no comparte estado. Aceptable para validación manual; para E2E formal se necesita una estrategia de fixtures.

#### IK-05: Playwright import path

**Síntoma:** `import { chromium } from "playwright"` falla con "Cannot find module".

**Causa:** pnpm instala Playwright en `.pnpm/playwright@VERSION/node_modules/playwright/`. La resolución de Node no lo encuentra desde `tests/`.

**Workaround usado:**
```js
import { chromium } from "../node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";
```

**Acción pendiente:** configurar `playwright.config.ts` correctamente para que `npx playwright test` funcione. Por ahora los debug scripts son manuales.

#### IK-06: Mensaje "Cannot update a component while rendering" en wizard

**Síntoma:** warning amarillo en console cuando se navega steps del wizard.

**Causa:** algún setState durante render, posiblemente del FormProvider de RHF en combinación con React 19 strict mode.

**Workaround actual:** ignorado. No afecta funcionalidad. Pendiente investigar la fuente exacta y aislar (probablemente un `watch()` que dispara re-render).

**No es blocker** — los tests pasan, la UX funciona.

#### IK-07: `useEffect` de AnthropometryForm en PatientMeasurementsPage

**Síntoma:** al volver a la página de mediciones de un paciente, se ve la medición anterior antes de cargar la nueva.

**Causa:** el hook no espera a la cancelación del effect anterior antes de fetch.

**Workaround:** `cancelled` flag (ya implementado en `useAnthropometryHooks.ts`). Funciona.

---

## 12. Roadmap por fases

### Fase 1 — MVP foundations ✓ COMPLETA (Sprints 1-7)

- ✓ `patient` (Sprint 1)
- ✓ `anthropometry` (Sprint 2)
- ✓ Cálculos BMI, BMR, TDEE, composición corporal
- ✓ Design system base
- ✓ Layout shell (Sidebar, Header, StatusBar, CommandPalette)
- ✓ `laboratory` (Sprint 4)
- ✓ `consultation` (Sprint 5)
- ✓ `mealplan` (Sprint 6)
- ✓ Dashboard con KPIs reales, cross-module via CommandPalette (Sprint 7)
- ✓ **v1 usable end-to-end** declarada en commit `993cc04`
- ✓ 207 tests pasando

### Fase 2 — Clinical expansion (EN PROGRESO)

Pendiente inmediato (siguiente sprint):
- ⏳ `smae` como módulo propio con buscador y equivalencias inversas (feedback #10)
- ⏳ `services/importer/` — importar pacientes desde CSV
- ⏳ `services/pdf/` — exportar consulta / plan a PDF
- ⏳ `services/backup/` + `services/crypto/` — backup cifrado local
- ⏳ Tests E2E formales (Playwright en CI)
- ⏳ Drag & drop en meal plan (preparado con @dnd-kit, no usado aún)
- ⏳ Catálogo navegable de alimentos (feedback #10)
- ⏳ Visualización de distribución de tiempos en plan (feedback #9)

### Fase 3 — Engine, sync, security (PLANIFICADA)

- ⏳ `clinical-engine` — motor de reglas para sugerir diagnóstico (SNOMED CT) y plan base (feedbacks #7, #8)
- ⏳ Selección de alimentos vía equivalencias inversas (feedback #11)
- ⏳ No permitir crear plan sin consulta previa (feedback #6)
- ⏳ `services/sync/` — sync HTTP bidireccional con backend (cuando exista)
- ⏳ `services/queue/` — cola de acciones offline-first
- ⏳ `services/audit/` — log inmutable de acciones clínicas
- ⏳ `services/crypto/` — cifrado en reposo
- ⏳ Reglas: HTN, DM2, dislipidemia, ERC — bundles diagnósticos
- ⏳ Integración consulta↔plan: derivar plan base desde consulta

### Fase 4 — Multi-platform, IA (PLANIFICADA)

- ⏳ Multi-clínica (multi-tenant)
- ⏳ `services/ai/` — asistente IA local (sugerencias, redacción SOAP)
- ⏳ App móvil (React Native o Tauri Mobile)
- ⏳ Telemedicina (videollamada, mensajería)
- ⏳ Integración con básculas/baumanómetros/wearables (BLE)
- ⏳ Importación OCR de resultados de laboratorio
- ⏳ Sincronización en la nube (opcional, cifrada E2E)

---

## 13. Decisiones arquitectónicas (ADRs)

> Las ADRs formales (`docs/decisions/0001-*.md` etc.) están pendientes de escribir. Aquí se listan las decisiones tomadas durante el desarrollo con su justificación.

### ADR-001 — IndexedDB/Dexie ahora, SQLite después

**Decisión:** usar Dexie 4 + IndexedDB en v1. Migrar a SQLite vía `tauri-plugin-sql` en Fase 3.

**Contexto:** VS Build Tools no garantizadas en todos los dev environments. SQLite requiere compilar native code.

**Consecuencia:** +1 adapter en cada migración. Pero el dominio no se entera (inversión de dependencias). Tests corren con `fake-indexeddb` sin cambios.

### ADR-002 — Hash routing para Tauri

**Decisión:** `createHashRouter` en lugar de `createBrowserRouter`.

**Contexto:** Tauri sirve desde `tauri://` (Windows), `tauri://localhost` (Linux), `tauri://` (macOS). History API no funciona bien con file:// ni con custom protocols.

**Consecuencia:** URLs son `/#/pacientes/{id}`. Ligeramente menos SEO-friendly (irrelevante en app desktop), pero 100% compatible.

### ADR-003 — SMAE 5ª edición como única fuente nutricional

**Decisión:** todas las unidades de alimento en planes son **equivalentes SMAE**, no calorías crudas.

**Contexto:** SMAE es el estándar oficial en México para educación nutricional. Permite intercambios flexibles.

**Consecuencia:** los planes son culturalmente apropiados, comparables entre nutriólogos, y enseñan al paciente. Pero requiere catálogos bien mantenidos (módulo `smae` en Fase 2).

### ADR-004 — Zod en application/ como single source of truth

**Decisión:** cada módulo tiene su schema Zod en `application/`. Los VOs validan al construirse (con throws); los schemas validan input de UI antes de llegar al dominio.

**Contexto:** frontera UI↔dominio es el lugar más débil. Zod da inferencia de tipos, mensajes de error declarativos, y validación declarativa.

**Consecuencia:** el dominio se mantiene puro (no importa Zod). Los schemas son SSOT para validación de formularios (RHF + zodResolver). Los errores son objetos `ZodError` estructurados.

### ADR-005 — Soft delete + immutable snapshots

**Decisión:** ningún registro se borra físicamente. Soft delete con `deletedAt`. Correcciones crean nuevo snapshot.

**Contexto:** datos clínicos son evidencia legal. Borrar destruye auditoría. Corregir destruye la historia.

**Consecuencia:** tablas crecen, pero el costo es aceptable. Queries de UI filtran `deletedAt === null` por defecto. Reportes y auditoría ven el histórico completo.

### ADR-006 — IDs branded (UUIDv7) en lugar de `string`

**Decisión:** cada entidad tiene su `XId` branded type. Comparación con `equals()`. Construcción con `XId.generate()` (UUIDv7) o `XId.fromUnsafe(s)`.

**Contexto:** `string` para IDs es propenso a bugs (pasas un `ConsultationId` donde se espera `PatientId`). UUIDv7 da ordenamiento temporal gratis.

**Consecuencia:** +1 clase por módulo, pero type safety real. Tests requieren `equals()` (no `===`).

### ADR-007 — Service containers manuales, no framework DI

**Decisión:** cada `src/services/*Service.ts` es un objeto con use cases pre-instanciados. Sin contenedor IoC, sin decoradores.

**Contexto:** Inversify / tsyringe / nest añaden complejidad que no necesitamos en app local. Un objeto simple es legible, type-safe, y testeable.

**Consecuencia:** -0 magic, -0 runtime overhead. Tests pueden sustituir repositorios con mocks manuales (`const mockRepo: PatientRepository = { ... }`).

### ADR-008 — Bug fix T1: Zod preprocess para NaN/null/undefined

**Contexto:** Zod no acepta `null` en `z.string().optional()` si el default es `null`. Zod no acepta `z.literal(NaN)` (porque `NaN !== NaN`).

**Decisión:** usar `z.preprocess()` para normalizar null/NaN/empty-string antes de validar.

```ts
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().trim().max(max).optional().or(z.literal("")).transform(/* ... */),
  );

const vitalField = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "number" && Number.isNaN(v) ? undefined : v),
    z.coerce.number().int().min(min).max(max).optional(),
  );
```

### ADR-009 — Bug fix T2: Guardar consulta NO es type="submit"

**Contexto:** click en Siguiente (type=button) avanzaba step 5→6, pero al re-renderizar el botón se reemplaza por Guardar (type=submit) en el mismo DOM position. El browser re-targeta el click al Guardar y dispara form submit antes de que el usuario revise.

**Decisión:** Guardar es `type="button"` con `onClick={() => void onSubmit()}` que llama el handler de RHF programáticamente.

```tsx
<Button type="button" onClick={() => void onSubmit()} disabled={submitting}>
  <Save /> {submitting ? "Guardando…" : "Guardar consulta"}
</Button>
```

**Consecuencia:** el form nunca se auto-envía. El usuario debe hacer click explícito. La función `onSubmit()` (que es `methods.handleSubmit(...)`) es invocada directamente, sin pasar por el browser.

### ADR-010 — Native `<input type="checkbox">` sobre Radix Checkbox

**Contexto:** shadcn Checkbox (Radix) causaba `Cannot update a component while rendering` en el wizard durante el toggle de signos vitales.

**Decisión:** usar native checkbox con styling Tailwind (`accent-primary`, `focus-visible:ring-1`).

**Consecuencia:** -0 dependencias Radix en este caso específico. La accesibilidad sigue siendo buena (label asociado, focus visible). Se podría re-intentar Radix si se aisla el bug.

---

## 14. Feedback de usuario v1 (resuelto y pendiente)

Recibido tras Sprint 7 (v1 usable). Numerado según el orden en que fue procesado.

### ✓ Resuelto

| # | Feedback | Resolución | Commit |
|---|----------|-----------|--------|
| 1 | Primera visita: antropometría sí obligatoria, vitales opcional | Toggle "¿Se tomaron signos vitales?" en wizard step 3 (T2) | `786e9e6` |
| 2 | Vitales opcionales (no forzar PA) | Mismo toggle, persiste `Vitals.empty()` si no | `786e9e6` |
| 3 | Bug botón guardar consulta | Zod preprocess + onInvalid (T1) + auto-submit fix (ADR-009) | `1e158e6` + `786e9e6` |
| 4 | Error Zod genérico en antropometría | Mensajes específicos por campo + onInvalid toast (T3) | `786e9e6` |
| 5 | Iconos de laboratorio sin contexto | Tooltips Radix con valor + rango + mensaje legible (T4) | `786e9e6` |
| 6 | No permitir plan sin consulta | **Pendiente — Fase 3** (validación cross-module) | — |
| 7 | Sistema sugiere diagnóstico | **Pendiente — Fase 3** (`clinical-engine/`) | — |
| 8 | Plan sugerido por sistema | **Pendiente — Fase 3** (reglas desde consulta) | — |
| 9 | Mejor visual distribución de tiempos | **Pendiente — Fase 2** (meal plan UI) | — |
| 10 | Catálogo SMAE | **Pendiente — Fase 2** (módulo `smae/`) | — |
| 11 | Seleccionar alimento vía equivalencias SMAE | **Pendiente — Fase 3** (motor de equivalencias) | — |

### ⏳ Pendiente (orden sugerido)

1. **Sprint 8 — Catálogo SMAE navegable** (Fase 2): módulo `smae/` con búsqueda, equivalencias inversas, CRUD de alimentos personalizados. Desbloquea feedback #10 y prepara #11.
2. **Sprint 9 — Meal plan drag & drop + visual tiempos** (Fase 2): usa `@dnd-kit` ya instalado. Feedback #9 + #11 parcial.
3. **Sprint 10 — Importer CSV + PDF export** (Fase 2): `services/importer/`, `services/pdf/`.
4. **Sprint 11 — Backup cifrado** (Fase 2): `services/backup/`, `services/crypto/`.
5. **Sprint 12 — Plan requires consulta** (Fase 3): validación cross-module, derivar plan base desde consulta. Feedback #6.
6. **Sprint 13 — clinical-engine reglas** (Fase 3): motor de diagnóstico y plan sugerido. Feedbacks #7, #8.
7. **Sprint 14 — Sync queue + HTTP** (Fase 3): `services/sync/`, `services/queue/`, `services/api/`. Cuando exista backend.

---

## 15. Glosario

| Término | Definición |
|---------|-----------|
| **Bounded context** | Subdominio con su propio modelo de lenguaje. En este codebase: cada `src/modules/*` es un bounded context. |
| **Branding (TypeScript)** | Técnica para hacer tipos opacos: `type PatientId = string & { __brand: "PatientId" }`. Evita pasar IDs del tipo equivocado. |
| **Composition root** | Único lugar donde se ensamblan las piezas (DI). Aquí: `src/services/*Service.ts`. |
| **DTO (Data Transfer Object)** | Objeto plano para mover datos entre capas. En este codebase: `XRow` (Dexie) y `XProps` (reconstitute). |
| **Hexagonal / Ports & Adapters** | Arquitectura donde el dominio define puertos (interfaces) y la infra los implementa. Permite swap de persistencia. |
| **Inmutabilidad** | Las entidades no cambian; cualquier modificación produce una nueva instancia. |
| **Mapeador (mapper)** | Función que convierte entre capas (`XRow` ↔ `X`). En este codebase: `xMapper.ts` en `infrastructure/`. |
| **Pillow (snapshot)** | Registro inmutable con timestamp de cuándo pasó. "Snapshot" en este doc. |
| **SMAE 5ª** | Sistema Mexicano de Alimentos Equivalentes, 5ª edición. Estándar oficial para prescripción dietética en México. |
| **Soft delete** | Borrado lógico (`deletedAt`), no físico. El row permanece para auditoría. |
| **Snapshot** | Estado capturado en un momento del tiempo, inmutable. Una medición es un snapshot; no se edita, se reemplaza. |
| **Tauri** | Framework para empaquetar apps web como binarios nativos (Rust + WebView). |
| **UUIDv7** | UUID ordenado por timestamp. Genera IDs ordenables sin coordinación central. |
| **Value Object (VO)** | Objeto definido por sus valores, no por identidad. `Email`, `Phone`, `Weight`, `Vitals`. |
| **VO inmutable** | VO sin setters; cualquier "cambio" devuelve nueva instancia. |

---

## Apéndice A — Métricas del proyecto

**Fecha de corte:** tras commit `786e9e6`.

| Métrica | Valor |
|---------|-------|
| Módulos | 7 (5 implementados + 2 planificados) |
| Subcarpetas transversales | 15 (5 services + 10 stubs) |
| Tests totales | 207 |
| Archivos de test | 19 |
| Duración suite | ~22s |
| Líneas de código (TS/TSX) | ~14k (estimado) |
| Build size | ~168 KB gzip |
| Dependencias producción | 50 |
| Dependencias dev | 30 |
| Commits | 6+ (ver git log) |
| Cobertura de dominio | ~85% (estimado) |

## Apéndice B — Cómo correr

```bash
# Setup
pnpm install
pnpm approve-builds esbuild   # Windows: necesario una vez

# Dev
pnpm dev                       # Vite en http://localhost:1420
pnpm dev:tauri                 # Compila Rust + abre ventana nativa

# Quality gate
pnpm typecheck                 # tsc -b --noEmit
pnpm lint                      # ESLint
pnpm test                      # Vitest (207 tests)
pnpm e2e                       # Playwright (Fase 2)

# Build
pnpm build                     # TS + Vite
pnpm build:tauri               # Empaqueta instalador nativo
```

---

## 16. Recent activity (changelog)

### Commits relevantes (orden inverso)

| Hash | Mensaje | Sprint | Impacto |
|------|---------|--------|---------|
| `786e9e6` | feat(consultation): signos vitales opcionales + errores legibles + tooltips lab | Sprint 8 (T1-T4) | Toggle vitales, Vitals VO, auto-submit fix, mensajes Zod legibles, tooltips lab. +0 tests, neto. |
| `1e158e6` | fix(consultation): wizard save + memoize patientId refs | Sprint 7.5 (T1) | Zod preprocess para NaN/null, memoize PatientId en 10 pages. 207 tests. |
| `69fcc35` | fix(hooks): useEffect infinite loop on branded IDs | Sprint 7.5 (bugfix) | Hooks usan `idStr` en lugar de `id` branded. Resuelve "Maximum update depth". |
| `993cc04` | feat(dashboard): KPIs reales + CommandPalette cross-module → v1 usable end-to-end | Sprint 7 | **DECLARACIÓN v1 USABLE**. 7 stores, CommandPalette, DashboardPage con KPIs, NotificationsPage, ProfilePage. |
| `c9687c5` | feat(mealplan): módulo completo de planes alimentarios basados en SMAE 5ª edición | Sprint 6 | MealPlan con 5 slots, ~30 alimentos SMAE, planCalculations. 16+9+9+6 = 40 tests. |
| `eaea155` | feat(consultation): wizard SOAP multi-paso con orquestación paciente+antropometría+laboratorio | Sprint 5 | Consultation con 6-step wizard SOAP. 16+9+8 = 33 tests. |
| `4fb14af` | feat(laboratory): 24 códigos con ref ranges México, Recharts trend | Sprint 4 | LabPanel con 24 códigos, MEXICO_REFERENCE_RANGES, labCalculations (16 tests). |
| `993cc04` | feat(anthropometry): ... | Sprint 2 | (referencia) |
| `993cc04` | feat(patient): ... | Sprint 1 | (referencia) |

### Feedback v1 → resolución

| # | Issue | Sprint | Tarea | Estado |
|---|-------|--------|-------|--------|
| 1 | Antropometría sí obligatoria, vitales opcional | 8 | T2 | ✓ toggle implementado |
| 2 | Vitales opcionales (no forzar PA) | 8 | T2 | ✓ toggle + Vitals.empty() |
| 3 | Bug botón guardar | 7.5+8 | T1 + ADR-009 | ✓ Zod preprocess + onClick manual |
| 4 | Error Zod genérico | 8 | T3 | ✓ mensajes específicos por campo |
| 5 | Iconos lab sin contexto | 8 | T4 | ✓ Radix Tooltip |
| 6 | No permitir plan sin consulta | - | - | ⏳ Sprint 12 |
| 7 | Sistema sugiere diagnóstico | - | - | ⏳ Sprint 13 (clinical-engine) |
| 8 | Plan sugerido por sistema | - | - | ⏳ Sprint 13 |
| 9 | Mejor visual tiempos en plan | - | - | ⏳ Sprint 9 |
| 10 | Catálogo SMAE | - | - | ⏳ Sprint 8 (módulo smae/) |
| 11 | Equivalencias inversas | - | - | ⏳ Sprint 13 |

### Línea de tiempo narrativa

1. **Sprint 1-2:** paciente + antropometría, vertical slice mínimo.
2. **Sprint 3:** design system, layout, providers, router base.
3. **Sprint 4:** laboratorio, cálculos clínicos avanzados (CKD-EPI, HOMA-IR, Friedewald).
4. **Sprint 5:** consulta SOAP wizard, primeros 33 tests de consultation.
5. **Sprint 6:** plan de alimentación con SMAE.
6. **Sprint 7:** integración cross-module, dashboard, command palette, **v1 declarada**.
7. **Sprint 7.5 (post-v1):** bug fix de infinite re-render hooks (`69fcc35`).
8. **Sprint 7.5+:** usuario prueba v1, encuentra 4 bugs críticos (T1-T4).
9. **Sprint 8 (actual):** integración de feedback v1. T1 (save), T2 (vitales), T3 (errores Zod), T4 (tooltips). **Aquí estamos.**

---

## 17. Open questions para el usuario

Cosas que **no** están decididas formalmente y que la siguiente IA debería confirmar antes de empezar el sprint siguiente.

### Q-01: ¿Crear ADRs formales en `docs/decisions/`?

**Estado:** carpeta existe, vacía. El spec.md §13 tiene las 10 ADRs narrativas.

**Opciones:**
- A) Mantener spec.md como única fuente. No escribir ADRs formales.
- B) Crear las 10 ADRs en `docs/decisions/NNNN-titulo.md` con plantilla de Michael Nygard (Contexto, Decisión, Consecuencias, Alternativas).
- C) Solo las 4 más críticas (ADR-001 Dexie, ADR-003 SMAE, ADR-004 Zod, ADR-005 soft delete).

**Recomendación:** B si se va a Fase 3 (muchas decisiones estructurales). A si se mantiene el spec.md actualizado.

### Q-02: ¿Implementar i18n ahora?

**Estado:** `src/i18n/` existe, vacío. Toda la UI está hardcodeada en español (es-MX).

**Opciones:**
- A) Mantener monolingüe. UI en español, código en inglés.
- B) Introducir i18n con `react-i18next` o `react-intl` ahora.
- C) Extraer strings a un módulo de constantes `src/i18n/es-MX.ts` (sin librería) para preparar.

**Recomendación:** C si hay planes de internacionalizar. A si se queda en México.

### Q-03: ¿Cuándo E2E en CI?

**Estado:** `playwright.config.ts` existe, no usado. Tests en `tests/debug-*.mjs` corren manualmente.

**Opciones:**
- A) Sprint 8: invertir 1 día en suite E2E formal (`tests/e2e/*.spec.ts`) + CI step.
- B) Sprint 11: después de plan/dashboard estén estables.
- C) No en CI. Solo debug scripts.

**Recomendación:** A. Los debug scripts ya están al 80%; solo falta formalizar y agregar a CI.

### Q-04: ¿Cuándo SQLite/Tauri nativo?

**Estado:** Tauri Rust build bloqueado por VS Build Tools. Dexie es storage actual.

**Opciones:**
- A) Resolver el blocker primero (instalar Build Tools), luego migrar a SQLite.
- B) Quedarse en Dexie hasta Fase 3 (cuando se necesite sync remoto).
- C) Explorar alternativas: `tauri-plugin-sql` con SQLite precompilado.

**Recomendación:** B. Dexie es suficiente para v1-Fase 2.

### Q-05: ¿Migrar a React Query (TanStack Query)?

**Estado:** llamadas a repos son síncronas desde la UI. No hay caché, no hay revalidación automática.

**Opciones:**
- A) Quedarse con hooks custom + repos directos (status quo).
- B) Adoptar TanStack Query 5 para `useQuery`/`useMutation` con caché.

**Recomendación:** B en cuanto haya sync (Fase 3). Ahora es overkill.

### Q-06: ¿Tests de property con fast-check?

**Estado:** `fast-check` está instalado, no usado en tests.

**Opciones:**
- A) Agregar property tests para invariantes (roundtrips, normalizaciones, orden de IDs UUIDv7).
- B) No, con 207 unit/integration basta.

**Recomendación:** A. Es barato y cazaría bugs que los unit tests no ven (especialmente en `Vitals`, `Weight`, `Circumference`).

### Q-07: ¿Mover `tests/debug-*.mjs` a `tests/manual/`?

**Estado:** los scripts viven en `tests/` pero son manuales. Podrían confundir con E2E formales.

**Opciones:**
- A) Dejar como están. El nombre `debug-` indica.
- B) Mover a `tests/manual/` o `scripts/e2e/`.
- C) Borrarlos una vez que T1-T4 estén verificados en CI.

**Recomendación:** C, pero con un commit dedicado. El valor histórico ya está capturado en spec.md §14.

---

## 18. Communication preferences

### 18.1 Idioma

- **UI:** español (es-MX). Mensajes de error, validaciones, textos de ayuda, tooltips, todo.
- **Código:** inglés para identifiers, comentarios, JSDoc, commits.
- **Conversación con el usuario:** español. La siguiente IA debe responder en español a menos que el usuario cambie a inglés.
- **Reportes de avance:** español. Formato conciso.

### 18.2 Tono

- **Conciso y directo.** El usuario ya leyó este spec, no necesita repetirle el plan.
- **No pedir permiso para decisiones técnicas menores** (elegir lib estándar, naming interno, estructura de carpetas).
- **Pedir confirmación para:** cambios de scope, agregar features no listadas, refactor que afecta más de un sprint, decisiones regulatorias o de seguridad.
- **Mostrar, no contar.** Después de cada cambio relevante, mostrar el resultado (screenshot, output de test, comando ejecutado).

### 18.3 Formato de respuesta

- **Markdown con headers `###` o `####`** para organización. No usar `#` (es para el documento).
- **Code blocks** con lenguaje (`bash`, `ts`, `tsx`).
- **Tablas** para comparaciones, no prosa.
- **Listas** para pasos, no párrafos.
- **Una sola línea de respuesta** si la pregunta es sí/no.
- **4-6 líneas máximo** para respuestas narrativas. Si necesitas más, abre un bloque expandible o usa header.

### 18.4 Triggers explícitos del usuario

El usuario ha dicho cosas que la IA siguiente debe respetar:

1. **"me puedes avisar cuando la aplicación se pueda usar en su v1, por favor para retroalimentar"** — significa: avisa al usuario cuando **el flujo end-to-end funcione** (alta paciente → consulta → plan). Ya pasó (Sprint 7, commit `993cc04`). Después de eso, sigue el roadmap.
2. **"adelante como tú lo veas"** — libertad total de instalar deps, elegir sprint, proponer arquitectura.
3. **"sin reducciones MVP, sin remoción de módulos"** — explícito. No borrar nada.
4. **"SMAE 5ª autoritativo; nunca inventar valores nutricionales"** — los datos nutricionales vienen del catálogo. Si no está, espera.
5. **"ES UI; identifiers EN, comments ES"** — §11.1.
6. **Feedbacks del usuario (sección §14)** son críticos. Tratarlos como bugs P0 hasta resolver.
7. **El usuario trabaja en Windows con PowerShell 5.1.** Los comandos deben ser compatibles. Cuidar con `&&` (no funciona); usar `; if ($?) { ... }` o `cmd1; cmd2`.

### 18.5 Cuándo avisar al usuario

- **Después de cerrar un sprint:** "Sprint X cerrado. [Resumen]. Calidad: [typecheck/lint/test/build todos pasan]. Siguiente: [Sprint Y]."
- **Cuando aparezca un bug nuevo** no anticipado: "Bug encontrado en [módulo]: [síntoma]. Causa: [X]. Fix: [Y]. ¿Procedo?"
- **Cuando se complete un feedback:** "Feedback #[X] resuelto. [Resumen del fix]. [Test/manual verification result]."
- **Cuando el quality gate falle:** "Quality gate roto en [step]: [error]. [Diagnóstico]. [Fix propuesto]."
- **Cuando se tome una decisión mayor** (no en la lista del spec): "Decisión tomada: [X]. Justificación: [Y]. Reversible: [sí/no]."
- **Cuando el usuario pida algo fuera de scope:** "Eso entra en [Sprint X]. Lo agendo ahí. ¿O lo subo de prioridad?"

### 18.6 Cuándo NO avisar

- Cada vez que commitees (a menos que el commit cierre un sprint).
- Refactors internos.
- Updates de dependencias.
- Cambios de configuración.

### 18.7 Plantilla de reporte de sprint

Después de cerrar un sprint, la respuesta al usuario debe seguir este formato:

```markdown
## Sprint X — [nombre]

**Cerrado:** [commit hash]
**Trabajo:** [1-3 bullets de qué se hizo]
**Feedbacks atendidos:** [lista de números §14]
**Quality gate:** typecheck ✓ · lint ✓ · tests [N+/N+] ✓ · build ✓
**Métricas:** [tests +/- delta, líneas +/- delta]
**Siguiente sprint lógico:** [Sprint Y, nombre]
**Bloqueos:** [ninguno | descripción]
```

### 18.8 Si la siguiente IA no entiende algo del spec

1. Buscar en este spec primero (Ctrl+F).
2. Buscar en `git log -p -- <archivo>` para historia de cambios.
3. Buscar en el código el test más cercano al tema.
4. Si después de eso sigue sin entender, **preguntar al usuario** con contexto (qué buscaste, qué encontraste, qué no encuentras).

## Apéndice C — Estructura de carpetas completa

```
game-01/
├── .github/
│   └── workflows/ci.yml                # CI: lint + typecheck + test + build
├── docs/                                # ⚠️ carpetas creadas, vacías
│   ├── architecture/                    # (vacío — falta ARCHITECTURE.md)
│   ├── decisions/                       # (vacío — faltan ADRs)
│   ├── development/                     # (vacío)
│   ├── runbooks/                        # (vacío)
│   └── workflows/                       # (vacío)
├── public/                              # assets estáticos
├── scripts/                             # (vacío)
├── src/
│   ├── app/                             # Shell + páginas
│   │   ├── ErrorBoundary.tsx
│   │   ├── router.tsx                   # 7 rutas, hash mode
│   │   ├── hooks/useDashboardKpis.ts
│   │   ├── layout/                      # AppLayout, Sidebar, Header, StatusBar, CommandPalette, ContextPanel
│   │   ├── pages/                       # 18 páginas (ver §8.4)
│   │   └── providers/                   # ThemeProvider, NotificationProvider
│   ├── assets/
│   │   ├── css/globals.css              # 4 temas, tokens, SMAE colors, Recharts palette
│   │   └── images/
│   ├── components/
│   │   ├── composite/                   # Charts, Clinical, DataTable, Feedback, Food, Forms, Layout, Navigation
│   │   ├── icons/
│   │   ├── layout/                      # Breadcrumbs, EmptyState, ErrorState
│   │   └── ui/                          # shadcn primitives (16+)
│   ├── features/                        # ⏳ placeholders (Fase 3+)
│   │   ├── adherence/, agenda/, anthropometry/, auth/, configuration/,
│   │   ├── consultation/, dashboard/, documents/, goals/, laboratory/,
│   │   ├── meal-plan/, patient-portal/, patients/, recipes/, reports/,
│   │   ├── security/, smae/
│   ├── hooks/                           # hooks cross-cutting
│   ├── i18n/                            # (placeholder, sin uso aún)
│   ├── modules/                         # bounded contexts (dominio hexagonal)
│   │   ├── anthropometry/               # ✓ completo
│   │   ├── clinical-engine/             # ⏳ placeholder
│   │   ├── consultation/                # ✓ completo (con T2)
│   │   ├── laboratory/                  # ✓ completo (con T4)
│   │   ├── mealplan/                    # ✓ completo
│   │   ├── patient/                     # ✓ completo
│   │   └── smae/                        # ⏳ placeholder
│   ├── services/                        # composition root + transversales
│   │   ├── ai/                          # ⏳
│   │   ├── api/                         # ⏳
│   │   ├── audit/                       # ⏳
│   │   ├── backup/                      # ⏳
│   │   ├── crypto/                      # ⏳
│   │   ├── db/dexieSchema.ts            # 5 tablas, migración v2
│   │   ├── importer/                    # ⏳
│   │   ├── notification/                # ✓ sonner wrapper
│   │   ├── pdf/                         # ⏳
│   │   ├── queue/                       # ⏳
│   │   ├── sync/                        # ⏳
│   │   ├── anthropometryService.ts      # DI container
│   │   ├── consultationService.ts       # DI container
│   │   ├── labPanelService.ts           # DI container
│   │   ├── mealPlanService.ts           # DI container
│   │   └── patientService.ts            # DI container
│   ├── store/                           # Zustand (7 stores)
│   ├── types/
│   ├── utils/
│   │   ├── calculations/                # bmi, bmr, tdee, bodyComposition, labCalculations (5)
│   │   ├── cn.ts                        # shadcn cn helper
│   │   ├── format/
│   │   └── validation/
│   ├── workers/                         # (vacío — Web Workers futuros)
│   ├── App.tsx                          # providers tree
│   └── main.tsx
├── src-tauri/                           # Rust shell (Tauri)
├── tests/                               # Playwright debug scripts (no CI)
│   ├── debug-save-bug.mjs
│   ├── debug-step6.mjs
│   ├── debug-vitals.mjs
│   └── step-6.png
├── .env.example
├── .gitignore
├── components.json                      # shadcn config
├── eslint.config.js
├── index.html
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.js
├── prettier.config.json
├── README.md                            # ⚠️ desactualizado (este spec lo reemplaza como fuente)
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
└── spec.md                              # ✓ ESTE DOCUMENTO
```

---

**Próximo paso recomendado:** reemplazar `README.md` con una versión corta (quickstart + links) y dejar `spec.md` como la fuente de verdad del producto y la arquitectura. Crear las ADRs formales en `docs/decisions/` siguiendo la plantilla de Michael Nygard.

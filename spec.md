# NutriClinica — Especificación del producto y arquitectura

> Plataforma profesional de nutrición clínica para consultorios.
> Tauri v2 + React 19 + TypeScript. Offline-first, hexagonal, dominio puro.

**Versión del documento:** 2.7
**Última actualización:** Sprint 42 — hardening de auditoría y tests para grabaciones cifradas ✅
**Estado del proyecto:** Sprints 1-42 completos · Fase 1 ✅ · Fase 2 ✅ · Fase 3 ✅ · **Fase 4 ✅** · **Fase 5 ~99% 🔄** · ~440 archivos TS/TSX · ~2.2MB código fuente · 76 archivos de test frontend · 985 tests frontend · 114 tests API · 8 E2E tests
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
19. [Sistema de IA (Fase 4)](#19-sistema-de-ia-fase-4)
20. [Performance y observabilidad](#20-performance-y-observabilidad)
21. [Diseño SQL (target migración Dexie → SQLite nativo)](#21-diseño-sql-target-migración-dexie--sqlite-nativo)
22. [Expediente clínico integral del paciente (módulo 31)](#22-expediente-clínico-integral-del-paciente-módulo-31)
23. [Antropometría y composición corporal (módulo 32)](#23-antropometría-y-composición-corporal-módulo-32)
24. [Interpretación de laboratorios (módulo 33)](#24-interpretación-de-laboratorios-módulo-33)
25. [Seguimiento y evolución del paciente (módulo 34)](#25-seguimiento-y-evolución-del-paciente-módulo-34)
26. [Sistema de objetivos clínicos (módulo 35)](#26-sistema-de-objetivos-clínicos-módulo-35)
27. [Adherencia al tratamiento (módulo 41)](#27-adherencia-al-tratamiento-módulo-41)
28. [Recetario profesional (módulo 36)](#28-recetario-profesional-módulo-36)
29. [Planificador semanal + lista de compras (módulos 37 y 38)](#29-planificador-semanal--lista-de-compras-módulos-37-y-38)
30. [Agenda y gestión de citas (módulo 40)](#30-agenda-y-gestión-de-citas-módulo-40)
31. [Catálogo de medicamentos e interacciones (módulo 42)](#31-catálogo-de-medicamentos-e-interacciones-módulo-42)
32. [Generación de documentos profesionales (módulo 43)](#32-generación-de-documentos-profesionales-módulo-43)
33. [Portal del paciente (módulo 45, PWA)](#33-portal-del-paciente-módulo-45-pwa)
34. [Módulo económico (módulo 39)](#34-módulo-económico-módulo-39)
35. [Resumen del roadmap de detalle funcional](#35-resumen-del-roadmap-de-detalle-funcional)
- [Apéndice A — Métricas del proyecto](#apéndice-a--métricas-del-proyecto)
- [Apéndice B — Cómo correr](#apéndice-b--cómo-correr)
- [Apéndice C — Estructura de carpetas completa](#apéndice-c--estructura-de-carpetas-completa)

---

## 0. Handbook para la siguiente IA

### 0.1 Quién eres tú (la siguiente IA)

Vas a continuar el desarrollo de una app de nutrición clínica. El usuario es **Josue** y trabaja en Windows con PowerShell. Tiene prisa moderada y sabe lo que quiere, pero también confía en ti para tomar decisiones técnicas ("**adelante como tú lo veas**" — libertad total de instalar dependencias, elegir sprint siguiente, proponer arquitectura). Pidió v1 para dar feedback; lo que viene es integrar ese feedback y continuar el roadmap.

### 0.2 Qué estado tiene el proyecto

- **v1 usable → v2 evolucionada (55 commits, Sprints 1-14):** alta paciente → antropometría → laboratorio → consulta SOAP → plan alimentario → dashboard → SMAE navegable → importer CSV → PDF → backup cifrado → sync API → facturación → clinical engine → Playwright E2E.
- **11 puntos de feedback recibidos tras v1 — todos resueltos.**
- **Servidor API (Express + SQL Server):** auth JWT + Argon2 + RBAC, multi-tenancy, CRUD REST, sync delta/push con detección de conflictos, soft-delete recovery, billing.
- **Sync engine bidireccional:** pull delta + push batch con retry+backoff, cola offline-first, ConflictResolutionModal, StatusBar sync.
- **Facturación:** campos de pago en consultas, UI `/billing`, recibo, reporte.
- **Clinical engine:** sugerencias diagnósticas (HTN, DM2, dislipidemia, ERC, hígado graso, tiroideo, anemia, síndrome metabólico) + targets de plan base (BMR + TDEE + macros).
- **Quality:** typecheck, lint, build, tests OK. E2E: auth, billing, pacientes.
- **Dark mode (Fase 4):** ThemeToggle en sidebar (expandido/colapsado), 3 temas (light/dark/system), CSS vars `.dark`, ThemeProvider, uiStore persist vía zustand.
- **i18n (Fase 4):** i18next + react-i18next, `defaultNS: "translation"`, español (`es-MX`) e inglés (`en-US`) completos con ~500+ claves en 22 namespaces. 100% de strings visibles envueltos con `t()`. LanguageSwitcher en sidebar. Command palette con comandos de idioma y tema.
- **WCAG AA (Fase 4):** focus indicators (`ring-2` + `focus-visible:`), form labels con `htmlFor`+`id`+`aria-describedby` (43 campos), error announcements `role="alert"`, heading hierarchy semántica, LanguageSwitcher `aria-label`, Dialog scroll móvil, StatusBar touch targets (`min-h-7`), Header search colapsable, tablas responsive column hiding.
- **AI Assist (Fase 4):** 6 archivos de servicio (`AIClient`, `AIPrompts`, `AIResponseParser`, `AICapabilities`, `AIService`, `index.ts`), `useAI` hook, `AIAssistButton`, cache in-memory con TTL, audit trail, usage tracking mensual, Dexie v24 (`ai_cache`, `ai_usage_logs`), opt-in toggle en SettingsPage, integración UI en ConsultationWizard (draft SOAP + summarize), AI consent card en ClinicalRecordCards.
- **Portabilidad móvil (Fase 4):** Sidebar drawer con backdrop overlay + hamburger button, PageContent padding `p-4 sm:p-6`, AgendaPage calendar `w-full lg:w-[400px]`, Dialog `max-h-[90dvh]`, StatusBar simplificado, Header search colapsable, tablas responsive.
- **Sprint actual:** Sprint 42 completado — hardening de grabaciones cifradas: descargas remotas de blobs ahora auditan operación `read` sobre `video_grabacion`, `auditLog` expone metadatos testeables y acepta params Express seguros, y `telemedicinaRoutes.test.ts` cubre auth+tenant global, endpoints de grabaciones, raw binary upload y auditoría create/read/delete. Siguiente slice recomendado: retención legal de grabaciones + configuración TURN productiva + E2E multi-peer en navegador real.

### 0.3 Qué hacer primero cuando leas esto

1. **Lee §3 (módulos), §6 (arquitectura), §11 (convenciones), §13 (ADRs), §14 (feedback)** — son las 5 secciones que te dan el contexto mínimo.
2. **Verifica el estado real** con:
   ```bash
   git log --oneline -10
   npm run typecheck && npm run lint && npm test
   ```
   Si pasa, el código está al día. Si falla, hay regresión — revisa commits no commiteados o cambios pendientes.
3. **Mira `docs/decisions/`** — actualmente vacío, pero ahí deberían ir las ADRs formales (este spec.md es la narrativa; los ADRs son los commits-con-justificación).
4. **Mira `src/features/`** — placeholders vacíos: `adherence`, `agenda`, `documents`, `goals`, `recipes`, `reports`, `patient-portal`, `security`, `configuration`. **`smae`**, **`dashboard`**, **`auth`**, **`consultation`**, **`laboratory`**, **`anthropometry`**, **`patients`**, **`meal-plan`** ya tienen implementación. **Mira `src/services/`** — `audit/`, `backup/`, `crypto/`, `importer/`, `pdf/`, `sync/` ya implementados; `api/` implementado en `apps/api/` (servidor Express); `ai/` y `queue/` (vacío) son los únicos placeholders restantes.
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
npm test             # tests existentes, 0 fallidos
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
- No incluye telemedicina, prescripción ni comunicación con aseguradoras. (Facturación básica implementada en Sprint 14D.)
- No hace OCR de resultados de laboratorio en la v1.
- No integra con básculas, baumanómetros o wearables en la v1.

### 1.4 Plataforma objetivo

- **OS:** Windows 10/11 (primary), macOS 12+, Linux (AppImage).
- **Runtime:** Tauri 2.11 + WebView2 / WKWebView / WebKitGTK.
- **Almacenamiento:** IndexedDB (Dexie 4) ahora; SQLite vía `tauri-plugin-sql` cuando se estabilice la build nativa.

### 1.5 Principios arquitectónicos (no negociables)

Estos 6 principios son la constitución del sistema. Cualquier desviación requiere ADR formal.

| # | Principio | Cómo se aplica en este codebase |
|---|-----------|---------------------------------|
| 1 | **Offline-First** | El cliente es la fuente primaria; el servidor (Fase 3) es secundario. La app debe ser 100% usable sin red. |
| 2 | **Determinismo Nutricional** | Todo cálculo (BMI, BMR, TDEE, macros, equivalentes SMAE) es **función pura** sobre datos. Mismo input → mismo output, siempre. Verificable con tests. |
| 3 | **Motor Experto Local** | Las reglas críticas viven en `src/modules/clinical-engine/` (Fase 3) y se ejecutan en cliente. La IA solo sugiere; las reglas deciden. |
| 4 | **Modularidad (hexagonal estricta)** | `src/modules/*/domain/` no puede importar de `react`, `tauri`, `dexie` ni de la UI. Toda interacción con el exterior pasa por **puertos** (interfaces en `domain/repository.ts`). |
| 5 | **Auditoría clínica** | Cada escritura en `consultations`, `anthropometries`, `meal_plans` genera `audit_event` con `previous_value_hash` y `new_value_hash`. Retención mínima 5 años (NOM-024). |
| 6 | **Local-First Data** | Los datos viven en IndexedDB/SQLite local; la sincronización (Fase 3) es **réplica opcional**, no fuente primaria. |

> **Regla derivada:** si un cálculo puede hacerse con una regla determinista, **se hace con regla**. La IA (Fase 4) solo entra cuando el output es texto libre, ambigüedad interpretativa o generación creativa. Ver §19.4 para tabla comparativa.

### 1.6 Despliegue objetivo (3 modos de operación)

| Modo | Fase | Descripción | Estado |
|------|------|-------------|--------|
| **Escritorio standalone** | 1 (✅ MVP) | Instalador Windows/Mac/Linux para consultorio individual. Datos locales en IndexedDB. Backup manual. | ✅ Actual |
| **Servidor LAN consultorio** | 2+ | Servidor local en LAN del consultorio con PostgreSQL + Tauri apps como clientes. Multi-puesto (≤10). | ⏳ Planificado |
| **PWA espejo** | 5 | Web progresiva como espejo de consulta remota (no sustituye escritorio). Solo lectura + anotaciones rápidas. | 🔄 Parcial (portal + offline cache) |

> El **escritorio es el producto principal**. La PWA es un complemento para situaciones donde el nutriólogo no puede llevar su laptop (ej. visita domiciliaria).

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
├── clinical-engine/      ✓ completo (Sprint 13 — ClinicalSuggestionEngine)
├── clinical-record/      ✓ completo (Sprint 13)
├── consultation/         ✓ completo (Sprint 5, T2)
├── laboratory/           ✓ completo (Sprint 4, T4)
├── mealplan/             ✓ completo (Sprint 6)
├── patient/              ✓ completo (Sprint 1)
├── smae/                 ✓ completo (Sprint 9 — catálogo con búsqueda y CRUD)
└── sync/                 ✓ completo (Sprint 14 — useSyncActions)
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

### 3.6 `smae` (Sprint 9 ✅) — Catálogo SMAE navegable

**✅ Implementado en Sprint 9** (commit `effd43a` → `8b61a2d`) + Sprint 10 (FoodPicker con búsqueda por equivalencia inversa).

**Contenido:**
- **Domain** (`src/modules/smae/domain/`): `Food.ts` (entity), `FoodGroup.ts` (enum 16 grupos), `FoodRepository.ts` (interface), `SYSTEM_FOODS.ts` (30+ alimentos canónicos hardcoded), 4 use cases (`searchFoods`, `findByEquivalencia`, `addCustomFood`, `updateCustomFood`, `removeCustomFood`).
- **Infrastructure** (`src/modules/smae/infrastructure/`): `DexieFoodRepository.ts`, `smaeMapper.ts`, tabla `smae_custom_foods` (Dexie v3) para alimentos personalizados del consultorio con `keywords_json`.
- **Application** (`src/modules/smae/application/`): Zod schemas (`smaeFormSchema`), 5 use cases puros, `parseKeywordsInput` (CSV → `string[]`).
- **UI** (`src/modules/smae/ui/`): `SmaeCatalogPage` con TanStack Table + filtros; `SmaeFoodForm` (dialog alta/edición); `useSmaeHooks` (CRUD + búsqueda debounced 200ms).
- **Service** (`src/services/smaeService.ts`): composition root con `DexieFoodRepository`.
- **Ruta**: `/smae` añadida en `app/router.tsx`.

**Modelo simplificado actual vs plan canónico:** este codebase implementa 2 entidades (`Food`, `FoodGroup`) con valores nutricionales inline, en lugar de las 6 entidades del plan canónico (`SmaeVersion`, `SmaeGroup`, `SmaeSubgroup`, `Food`, `Equivalent`, `NutritionalValue`). El motivo es que el SMAE 5ª oficial se trata como **dato embebido hardcoded** (no se importa desde CSV en esta versión), simplificando el modelo a 30+ alimentos curados. La migración al modelo de 6 entidades se hará cuando se implemente el importador CSV (Sprint 12). Ver §21.2 para el modelo canónico SQL y §4.4 para el mapeo conceptual.

### 3.7 `clinical-engine` (Sprint 13 ✅) — Motor de reglas

**Implementado:** `ClinicalSuggestionEngine.suggestDiagnoses()` y `suggestMealPlanTargets()`.

**Sugerencias diagnósticas** (basadas en IMC, glucosa/HbA1c, HOMA-IR, perfil lipídico, creatinina/eGFR, enzimas hepáticas, TSH, PA, relación cintura-cadera):
- Bajo peso, Sobrepeso, Obesidad Grado I/II/III
- Prediabetes, Diabetes tipo 2, resistencia a la insulina
- Hipercolesterolemia, Hipertrigliceridemia, Dislipidemia mixta, HDL bajo, LDL elevado
- Enfermedad renal crónica (G3a / G3b o peor)
- Hígado graso no alcohólico (sospecha)
- Anemia, alteración tiroidea
- Hipertensión arterial, riesgo cardiometabólico (RCC elevada)

**Targets de plan base:** calcula BMR (Mifflin-St Jeor), TDEE, déficit/superávit/mantenimiento según IMC, distribución de macros (carbs/protein/fat).

### 3.8 `meal-planner` (Fase 2, pendiente) — Planificador avanzado

**Pendiente (post-Sprint 14):** ~~distribución automática de macros por tiempo de comida con restricciones (vegetariano, vegano, renal, diabético), lista de compras automática, versionado de planes, comparativos entre planes.~~ ✅ **Implementado Sprint 15.** El MVP de plan alimentario (Sprint 6) + drag&drop (Sprint 10) está implementado en `src/modules/mealplan/`. Expansión Fase 2: `planGenerator.ts` (skeleton automático + ranking engine + generación de plan desde targets), `useUndoRedo` hook, distribución por restricción, plan semanal multi-día, lista de compras automática.

**Entidades objetivo (ver §21.2):** `meal_plans`, `menus`, `menu_times`, `menu_items`, `shopping_lists`.

### 3.9 `recipes` (Fase 2) — Recetario profesional

✅ **Implementado.** Recetario con versionamiento (currentVersion), escalamiento de porciones (scale), categorización (entrada/plato fuerte/postre/bebida/snack), dificultad, alérgenos, costos opcionales.

**UI implementada:**
- RecipesPage con lista de cards + búsqueda + botón "Nueva receta".
- RecipeDialog (wizard 3 pasos): datos básicos → ingredientes → preparación.
- RecipeCard con visualización compacta.

**Pendiente futuro:**
- Autocomplete SMAE para ingredientes.
- Cálculo nutricional automático (desde ingredientes SMAE).
- Etiquetado automático de alérgenos.
- Fotos en pasos de preparación.
- Vista previa de la receta con formato imprimible.
- Versionado: cada cambio genera nueva versión borrador; la versión activa es la publicada.

**Entidades objetivo:** `recipes`, `recipe_ingredients`, `recipe_steps`.

### 3.10 `agenda` (Sprint 15 ✅) — Agenda y gestión de citas

**Implementado:** agenda multi-vista (día/semana/mes con react-day-picker), reagendado, cancelaciones con motivo, no-asistencia automática, slots disponibles, vista de día con cards, diálogo de nueva cita con validación Zod.

**Dominio:** `Appointment`, `Schedule`, `Block` — entities con VOs, ciclo de vida completo (scheduled → confirmed → in_progress → completed / cancelled / no_show / rescheduled).

**Use cases:** `createAppointmentUC`, `cancelAppointmentUC`, `rescheduleAppointmentUC`, `markNoShowUC`, `confirmAppointmentUC`, `completeAppointmentUC`, `getAvailableSlotsUC`.

**UI:** `AgendaPage` con calendario mensual, lista de citas del día seleccionado, `AppointmentDialog` para crear citas, `AppointmentCard` para visualizar.

**Reglas de negocio clave (del plan §40.5):**
- **RN-AGE-01**: cita solo dentro del horario del profesional.
- **RN-AGE-02**: no dos citas del mismo profesional en el mismo horario.
- **RN-AGE-04**: cancelaciones requieren motivo.
- **RN-AGE-05**: reagendado conserva historial.
- **RN-AGE-06**: no asistencia se marca automáticamente a X minutos después de la hora.
- **RN-AGE-09**: citas de primera vez tienen duración más larga.
- **RN-AGE-12**: el sistema NO envía SMS/correos sin acción explícita de la nutrióloga.

**Entidades objetivo:** `appointments`, `schedules`, `blocks`, `reminders`.

### 3.11 `documents` (Fase 2, planificado) — Generación de documentos profesionales

**Pendiente:** plantillas (receta, plan de alimentación, lista de compras, consentimiento, derivación, reporte), firma digital (SHA-256), exportación PDF + HTML + Excel, integración con wizard desde cualquier módulo.

**UI objetivo:** botón "📄 Generar documento" en cualquier módulo → modal/drawer con plantillas filtradas por contexto → vista previa en vivo → personalización → selección de versión → preview final → firmar → descargar/enviar/imprimir → registro automático en bitácora.

**Entidades objetivo:** `documents`, `document_templates`, `document_signatures`.

### 3.12 `adherence` (Fase 2, planificado) — Adherencia al tratamiento

**Pendiente:** registro de adherencia (dieta, agua, actividad, suplementos, sueño), cálculo de índices (0-100%), barreras y facilitadores, tendencias temporales, alertas de desviación sostenida.

**Entidades objetivo:** `adherence_records` con métricas separadas (`menu_adherence_pct`, `water_adherence_pct`, `activity_adherence_pct`, `supplement_adherence_pct`, `sleep_adherence_pct`) + scoring cualitativo (hunger, satiety, mood, energy 1-10).

### 3.13 `goals` (Fase 2, planificado) — Objetivos clínicos con evaluación

**Pendiente:** definición de objetivos (weight_loss, weight_gain, muscle_gain, glycemic, lipid, etc.), criterios de éxito, evaluación automática en cada consulta, proyección de fecha de logro, alertas de estancamiento, cierre por cumplimiento/no cumplimiento.

**Entidades objetivo:** `goals`, `goal_evaluations`. Cálculo de `monthly_rate`, `projected_date`, `progress_pct`, `alert`.

### 3.14 `reports` (Fase 3, planificado) — Dashboard y reportes del consultorio

**Pendiente:** KPIs del consultorio (consultas/semana, adherencia promedio, distribución de patologías), reportes operativos y financieros, comparativos entre periodos, exportación a instancias regulatorias (COFEPRIS, Secretaría de Salud), modo kiosko para sala de espera.

**Entidades objetivo:** `indicators`, `indicator_values`, `generated_reports`, `dashboard_configs`, `widgets`, `meta_kpis`, `anomaly_detections`.

### 3.15 `economic` (Fase 3, planificado) — Módulo económico

**Pendiente:** gestión de cobros, pagos, facturación, costos de consulta, presupuestos por paciente, comparativos de planes, reportes financieros.

### 3.16 `medications` (Fase 3, planificado) — Catálogo de medicamentos e interacciones

**Pendiente:** catálogo de medicamentos, registro por paciente, alertas de interacciones fármaco-nutriente (ej. warfarina + vitamina K), recordatorios de toma.

### 3.17 `security` (Fase 3, planificado) — Seguridad, privacidad y cumplimiento

**Implementado (Sprints 36-42):** 2FA TOTP con `otplib` + QR usando `qrcode`, flujo login en 2 pasos (`requires2fa` + `pending2faToken`), endpoints `/auth/2fa/*`, cifrado AES-256-GCM server-side con `serverCryptoService.ts`, telemedicina con CRUD de salas (`016-telemedicina.sql`), UI de 2FA/videollamada, signaling WebRTC por WebSocket, configuración STUN/TURN, grabación local con consentimiento explícito y gestor completo de grabaciones cifradas. Sprint 41 agregó `017-telemedicina-grabaciones.sql`, tabla `video_grabaciones`, endpoints `GET/POST/GET blob/DELETE /telemedicina/:id/grabaciones/*`, subida cifrada opcional al backend, soft-delete remoto y descarga de blobs cifrados. Sprint 42 agregó auditoría `read` para descarga de blob remoto y tests estructurales de rutas para auth/tenant, raw binary upload y auditoría create/read/delete. **Pendiente:** retención legal, TURN productivo y E2E multi-peer real.

**Ver §9 para lo implementado y §21.6 para el modelo de auditoría completo.**

### 3.18 `patient-portal` (Fase 5, ~90% en progreso) — Portal del paciente (PWA)

**Implementado (Sprints 25A-35):** portal web público en `/portal/:token`, respaldado por `GET /patient-portal/:token`, para que el paciente vea resumen, plan activo, próximas citas y documentos compartidos. Con scope `adherence`, el paciente puede enviar adherencia por `POST /patient-portal/:token/adherence`; si falla la red, el registro se guarda en cola local y se reintenta al volver la conexión. El portal incluye descarga/vista previa documental firmada SHA-256, recordatorio de próxima cita por email (`POST /patient-portal/:token/send-reminder`) e historial de notificaciones (`GET /patient-portal/:token/notifications`) con cache local. Sprint 30 añadió `manifest.webmanifest`, Service Worker de app shell, cache local del payload público/notificaciones y banner de datos guardados sin cachear respuestas API/documentos en el SW. Sprint 31 añadió mensajería asíncrona paciente-nutrióloga con `patient_portal_messages`, endpoints `GET/POST /patient-portal/:token/messages` con scope `messaging`, endpoints profesionales y notificación email al profesional. Sprint 32 añadió fotos de comidas con `patient_portal_meal_photos`, subida pública `POST /patient-portal/:token/meal-photos`, listado/preview por token, revisión profesional y storage de bytes en SQL Server con SHA-256. Sprint 33 endureció backend, cliente y E2E para scopes, validación de fotos, orden de rutas, envío de mensajes y subida/listado de fotos en portal. Sprint 34 formalizó multi-consultorio usando `sucursal_id` como tenant key, tenant guards para FKs clínicas y `/sync/push` protegido por sucursal activa. En el expediente profesional se gestionan enlaces, auditoría reciente, adherencia, mensajería, fotos de comidas y preferencias de alimentos/sustituciones (`patient_substitutions`). Además, el dashboard profesional incluye métricas clínicas agregadas vía `GET /dashboard/metrics` (pacientes, consultas, pagos pendientes, planes, adherencia, sexo y patologías). Sprint 35 limpió 17 warnings de lint, implementó audit middleware NOM-024 para bitácora automática de operaciones clínicas + login, migración `013-consentimientos.sql` + API CRUD de consentimientos, y endpoint `GET /pacientes/:id/expediente` para exportación estructurada. **Pendiente:** certificación NOM-024 formal, telemedicina, wearables/OCR opcionales.

### 3.19 `ai-assist` (Fase 4, planificado) — Sistema de IA

**Pendiente:** 8 capabilities documentadas en §19 (summarizeConsultation, interpretLabResults, suggestSubstitutions, generateEducationContent, draftClinicalNotes, generateGoalSuggestions, explainDiagnosisToPatient, generateMealPlanInitial). Bounded context dedicado en `src/services/ai/`. Opt-in por profesional + consentimiento explícito por paciente.

### 3.20 Mapa de fases (resumen)

| Fase | Módulos a implementar | Estado |
|------|----------------------|--------|
| **Fase 1 — MVP foundations** | patient, anthropometry, laboratory, consultation, mealplan, dashboard | ✅ Completa (Sprints 1-7) |
| **Fase 2 — Clinical expansion** | smae, importer, pdf, backup, crypto, agenda, recipes, goals, adherence, documents, meal-planner, planGenerator, anthropometry (BIA + trend), lab (nutritionalAlerts) | ✅ Completa (Sprint 15) |
| **Fase 3 — Engine, sync, security** | clinical-engine ✅, sync ✅, billing/economic ✅, audit ✅, api/servidor ✅, crypto ✅, queue ✅, medications ✅, security ✅, reports ✅ | ✅ Completa (Sprint 15) |
| **Fase 4 — Multi-platform, IA** | dark mode, ai-assist, i18n, accesibilidad WCAG AA, portabilidad móvil | ✅ Completa (Sprint 24) |
| **Fase 5 — Portal paciente** | patient-portal, multi-consultorio, certificaciones (NOM-024), telemedicina | 🔄 ~99% (Sprint 42: auditoría/tests de grabaciones cifradas) |

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
| `ai/` | ⏳ planificado | asistente IA local, sugerencias, redacción SOAP (Fase 4) |
| `api/` | ✓ Sprint 14 | cliente HTTP para sync Fase 3 (servidor en `apps/api/`) |
| `audit/` | ✓ Sprint 14 | log inmutable de acciones clínicas (domain + DexieAuditEventRepository) |
| `backup/` | ✓ Sprint 11 | export/import JSON cifrado (PBKDF2 600k + AES-GCM 256) |
| `crypto/` | ✓ Sprint 11 | cifrado en reposo (Web Crypto PBKDF2 + AES-GCM) |
| `importer/` | ✓ Sprint 10 | importar pacientes desde CSV (RN-IMP-01) |
| `notification/` | ✓ | wrapper de sonner, centraliza toasts |
| `pdf/` | ✓ Sprint 10 | exportar consulta/plan a PDF con jspdf + jspdf-autotable |
| `queue/` | ⏳ planificado | cola de acciones offline-first (Fase 3) |
| `sync/` | ✓ Sprint 14 | sync HTTP bidireccional: pull delta + push batch + backoff + cola Dexie |

### 6.4 Features vs Modules

- **`src/modules/*`** = bounded context de dominio hexagonal puro. Inmutables, sin React.
- **`src/features/*`** = casos de uso cross-module (composición). **Con implementación:** `anthropometry`, `auth`, `consultation`, `dashboard`, `laboratory`, `meal-plan`, `patients`, `smae`. **Placeholders vacíos:** `adherence`, `agenda`, `configuration`, `documents`, `goals`, `patient-portal`, `recipes`, `reports`, `security`.
- **`src/hooks/`** = hooks cross-cutting.
- **`src/store/`** = Zustand stores de UI state.
- **`src/workers/`** = Web Workers (futuro, para cálculos pesados en lab/meal plan).

### 6.5 Estilos arquitectónicos (capas combinadas)

| Estilo | Dónde se aplica | Referencia |
|--------|-----------------|------------|
| **Hexagonal (Ports & Adapters)** | `src/modules/*/domain/` (puertos) + `infrastructure/` (adaptadores) | §6.1 |
| **Clean Architecture** | Separación domain/application/infrastructure/ui en cada módulo | §6.1 |
| **Event-driven** | `EventBus` interno (Fase 3) para notificaciones, sync, audit | §6.6 |
| **CQRS opcional** | Módulos de alto rendimiento (dashboard, reports) con read-model separado | Diferido |
| **Repository** | Acceso a datos abstraído vía interfaces en `domain/repository.ts` | §6.2 |
| **DDD** | Modelado de bounded contexts, entidades, VOs, aggregate roots | §4 |

### 6.6 Topología de componentes (vista lógica)

```
┌─────────────────────────────────────────────────────────────┐
│ CAPA DE PRESENTACIÓN (UI / Tauri Shell)                     │
│ ├─ React 19 + Vite + TypeScript                             │
│ ├─ shadcn/ui (new-york) + Radix UI + TailwindCSS           │
│ ├─ Zustand (estado cliente)                                 │
│ ├─ React Hook Form + Zod (formularios)                      │
│ ├─ TanStack Table (tablas)                                  │
│ ├─ Recharts (gráficas)                                     │
│ ├─ DnD Kit (drag & drop)                                    │
│ ├─ Framer Motion (animaciones)                              │
│ └─ Tauri v2 (host nativo, IPC, OS)                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ CAPA DE APLICACIÓN (orquestación)                           │
│ ├─ Services (casos de uso en `src/modules/*/application/`)  │
│ ├─ Stores globales (Zustand)                                │
│ ├─ Hooks de aplicación                                      │
│ ├─ Workers (sync, queue, notifications — sync implementado) │
│ └─ Command Bus (eventos internos)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ CAPA DE DOMINIO (núcleo puro, sin dependencias de UI)       │
│ ├─ Entidades de dominio (Patient, Consultation, ...)        │
│ ├─ Value Objects (IMC, Macronutriente, Porcion, Vitals)     │
│ ├─ Servicios de dominio (cálculos, reglas)                  │
│ ├─ Repositorios (interfaces, no implementaciones)           │
│ ├─ Motor clínico (reglas, alertas, validaciones — Sprint 13)│
│ ├─ Motor de menús (generador — Fase 2 ya con SMAE)          │
│ ├─ Motor SMAE (cálculo equivalentes)                        │
│ └─ Eventos de dominio                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ CAPA DE INFRAESTRUCTURA (adaptadores)                       │
│ ├─ Dexie / IndexedDB (hoy) o SQLite vía tauri-plugin-sql    │
│ ├─ Tauri API (FS, dialog, notifications)                    │
│ ├─ Adapter de red (HTTP client — Sprint 14, syncApiClient) │
│ ├─ Adapter de IA (LLM opcional — Fase 4)                    │
│ ├─ Logger estructurado                                      │
│ └─ Crypto / hashing (Argon2, AES, SHA-256)                  │
└─────────────────────────────────────────────────────────────┘
```

### 6.7 Flujo de datos

**Lectura:**

```
UI Component
  → (hook / selector) Zustand Store
  → (use case) Service (Application Layer)
  → (domain logic) Domain Service / Entity
  → (repository interface) Repository Implementation
  → (sql query / dexie get) BD local
  → (mapping) Domain Entity
  → (dto mapping) DTO
  → (selector) Store
  → (reactive) UI re-render
```

**Escritura:**

```
UI Form (RHF + Zod)
  → (submit) Service
  → (validate + business rules) Domain Service
  → (persist) Repository → Dexie/SQLite
  → (publish event) Event Bus
    → (subscribers)
      ├─ Sync Queue (Fase 3, para replicación)
      ├─ Audit Log
      ├─ UI Store (actualización optimista)
      └─ Notifications
```

### 6.8 Decisiones arquitectónicas clave (resumen)

| # | Decisión | Justificación |
|---|----------|---------------|
| ADR-01 | SQLite/IndexedDB ahora, SQLite nativo en Fase 3 | Velocidad, portabilidad, sin servidor, JSON nativo |
| ADR-02 | Zustand sobre Redux | Más simple, mejor performance, sin boilerplate |
| ADR-03 | React Hook Form + Zod | Validación type-safe, mínima re-renderización |
| ADR-04 | Tauri v2 sobre Electron | Binarios pequeños, mejor seguridad, mejor performance |
| ADR-05 | Snapshots inmutables por consulta | Auditabilidad clínica, recuperación, comparativos |
| ADR-06 | Event sourcing parcial para auditoría | Bitácora append-only, trazabilidad completa |
| ADR-07 | IndexedDB para cola offline | Async, no bloquea UI, mayor capacidad que localStorage |
| ADR-08 | Domain layer sin TypeScript DOM types | Pureza del dominio, portabilidad, testing sin browser |
| ADR-09 | Repositorios con interfaces | Inversión de dependencias, mockeable, testeable |
| ADR-10 | Code splitting por módulo | Carga inicial <2s, lazy loading de features |

> Las decisiones se documentan formalmente en `docs/decisions/` (Q-01, sprint futuro).

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
| `/smae` | Catálogo SMAE navegable | ✓ Sprint 9 (SmaeCatalogPage) |
| `/notificaciones` | Historial de toasts | ✓ |
| `/perfil` | Perfil del nutriólogo | ✓ |
| `/configuracion` | Settings | ✓ |
| `/ayuda` | Ayuda | ✓ |
| `/billing` | Facturación | ✓ Sprint 14D (BillingPage) |
| `/billing/report` | Reporte de facturación | ✓ Sprint 14D (BillingReportPage) |
| `/billing/:consultationId/receipt` | Recibo de consulta | ✓ Sprint 14D (ReceiptPage) |
| `/importar` | Importar pacientes CSV | ✓ Sprint 10 (ImporterPage) |

### 8.5 Principios UX (10 guías de diseño)

Estos principios guían cada decisión de UI. Inspiración: Linear, Raycast, Stripe, Arc, Attio, Figma.

| # | Principio | Definición | Aplicación concreta |
|---|-----------|------------|---------------------|
| 1 | **Densidad sin caos** | Mostrar mucha información útil sin saturar | Tablas con columnas visibles esenciales + panel lateral de detalle |
| 2 | **Captura ultrarrápida** | Reducir clics, autocompletar, atajos | Wizard SOAP de 6 pasos con atajos `Tab`/`Shift+Tab`; command palette global |
| 3 | **Recalculación en vivo** | Cada cambio se refleja al instante | SlotProgress muestra delta de kcal al arrastrar alimento; KPI cards recalculan al cambiar inputs |
| 4 | **Estados siempre visibles** | El sistema nunca oculta información crítica | Badges de alerta (HbA1c alta, K+ alterado) siempre visibles en panel derecho de consulta |
| 5 | **Cero ambigüedad clínica** | Lenguaje profesional, sin jerga innecesaria | Etiquetas usan nomenclatura médica estándar (HbA1c, no "azúcar en sangre") |
| 6 | **Errores que enseñan** | Mensajes accionables, no punitivos | "El peso debe ser > 0 y < 500 kg" en vez de "Valor inválido" |
| 7 | **Recuperación fácil** | Toda acción destructiva es reversible (undo) | Soft delete con papelera; undo de edición reciente vía `Ctrl+Z` |
| 8 | **Accesibilidad por defecto** | WCAG 2.1 AA desde el diseño | Roles ARIA, navegación por teclado, contraste mínimo 4.5:1, foco visible |
| 9 | **Performance como feature** | Latencia < 100 ms en interacciones | Code splitting, memoización selectiva, Dexie transaccional |
| 10 | **Respeto al contexto** | El sistema aprende el flujo del profesional | Última consulta del paciente se re-abre automáticamente; templates pre-llenados |

### 8.6 Principios visuales (7 guías estéticas)

- **Minimalismo tipográfico**: una sola familia principal (`Inter`) + una mono para datos numéricos (`JetBrains Mono`).
- **Color con propósito**: el color comunica estado (alerta, éxito, info), no decora.
- **Espacio en blanco como lujo**: la app se siente premium por lo que no tiene.
- **Profundidad sutil**: sombras leves (`shadow-sm`, `shadow-md`), separadores de 1px, capas visibles pero no invasivas.
- **Consistencia absoluta**: mismo botón en todos lados, mismo patrón de modal, mismo card.
- **Iconografía geométrica**: trazos de 1.5px (Lucide), esquinas redondeadas suaves, metáforas claras.
- **Datos hero**: las cifras y gráficas son protagonistas, no el chrome.

### 8.7 Design system: tokens de color

#### Light mode

**Neutrales (grises):**

| Token | Valor | Uso |
|-------|-------|-----|
| `neutral-0` | `#FFFFFF` | Fondo puro |
| `neutral-50` | `#FAFAFA` | Canvas |
| `neutral-100` | `#F4F4F5` | Surface muted |
| `neutral-200` | `#E4E4E7` | Borders |
| `neutral-300` | `#D4D4D8` | Borders strong |
| `neutral-400` | `#A1A1AA` | Text disabled |
| `neutral-500` | `#71717A` | Text tertiary |
| `neutral-600` | `#52525B` | Text secondary |
| `neutral-700` | `#3F3F46` | Text primary |
| `neutral-800` | `#27272A` | Headings |
| `neutral-900` | `#18181B` | Strong |
| `neutral-1000` | `#09090B` | Maximum contrast |

**Semánticos (estado clínico y de UI):**

| Token | 50 | 500 | 700 |
|-------|----|----|-----|
| `success` | `#F0FDF4` | `#22C55E` | `#15803D` |
| `warning` | `#FFFBEB` | `#F59E0B` | `#B45309` |
| `danger` | `#FEF2F2` | `#EF4444` | `#B91C1C` |
| `info` | `#EFF6FF` | `#3B82F6` | `#1D4ED8` |

**Paleta clínica (referencia para badges y grupos SMAE):**

| Token | Uso |
|-------|-----|
| `clinic-verde` | Verduras SMAE, rangos normales |
| `clinic-azul` | Información, frutas SMAE |
| `clinic-amarillo` | Advertencia leve |
| `clinic-naranja` | Advertencia moderada |
| `clinic-rojo` | Crítico, valor fuera de rango |
| `clinic-violeta` | AOA (aceites y grasas) |
| `clinic-rosa` | Recetas, contenido educativo |
| `clinic-teal` | Cereales, hidratación |

**Identificación visual de grupos SMAE:**

| Grupo | Color |
|-------|-------|
| Verduras | Verde |
| Frutas | Azul |
| Cereales s/g | Amarillo |
| Cereales c/g | Naranja |
| Leguminosas | Rojo |
| AOA muy bajo | Verde claro |
| AOA moderado | Amarillo |
| AOA alto | Rojo |
| Leche descremada | Azul claro |
| Leche entera | Blanco |
| Leche con azúcar | Rosa |
| Aceites y grasas | Violeta |
| Azúcares | Rosa fuerte |
| Alimentos libres | Gris |

**Superficie y elevación:**

| Token | Light |
|-------|-------|
| `bg-canvas` | `#FAFAFA` |
| `bg-surface` | `#FFFFFF` |
| `bg-elevated` | `#FFFFFF` |
| `bg-muted` | `#F4F4F5` |
| `bg-subtle` | `#FAFAFA` |
| `bg-overlay` | `rgba(0,0,0,0.5)` |

#### Dark mode (target Fase 4)

**Primary invertido:** `primary-300 #93B5FF`, `primary-500 #4F7CFF` (principal dark).
**Neutrales invertidos:** `neutral-0 #09090B`, `neutral-1000 #FFFFFF`.
**Surface dark:** `bg-canvas #09090B`, `bg-surface #18181B`, `bg-elevated #27272A`.

> **Estado actual:** light mode operativo, dark mode pendiente (Fase 4). Tailwind config ya preparado con prefijo `dark:` para migración futura.

### 8.8 Componentes compuestos (3 pilares)

#### 8.8.1 Data Grid (tablas con esteroides)

Todo lo de TanStack Table, más:

- Edición inline por celda (doble clic o `F2`).
- Reordenamiento de filas con drag handle.
- Filtros avanzados por columna (rango, contains, equals, before/after).
- Vista de tarjetas alternativa (responsive).
- Agrupación por columna (drag header al área de agrupación).
- Pivoteo (vista de tabla cruzada).
- Exportación a CSV, Excel, PDF.
- Estado guardado de filtros, orden, vista (persiste entre sesiones).
- **Virtualización** para >1000 filas (TanStack Virtual).
- Selección múltiple con `Shift` y `Cmd/Ctrl`.
- Acciones en lote en toolbar flotante.
- Fila expandible para ver detalles sin salir de la tabla.

#### 8.8.2 Charts (gráficas con Recharts)

**Tipos soportados:** línea, barra, área, circular/donut, radar, scatter, heatmap, gauge, bullet, sparkline.

**Estilos:**
- Paleta consistente con el design system.
- Ejes con gridlines sutiles (`stroke-neutral-200`).
- Tooltip oscuro con sombra, alineado al cursor.
- Leyenda interactiva (clic para ocultar serie).
- Zoom con brush (selección de rango).
- Anotaciones (líneas verticales en eventos clave).
- Etiquetas en datos solo si es legible.
- Animación de entrada (300ms) con stagger.

**Interactividad:**
- Hover: tooltip + highlight de la serie.
- Click en punto: detalle de la medición.
- Brush: zoom a rango.
- Descarga como PNG.
- Pantalla completa.

#### 8.8.3 Dialogs (modales)

**Tipos:**
- **Confirmación**: Sí/No, destructiva (con doble confirmación para acciones irreversibles).
- **Formulario**: captura compleja (wizard de 3+ pasos).
- **Información**: solo lectura, cierre con OK.
- **Wizard**: pasos numerados con progress bar.
- **Crítico**: alertas bloqueantes que requieren atención.

**Convenciones:**
- Anchura máxima 600px (formularios), 400px (confirmación), 800px (wizard).
- Cerrar con `Esc` o clic fuera (excepto críticos).
- Focus trap automático (Radix).
- Restaurar foco al elemento que abrió el dialog.

### 8.9 Layout consulta clínica (3 paneles)

Referencia de la vista principal de consulta:

```
┌──┬──────────────────────────────────────────────────────────────────────┐
│  │ ← Paciente María Gómez López · Consulta #8 · 03 Jun 2026              │
│  │ [Resumen] [Consulta] [Antropometría] [Lab] [Plan] [Notas]            │
│  ├──────────────────────────┬──────────────────────┬────────────────────┤
│  │ CAPTURA                  │ ESTADO CLÍNICO        │ CÁLCULOS           │
│  │                          │                       │                    │
│  │ ▼ Motivo de consulta     │ ┌─Diagnóstico─┐       │ ┌─KPIs────────┐    │
│  │ [Control DM2         ]   │ │ DM2         │       │ │ Peso 72.4   │    │
│  │                          │ │ Sobrepeso   │       │ │ IMC 28.1    │    │
│  │ ▼ Padecimiento actual    │ │ +Dislipidemia│       │ │ %Grasa 32%  │    │
│  │ [HbA1c elevada,      ]   │ └─────────────┘       │ │ MLG 49.2    │    │
│  │ [astenia ocasional.  ]   │                       │ └─────────────┘    │
│  │                          │ ┌─Alertas──────┐       │                    │
│  │ ▼ Antropometría          │ │ ⚠ HbA1c 8.9% │       │ ┌─Gráficas─────┐    │
│  │ Peso     [72.4] kg       │ │ ⚠ K+ 5.4    │       │ │ Peso 📉      │    │
│  │ Talla    [1.61] m        │ └─────────────┘       │ │              │    │
│  │ Cintura  [94  ] cm       │                       │ └─────────────┘    │
│  │ Cadera   [108] cm        │ ┌─Objetivos─────┐       │                    │
│  │                          │ │ HbA1c <7% 67% │       │ ┌─Macros objetivo│  │
│  │ ▼ Bioquímica nueva       │ │ LDL <100  45% │       │ │ P 25% L 30%  │  │
│  │ HbA1c   [8.9] % ⚠        │ └─────────────┘       │ │ C 45% F 25g  │  │
│  │ Glucosa  [165] mg/dL ⚠   │                       │ └────────────────┘  │
│  │ Col.T    [220] mg/dL     │ ┌─Plan activo────┐     │                    │
│  │ HDL     [38  ] mg/dL     │ │ 1800 kcal ·    │     │                    │
│  │ LDL     [140] mg/dL ⚠    │ │ 5 tiempos      │     │                    │
│  │ TG      [210] mg/dL ⚠    │ │ Mediter.       │     │                    │
│  │ Creat   [0.9] mg/dL      │ └─────────────┘     │                    │
│  │                          │                       │                    │
└──┴──────────────────────────┴──────────────────────┴────────────────────┘
```

**Convenciones del layout:**
- **Panel izquierdo (Captura)**: inputs organizados por sección colapsable.
- **Panel central (Estado clínico)**: outputs derivados (diagnósticos, alertas, objetivos, plan).
- **Panel derecho (Cálculos)**: KPIs numéricos y gráficas de tendencia.
- **Anchos sugeridos**: 40% / 30% / 30% (en desktop 1280px+).
- **Responsive**: en tablet (< 1024px) los paneles se apilan verticalmente; KPIs en cards de 2 columnas.

### 8.10 Patrones de vista (6 templates recurrentes)

| Patrón | Uso | Ejemplo en este codebase |
|--------|-----|--------------------------|
| **List + Detail** | Listados con vista de detalle (tabs) | `/pacientes` → `/pacientes/:id` (PatientDetailPage) |
| **Wizard** | Flujos guiados paso a paso | Consulta SOAP (6 pasos), Alta de paciente |
| **Dashboard** | Indicadores agregados | `/` DashboardPage con 4 KPICards |
| **Editor + Preview** | Documentos y recetas | (futuro) Recetario con vista previa en vivo |
| **Calendar** | Agenda y planes | (Fase 2) `/agenda` con vista día/semana/mes |
| **Timeline** | Evolución clínica | (Fase 3) Comparativos entre snapshots de consulta |

### 8.11 Estado actual vs objetivo

✅ **Implementado:** principios UX 1-7 en componentes actuales; design tokens en `tailwind.config.ts`; DataTable con TanStack Table; 4 tipos de Dialog (form, confirm, info, wizard); layout de 3 paneles en consulta SOAP.
⏳ **Pendiente:** dark mode (Fase 4), Data Grid con virtualización (Fase 3), Charts con brush/zoom (Fase 2), Drag handle en filas (Fase 3), WCAG 2.1 AA formal audit (Fase 4).

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
npm test                       # Vitest 985 tests (~113s en Windows)
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

### Fase 2 — Clinical expansion ✅ COMPLETA (Sprints 8-11)

- ✓ `smae` como módulo propio con buscador y equivalencias inversas (feedback #10, Sprint 9)
- ✓ `services/importer/` — importar pacientes desde CSV (Sprint 10)
- ✓ `services/pdf/` — exportar consulta / plan a PDF (Sprint 10)
- ✓ `services/backup/` + `services/crypto/` — backup cifrado local (Sprint 11)
- ✓ Tests E2E formales (Playwright, Sprint 14)
- ✓ Drag & drop en meal plan con @dnd-kit (Sprint 10)
- ✓ Catálogo navegable de alimentos (feedback #10, Sprint 9)
- ✓ Visualización de distribución de tiempos en plan (feedback #9, Sprint 10)

> **Nota:** El roadmap de Fase 2 en §3 incluye además 5 módulos de expansión clínica (meal-planner, recipes, documents, adherence, goals) que quedan pendientes — no estaban en el alcance original del roadmap operativo pero sí en la visión del producto. Agenda ya implementado en Sprint 15.

### Fase 3 — Engine, sync, security ✅ COMPLETA (Sprints 12-14)

- ✓ `clinical-engine` — motor de reglas para sugerir diagnóstico y plan base (Sprint 13, feedbacks #7, #8)
- ✓ Selección de alimentos vía equivalencias inversas (feedback #11, Sprint 10 FoodPicker)
- ✓ No permitir crear plan sin consulta previa (feedback #6, Sprint 12 `MealPlanRequiresConsultationError`)
- ✓ `services/sync/` — sync HTTP bidireccional (Sprint 14: syncEngine, syncEnqueuer, syncApiClient, backoff)
- ✓ `services/queue/` — cola offline-first integrada en syncEnqueuer (Sprint 14)
- ✓ `services/audit/` — log inmutable de acciones clínicas (Sprint 14: AuditEvent, DexieAuditEventRepository)
- ✓ `services/api/` — servidor Express + SQL Server con auth JWT, RBAC, multi-tenancy, CRUD REST (Sprint 14A)
- ✓ `services/crypto/` — cifrado en reposo (Sprint 11)
- ✓ Reglas: HTN, DM2, dislipidemia, ERC — bundles diagnósticos (Sprint 13, ClinicalSuggestionEngine)
- ✓ Integración consulta↔plan: derivar plan base desde consulta (Sprint 13, ClinicalSuggestionEngine.suggestMealPlanTargets)
- ✓ Billing/Facturación — campos de pago en Consultation + UI `/billing` + recibo + reporte (Sprint 14D)
- ✓ Login + RBAC — LoginPage, ConflictResolutionModal, StatusBar sync (Sprint 14)
- ✓ Playwright E2E — auth, billing, pacientes soft-delete (Sprint 14)
- ✓ Lazy loading — code-splitting vía `React.lazy` para todas las páginas pesadas

### Fase 4 — Multi-platform, IA (COMPLETADA ✅)

- ✓ Dark mode — ThemeToggle, CSS vars, 3 temas (Sprint 23)
- ✓ i18n — i18next, es-MX/en-US, ~500+ keys, 22 namespaces (Sprint 23)
- ✓ WCAG AA — focus indicators, form labels, headings, errores, touch targets, responsive (Sprint 24)
- ✓ AI Assist — 6 archivos servicio, 8 capabilities, cache, audit, usage tracking, Dexie v24, UI integration (Sprint 24)
- ✓ Portabilidad móvil — sidebar drawer, responsive layout, tables, dialog scroll (Sprint 24)

### Fase 5 — Patient portal, multi-consultorio, NOM-024 (~95% EN PROGRESO 🔄)

- ✓ Patient-portal read-only MVP (Sprint 25A): token público hasheado/expirable/revocable, `GET /patient-portal/:token`, ruta `/portal/:token`, resumen, plan activo, citas próximas, documentos
- ✓ Gestión profesional de enlaces (Sprint 25B): `GET/POST/PATCH /patient-portal/tokens`, crear/copiar/listar/revocar desde expediente del paciente
- ✓ Auditoría base del portal (Sprint 25C): `patient_portal_audit_events`, espejo en `audit_log`, eventos `created/revoked/accessed`, IP, user-agent e historial reciente en UI profesional
- ✓ Adherencia desde portal (Sprint 25D): `adherence_records`, scope `adherence`, `POST /patient-portal/:token/adherence`, UI pública con scores 0-100 y auditoría `adherence_submitted`
- ✓ Vista profesional de adherencia (Sprint 25E): `GET /patient-portal/adherence?pacienteId=`, `PatientPortalAdherenceCard` integrada en expediente
- ✓ Adherencia como entidad syncable (Sprint 25E): `SYNCABLE_ENTITIES`, `ENTITY_TABLES`, `SERVER_INJECTED_COLUMNS`, `adherenceRecordsMap`, maps syncEngine/syncEnqueuer/syncBootstrap
- ✓ Captura profesional de adherencia desde consulta (Sprint 25E): `adherenceRoutes.ts` (GET/POST/PUT), `PatientAdherencePage`, ruta `/:patientId/adherencia`, reuso de `AdherenceRecordDialog` existente con `source='consulta'`
- ✓ Documentos del portal con descarga/vista previa firmada SHA-256 (Sprint 26): endpoints públicos de documento, links de preview/download y validación de integridad
- ✓ Recordatorios/notificaciones email desde portal (Sprint 27): `notificaciones_email`, `emailService`, SMTP opcional/simulado, `send-reminder`, confirmación de adherencia e historial de notificaciones
- ✓ Sustituciones/preferencias guardadas (Sprint 28): `patient_substitutions`, API profesional, card en expediente, botón de guardar preferencia y aplicación de preferencias en plan
- ✓ Dashboard de métricas de clínica (Sprint 29): `GET /dashboard/metrics`, cards de pacientes nuevos, pagos pendientes, adherencia, actividad clínica, sexo y patologías
- ✓ QA/E2E post-29: cobertura E2E portal email/dashboard visible + unit tests de API clients y `applySubstitutions`
- ✓ Patient-portal PWA/offline cache (Sprint 30): manifest, Service Worker app-shell, fallback a payload/notificaciones cacheados y cola local de adherencia
- ✓ Mensajería asíncrona portal/profesional (Sprint 31): `patient_portal_messages`, endpoints públicos/profesionales, notificación email al profesional y UI tipo chat
- ✓ Fotos de comidas desde portal (Sprint 32): `patient_portal_meal_photos`, upload JPEG/PNG/WebP <=2 MB, preview/listado público y revisión profesional
- ✓ Hardening QA/E2E portal (Sprint 33): tests backend para scopes/rutas/validación de foto, tests cliente API, E2E público para mensajes y fotos, lint sin errores
- ✓ Multi-consultorio formal (Sprint 34): `sucursal_id` como tenant key formal, tenant guards para `paciente_id`/`consulta_id`, `/sync/push` exige sucursal activa y tests de aislamiento
- ✓ Bitácora de auditoría automática (Sprint 35): `auditMiddleware.ts` para operaciones clínicas CRUD + login, escribe en `audit_log` con IP/user-agent/detalles
- ✓ Consentimientos del paciente (Sprint 35): migración `013-consentimientos.sql`, `consentimientoRoutes.ts` con GET/POST/PATCH, aceptar/revocar con IP, integrado en expediente profesional
- ✓ Exportación estructurada de expediente clínico (Sprint 35): `GET /pacientes/:id/expediente` con consultas, antropometría, planes, laboratorios, adherencia, consentimientos, mensajes y fotos
- ✓ 0 warnings de lint (Sprint 35): limpieza de 17 warnings `no-explicit-any`, `react-refresh/only-export-components` y `react-hooks/exhaustive-deps`
- ⏳ Certificación NOM-024 formal, 2FA, cifrado AES-256 en campos sensibles
- ⏳ Telemedicina (videollamada, mensajería)
- ⏳ Integración con básculas/baumanómetros/wearables (BLE)
- ⏳ Importación OCR de resultados de laboratorio
- ⏳ Sincronización en la nube (opcional, cifrada E2E)

---

## 13. Decisiones arquitectónicas (ADRs)

> Las ADRs formales (`docs/decisions/0001-*.md` etc.) están pendientes de escribir. Aquí se listan las decisiones tomadas durante el desarrollo con su justificación.

### ADR-001 — IndexedDB/Dexie local, SQL Server vía sync

**Decisión:** Dexie 4 + IndexedDB como almacenamiento primario local. SQL Server como backend de sync (vía `apps/api/` con Express).

**Contexto:** VS Build Tools no garantizadas en todos los dev environments. SQLite requiere compilar native code. En lugar de migrar a SQLite nativo, se optó por un backend SQL Server con sync bidireccional (Sprint 14), lo que además resuelve multi-tenancy y backup remoto.

**Consecuencia:** Dos adapters de persistencia (Dexie local + SQL Server remoto). Sync engine media entre ambos. Tests corren con `fake-indexeddb` sin cambios.

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
| 6 | No permitir plan sin consulta | ✓ Sprint 12 (`MealPlanRequiresConsultationError`) | `ab0f9f0` |
| 7 | Sistema sugiere diagnóstico | ✓ Sprint 13 (`ClinicalSuggestionEngine.suggestDiagnoses`) | `5275417` |
| 8 | Plan sugerido por sistema | ✓ Sprint 13 (`ClinicalSuggestionEngine.suggestMealPlanTargets`) | `5275417` |
| 9 | Mejor visual distribución de tiempos | ✓ Sprint 10 (SlotProgress + barras kcal + delta) | `6b345e0` |
| 10 | Catálogo SMAE | ✓ Sprint 9 (SmaeCatalogPage, buscador, CRUD) | `8b61a2d` |
| 11 | Seleccionar alimento vía equivalencias SMAE | ✓ Sprint 10 (FoodPicker tab equivalencia inversa) | `d22683f` |

### ✅ Todos los 11 feedbacks resueltos

| Sprint | Contenido | Commits |
|--------|-----------|---------|
| **7.5-8** | T1 (save), T2 (vitales opcionales), T3 (errores Zod), T4 (tooltips lab) | `1e158e6`, `786e9e6` |
| **9** | Catálogo SMAE navegable + equivalencias inversas | `effd43a` → `8b61a2d` |
| **10** | FoodPicker, SlotProgress, drag&drop, importer CSV, PDF | `f114d55`, `6b345e0`, `d22683f`, `e505726` |
| **11** | Backup cifrado local | `e505726` (backup+crypto en mismo commit) |
| **12** | Plan requires consulta | `ab0f9f0` |
| **13** | Clinical engine (diagnósticos + plan base) | `5275417` |
| **14** | Sync, billing, E2E, login | `18fc132` → `a6f28fb`

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

**Fecha de corte:** tras enriquecimiento post-Sprint 10 (espec v3: 91KB → 193KB con detalle funcional de 13 módulos).

| Métrica | Valor |
|---------|-------|
| Módulos | 7 implementados (patient, anthropometry, laboratory, consultation, mealplan, smae, dashboard) + 13 planificados |
| Subcarpetas transversales | 15 (5 services + 10 stubs) |
| Tests totales | 281 (post-Sprint 9-10; 207 antes) |
| Archivos de test | ~30 (estimado) |
| Duración suite | ~30s (estimado) |
| Líneas de código (TS/TSX) | ~17k (estimado, +3k con Sprint 9-10) |
| Build size | ~190 KB gzip (estimado) |
| Dependencias producción | 52 (+2 con @dnd-kit + lucide) |
| Dependencias dev | 30 |
| Commits | 17+ (ver git log) |
| Cobertura de dominio | ~85% (estimado) |
| **Spec.md** | **193.1 KB, 3931 líneas, 35 secciones + 3 apéndices** |
| **Plan de arquitectura referenciado** | 466 KB, 49 documentos (Doc 1, 30-47, 48 UX/UI, 49 Técnica) |

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
pnpm test                      # Vitest
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
| _(commit de Sprint 42)_ | test(api): sprint 42 telemedicina recording audit hardening | 42 | Auditoría read para descarga de blobs cifrados y tests de rutas de grabaciones: auth/tenant, raw upload, audit create/read/delete |
| `82f72ba` | perf(build): split route and startup chunks | Post-41 | Todas las páginas/rutas lazy, DB/sync cargan por `import()` en `App.tsx`; chunk principal Vite baja a 465.18 KB y desaparece el warning >500 KB |
| `3721855` | feat(telemedicina): sprint 41 encrypted recording manager | 41 | Tabla `video_grabaciones`, endpoints de grabaciones cifradas, subida opcional al backend y gestor UI local/remoto |
| `1a6351d` | feat(telemedicina): sprint 40 encrypted recording consent | 40 | Consentimiento explícito, grabaciones locales AES-GCM en IndexedDB y descarga descifrada bajo demanda |
| `eac72d7` | feat(telemedicina): sprint 39 TURN config + call recording | 39 | STUN/TURN configurable, fix signaling/ICE y grabación MediaRecorder |
| `79bc147` | feat: sprint 38 signaling server WebRTC + useWebRTC hook | 38 | WebSocket signaling `/ws/telemedicina`, relay SDP/ICE y hook WebRTC |
| `7c7bb6e` | feat(portal): sprint 37 2FA UI + telemedicina videollamada | 37 | UI 2FA, rutas de telemedicina y sala de videollamada |
| `51cdd82` | feat(api): sprint 36 2FA TOTP + AES-256 + telemedicina | 36 | 2FA backend, AES-256-GCM server-side y CRUD inicial de salas |
| _(working)_ | feat(api): sprint 34 tenant guards multi-consultorio | 34 | `sucursal_id` formal como tenant, guard de FKs clínicas y `/sync/push` aislado por sucursal activa |
| _(working)_ | test(patient-portal): sprint 33 hardening | 33 | Backend/client/E2E para scopes, validación de fotos, orden de rutas, mensajes y fotos en portal |
| `563ec7a` | feat(patient-portal): sprint 32 meal photos | 32 | Fotos de comidas desde portal con revisión profesional y storage SQL Server |
| `a5c60da` | feat(patient-portal): sprint 31 mensajeria asincrona paciente-nutriologa | 31 | Mensajería paciente-nutrióloga con endpoints públicos/profesionales y email al profesional |
| `32853ca` | feat(patient-portal): sprint 30 pwa offline cache | 30 | App shell, cache local del portal/notificaciones y cola offline de adherencia |
| _(working)_ | feat(ai-consent): consentimiento IA en ClinicalRecordCards — `AiConsentCard` con record/revoke + diálogo confirmación | 24 | Consentimiento `ai_opt_in` por paciente via PatientConsentService |
| _(working)_ | feat(ai-ui): integration en ConsultationWizard — draftClinicalNotes (StepPlan) + summarizeConsultation (StepReview) | 24 | AIAssistButton + useAI hook en wizard SOAP |
| _(working)_ | feat(wcag): focus-visible, labels, headings, errores alert, touch targets, responsive columns | 24 | WCAG AA completo |
| _(working)_ | feat(mobile): sidebar drawer, responsive layout p-4/sm:p-6, calendar w-full/lg:w-400 | 24 | Portabilidad móvil completa |
| _(working)_ | feat(ai): infraestructura IA — AIClient, AIPrompts, AIResponseParser, AICapabilities, AIService, useAI, AIAssistButton, Switch, Dexie v24 | 24 | 8 capabilities, cache, audit, usage tracking |
| _(working)_ | feat(i18n): ~100% strings visibles envueltos con `t()` — ConsultationWizard, MealPlanForm, ClinicalRecordCards, billing pages, domain label maps, FoodPicker, DocumentSignDialog, ShoppingListDialog | 23 | ~200+ strings reemplazados. |
| _(working)_ | feat(i18n): infraestructura i18n — i18next + react-i18next, es-MX/en-US, config, LanguageSwitcher, commands | 23 | ~500+ keys en 22 namespaces. |
| _(working)_ | feat(dark-mode): ThemeToggle, CSS vars `.dark`, ThemeProvider, uiStore persist, command palette | 23 | 3 temas (light/dark/system). |
| `a6f28fb` | fix(db): one-time migration repara JSON columns legacy en IndexedDB | 14E | Migración de datos legacy. |
| `dbbf608` | feat(sync): Sprint 14E (B+C) - applyPull convierte JSON columns, regression tests | 14E | Sync engine hardening. |
| `75629a5` | test(e2e): Playwright E2E suite — auth, billing, pacientes soft-delete | 14E | 3 spec files, CI-ready. |
| `7eea339` | feat(consultas): sección de pago + botón "Marcar pagada" | 14D | UI de cobro en detalle consulta. |
| `c8feb77` | feat(facturacion): Sprint 14D (2/2) — UI de pagos, /billing, recibo, reporte | 14D | BillingPage, BillingReportPage, ReceiptPage, rutas con guardia de rol. |
| `6f93f6e` | feat(facturacion): Sprint 14D (1/2) — campos de pago en Consultation + sync | 14D | paymentStatus, paymentMethod, paymentAmount, paidAt en dominio + sync. |
| `738d381` | feat(sync): Sprint 14A.12 — sync end-to-end ES/EN mapping, soft-delete recovery | 14A | SyncEngine completo. |
| `d4a7da6` | feat(api): Sprint 14A.11 — migraciones SQL Server ejecutan contra SQL real | 14A | Migraciones 001-004. |
| `e2db980` | feat(sync): Sprint 14A.10 + login — LoginPage, ConflictResolutionModal, StatusBar | 14A | UI de sync + auth. |
| `75a6fba` | feat(sync): Sprint 14A.9 — SyncEngine cliente: pull delta + push con retry | 14A | SyncEngine, backoff. |
| `6131f37` | feat(sync): Sprint 14A.8 — sync_queue Dexie + enqueuer + HTTP client | 14A | syncEnqueuer, syncApiClient. |
| `e6e5f1f` | feat(api): Sprint 14A.7 — sync API: manifest + pull delta + push batch | 14A | API sync endpoints. |
| `5ba1861` | feat(api): Sprint 14A.6 — mirror domain: CRUD REST pacientes/consultas/etc | 14A | REST API mirror. |
| `6aa4e14` | feat(api): Sprint 14A.5 — multi-tenancy middleware + CRUD Sucursal | 14A | Multi-tenant. |
| `c7b09e0` | feat(api): Sprint 14A.4 — auth JWT + Argon2 + RBAC + /auth/{login,register,me} | 14A | Auth backend. |
| `bbfd61f` | feat(api): Sprint 14A.3 — schema SQL Server completo (4 migraciones) | 14A | DB schema. |
| `18fc132` | feat(api): Sprint 14A.1 — monorepo skeleton + API base | 14A | apps/api/ skeleton. |
| `5275417` | feat(clinical-engine): motor de sugerencias diagnósticas y de plan | 13 | ClinicalSuggestionEngine. |
| `e505726` | feat(importer+pdf): importador CSV pacientes + export PDF consulta | 10b | ImporterPage + servicios. |
| `ab0f9f0` | feat(clinical-record): módulo 31 — expediente clínico completo | 11-13 | ClinicalRecord + backups. |
| `f114d55` | feat(mealplan): drag&drop entre tiempos con @dnd-kit | 10 | DndContext, DroppableMealCard. |
| `6b345e0` | feat(mealplan): SlotProgress con barras de kcal + delta | 10 | Visualización distribución. |
| `d22683f` | feat(mealplan): FoodPicker con tab equivalencia inversa | 10 | Dialog selección alimentos. |
| `8b61a2d` | feat(smae): UI catalog page + form dialog + hooks + service + route | 9 | SmaeCatalogPage, ruta `/smae`. |
| `5a2956d` | feat(smae): application (Zod schemas, use cases puros) | 9 | smaeFormSchema, searchFoodsUC. |
| `3e0766c` | feat(smae): infrastructure (Dexie v3, DexieFoodRepository) | 9 | Tabla smae_custom_foods. |
| `effd43a` | feat(smae): domain layer (Food, FoodGroup, 16 grupos) | 9 | Bounded context SMAE. |
| `dc963b5` | docs(spec): enriquecer spec.md 91KB con handbook, ADRs | 9 | spec.md 6KB → 91KB. |
| `786e9e6` | feat(consultation): signos vitales opcionales + tooltips lab | 8 | T2, T4 feedback. |
| `1e158e6` | fix(consultation): wizard save + memoize patientId refs | 7.5 | T1 + ADR-009. |
| `69fcc35` | fix(hooks): useEffect infinite loop on branded IDs | 7.5 | Bugfix re-render. |
| `993cc04` | feat(dashboard): KPIs reales + CommandPalette → v1 usable | 7 | v1 declarada. |
| `c9687c5` | feat(mealplan): módulo completo planes SMAE 5ª | 6 | MealPlan 5 slots, 40 tests. |
| `eaea155` | feat(consultation): wizard SOAP multi-paso | 5 | 6-step SOAP wizard, 33 tests. |
| `4fb14af` | feat(laboratory): 24 códigos + ref ranges México | 4 | LabPanel con Recharts trend. |
| `4ce0caa` | feat: bootstrap — paciente + antropometría | 1-3 | Base arquitectónica. |

### Feedback v1 → resolución

| # | Issue | Sprint | Tarea | Estado |
|---|-------|--------|-------|--------|
| 1 | Antropometría sí obligatoria, vitales opcional | 8 | T2 | ✓ toggle implementado |
| 2 | Vitales opcionales (no forzar PA) | 8 | T2 | ✓ toggle + Vitals.empty() |
| 3 | Bug botón guardar | 7.5+8 | T1 + ADR-009 | ✓ Zod preprocess + onClick manual |
| 4 | Error Zod genérico | 8 | T3 | ✓ mensajes específicos por campo |
| 5 | Iconos lab sin contexto | 8 | T4 | ✓ Radix Tooltip |
| 6 | No permitir plan sin consulta | - | - | ✓ Sprint 12 (ab0f9f0) |
| 7 | Sistema sugiere diagnóstico | - | - | ✓ Sprint 13 |
| 8 | Plan sugerido por sistema | - | - | ✓ Sprint 13 |
| 9 | Mejor visual tiempos en plan | 9-10 | SlotProgress + barras kcal | ✓ Sprint 10 (`6b345e0`) |
| 10 | Catálogo SMAE | 9 | SmaeCatalogPage | ✓ Sprint 9 (`8b61a2d`) |
| 11 | Equivalencias inversas | 10 | FoodPicker tab | ✓ Sprint 10 (`d22683f`) |

**11/11 resueltos** — todos los feedbacks cerrados.

### Línea de tiempo narrativa

1. **Sprint 1-2:** paciente + antropometría, vertical slice mínimo.
2. **Sprint 3:** design system, layout, providers, router base.
3. **Sprint 4:** laboratorio, cálculos clínicos avanzados (CKD-EPI, HOMA-IR, Friedewald).
4. **Sprint 5:** consulta SOAP wizard, primeros 33 tests de consultation.
5. **Sprint 6:** plan de alimentación con SMAE.
6. **Sprint 7:** integración cross-module, dashboard, command palette, **v1 declarada**.
7. **Sprint 7.5 (post-v1):** bug fix de infinite re-render hooks (`69fcc35`).
8. **Sprint 7.5+:** usuario prueba v1, encuentra 4 bugs críticos (T1-T4).
9. **Sprint 8:** integración de feedback v1. T1 (save), T2 (vitales), T3 (errores Zod), T4 (tooltips).
10. **Sprint 9:** bounded context SMAE con catálogo navegable, equivalencias inversas, CRUD alimentos custom. Spec.md crece a 91KB con handbook completo.
11. **Sprint 10:** UX del meal plan mejorada (FoodPicker, SlotProgress, drag&drop). **281 tests.**
12. **Sprint 10b:** importer CSV de pacientes + export PDF de consulta. **493 tests.**
13. **Sprint 11 (cleanup):** spec sync — backup cifrado e importer ya estaban en commits previos.
14. **Sprint 12 (cleanup):** spec sync — `MealPlanRequiresConsultationError` ya integrado en `ab0f9f0`.
15. **Sprint 13:** motor `clinical-engine` con sugerencias diagnósticas (RN-EXP-11) y plan base (BMR + TDEE + IMC). Cierra feedbacks #7, #8.
16. **Sprint 14A — API server:** monorepo skeleton, SQL Server schema (4 migraciones), auth JWT + Argon2 + RBAC, multi-tenancy, CRUD REST mirror.
17. **Sprint 14A — Sync engine:** sync_queue Dexie, enqueuer, HTTP client, pull delta + push batch con retry+backoff, conflict detection. LoginPage + ConflictResolutionModal + StatusBar wired.
18. **Sprint 14A — Sync end-to-end:** ES/EN mapping, soft-delete recovery, cascade delete, lazy loading.
19. **Sprint 14D — Facturación:** campos de pago en Consultation + UI `/billing` + recibo + reporte + botón "Marcar pagada".
20. **Sprint 14E — Harden:** DB migration legacy JSON columns, E2E Playwright suite (auth, billing, pacientes), sync polish.
21. **Sprint 23 — i18n + dark mode:** i18next (es-MX/en-US, ~500+ keys), ThemeToggle (3 temas), ~200+ strings envueltos.
22. **Sprint 24 — Fase 4 completa:** WCAG AA (focus, labels, headings, touch targets), AI Assist (8 capabilities, cache, audit, usage, Dexie v24, ConsultationWizard integration), portabilidad móvil (sidebar drawer, responsive), consentimiento IA en ClinicalRecordCards.
23. **Sprint 25A — Patient Portal read-only MVP:** migración SQL `006-patient-portal.sql` con tokens SHA-256 expirable/revocable, endpoint público `GET /patient-portal/:token`, cliente `patientPortalApi`, ruta pública `/portal/:token`, UI responsive para resumen/plan/citas/documentos, i18n es-MX/en-US, tests unitarios y E2E público.
24. **Sprint 25B — Gestión profesional de enlaces del portal:** endpoints autenticados `GET/POST/PATCH /patient-portal/tokens`, token claro one-time, `PatientPortalLinksCard` en detalle de paciente, copiar/revocar/listar enlaces, i18n, tests API client/backend utilities.
25. **Sprint 25C — Auditoría NOM-024 del portal:** migración SQL `007-patient-portal-audit.sql` con `patient_portal_audit_events`, bitácora doble en `audit_log`, eventos `created/revoked/accessed` con IP/user-agent/details, historial reciente por enlace en API/UI profesional, fix UUID 8-4-4-4-12 en rutas de enlaces y verificación focused E2E de pacientes.
26. **Sprint 25D — Adherencia desde portal:** migración SQL `008-portal-adherence.sql` con `adherence_records`, scope `adherence` por defecto en enlaces nuevos, endpoint público `POST /patient-portal/:token/adherence`, card pública para scores de plan/agua/actividad/suplementos/sueño y barreras/facilitadores/notas, auditoría `adherence_submitted`, cliente API y E2E público ampliado.
27. **Sprint 25E — Adherencia profesional + sync + captura en consulta:** endpoint profesional `GET /patient-portal/adherence?pacienteId=` autenticado, `PatientPortalAdherenceCard` en `PatientDetailPage` para listar records del portal. `adherence_records` como entidad syncable: registrado en `SYNCABLE_ENTITIES` (shared), `ENTITY_TABLES`/`SERVER_INJECTED_COLUMNS` (syncService), nuevo `adherenceRecordsMap` con 19 columnas (entityColumnMaps). Frontend sync maps actualizados (syncEngine, syncEnqueuer, syncBootstrap). Captura profesional: `adherenceRoutes.ts` (GET/POST/PUT) montado en `server.ts`, `PatientAdherencePage` con `AdherenceRecordDialog` existente + `useAdherenceHooks`, ruta `/:patientId/adherencia` con `ModuleLink` icono `ClipboardCheck` en `PatientDetailPage`. `source='consulta'` por defecto en creación profesional. 6 nuevas claves i18n para card profesional. 100% tests pasando (frontend 969, API 100).
28. **Sprint 26 — Portal documentos firmados:** descarga/vista previa de documentos desde portal con URL pública tokenizada, hash SHA-256 y UI responsive para preview/download.
29. **Sprint 27 — Recordatorios/notificaciones email:** migración `009-email-notifications.sql`, `emailService` con SMTP opcional/simulado, endpoints `send-reminder` y `notifications`, email automático de confirmación de adherencia, variables `.env.example`, UI de recordatorio/historial en portal.
30. **Sprint 28 — Sustituciones guardadas:** migración `010-patient-substitutions.sql`, API profesional `/pacientes/:pacienteId/substitutions`, `patientSubstitutionApi`, card de preferencias en expediente, botón de guardar preferencia en `MealPlanForm`, utilidad `applySubstitutions`.
31. **Sprint 29 — Dashboard de métricas clínicas:** endpoint `GET /dashboard/metrics`, cliente `dashboardApi`, `DashboardPageClinicMetrics`, métricas de pacientes/consultas/pagos/planes/adherencia/sexo/patologías, corrección de checksums de migraciones CRLF/LF.
32. **Sprint QA/E2E post-29:** ampliación de Playwright portal para recordatorio/notificaciones, aserciones dashboard metrics en auth E2E, unit tests de `dashboardApi`, `patientSubstitutionApi`, endpoints portal email y `applySubstitutions`.
33. **Sprint 30 — PWA/offline cache del portal:** `manifest.webmanifest`, Service Worker de app shell, registro production-only, cache local de payload/notificaciones del portal, banner de datos guardados, cola local de adherencia con flush al reconectar, unit tests y E2E de fallback offline.
34. **Sprint 31 — Mensajería paciente-nutrióloga:** tabla `patient_portal_messages`, endpoints públicos/profesionales, `MessagingCard`, `PatientMessagingCard`, scopes `messaging` por defecto y notificación email al profesional.
35. **Sprint 32 — Fotos de comidas:** tabla `patient_portal_meal_photos`, upload JPEG/PNG/WebP <=2 MB, preview/listado público, revisión profesional, storage SQL Server con SHA-256 y constraints de auditoría/email.
36. **Sprint 33 — Hardening QA/E2E del portal:** tests API de scopes/rutas/validación de foto, tests cliente API, E2E público para mensajes y fotos, fix lint de artefactos `dist` y quality gate completo.
37. **Sprint 34 — Multi-consultorio formal:** `tenantGuards` para validar `paciente_id`/`consulta_id` contra `sucursal_id`, POSTs clínicos protegidos contra FKs cross-sucursal, `pullChanges` con detalle scoped, `/sync/push` requiere sucursal activa y body/header consistente. 109 tests API.
38. **Sprint 36 — 2FA + AES-256 + telemedicina backend:** 2FA TOTP backend, QR setup, login en 2 pasos, `serverCryptoService.ts`, migración `016-telemedicina.sql` y CRUD de salas.
39. **Sprint 37 — UI 2FA + videollamada:** login con TOTP, página `/seguridad/2fa`, rutas `/telemedicina/*` y `VideoCallRoom` con cámara/micrófono/toggles/colgar.
40. **Sprint 38 — WebRTC signaling:** servidor WebSocket `/ws/telemedicina?token=`, relay `join-room/offer/answer/ice-candidate`, `useWebRTC` con `RTCPeerConnection` y STUN.
41. **Sprint 39 — TURN + grabación:** STUN/TURN configurable con variables Vite, fixes de signaling/ICE y `useCallRecording` con MediaRecorder.
42. **Sprint 40 — Consentimiento + cifrado local:** consentimiento explícito antes de grabar, AES-GCM local por usuario, tabla IndexedDB `telemedicina_recordings` y descarga descifrada bajo demanda.
43. **Sprint 41 — Gestor de grabaciones cifradas:** migración `017-telemedicina-grabaciones.sql`, tabla `video_grabaciones`, endpoints backend para listar/subir/descargar blob/eliminar, API cliente binaria, metadatos remotos en IndexedDB y UI para descargar, subir cifrada, eliminar remoto y eliminar local.
44. **Post-Sprint 41 — Optimización de chunks:** todas las páginas y `AppLayout` lazy con `React.lazy`, rutas públicas cubiertas por `Suspense`, y DB/sync cargados con `import()` en `App.tsx`. Build sin warning de chunks >500 KB; chunk principal 465.18 KB minificado.
45. **Sprint 42 — Hardening auditoría/tests de grabaciones:** descarga de blobs remotos auditada como `read` sobre `video_grabacion`, `auditLog` con metadatos testeables y normalización segura de params Express, tests API de rutas de telemedicina para auth/tenant, endpoints, raw upload y auditoría create/read/delete. API tests suben a 114.

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

### Q-03: ¿Cuándo E2E en CI? ✅ Nominal

**Estado:** Playwright config existente, suites en `e2e/` (auth, billing, patient-crud) y `tests/e2e/` (dashboard-smoke, patient-crud). CI job configurado. **Resuelto.**

### Q-04: ¿Cuándo SQLite/Tauri nativo?

**Estado:** Tauri Rust build bloqueado por VS Build Tools. Dexie es storage actual. Sync usa API server (SQL Server) como respaldo, no reemplazo de Dexie.

**Opciones:**
- A) Resolver el blocker primero (instalar Build Tools), luego migrar a SQLite.
- B) Quedarse en Dexie hasta que el volumen de datos lo requiera.
- C) Explorar alternativas: `tauri-plugin-sql` con SQLite precompilado.

**Recomendación:** B. Sync engine ya resuelve el problema de respaldo sin migrar el storage local.

### Q-05: ¿Migrar a React Query (TanStack Query)?

**Estado:** llamadas a repos son síncronas desde la UI. No hay caché, no hay revalidación automática. Sync ya implementado.

**Opciones:**
- A) Quedarse con hooks custom + repos directos (status quo).
- B) Adoptar TanStack Query 5 para `useQuery`/`useMutation` con caché.

**Estado:** status quo se mantiene. Si el sync revela problemas de consistencia, TanStack Query es la siguiente inversión lógica.

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

### 17.1 Resoluciones (2026-06-02)

Todas las preguntas Q-01..Q-07 fueron resueltas en esta sesión. Resumen:

| # | Resolución | Acción / Commit |
|---|-----------|-----------------|
| **Q-01** | **B)** Crear las 10 ADRs completas con plantilla Nygard en `docs/decisions/0001-…0010-*.md` + `README.md` índice. | `b678ed7` docs(adr). 11 archivos, 956 inserciones. |
| **Q-02** | ~~**A)** Monolingüe es-MX.~~ **B) Implementado en Sprint 23:** i18next + react-i18next, es-MX/en-US, ~500+ keys, 22 namespaces. El status quo fue revertido. | Sprint 23 (feat(i18n): infraestructura + wrappers). |
| **Q-03** | **A)** Suite Playwright formal en `tests/e2e/*.spec.ts` + job `e2e` en CI (ubuntu-latest, depends on quality). 9 tests, 1 browser, 1 worker. | `b3a984b` test(e2e). 4 archivos, 204 inserciones. |
| **Q-04** | **B)** Dexie/IndexedDB hasta Fase 3. VS Build Tools y `tauri-plugin-sql` siguen siendo un blocker latente. | Sin commit (status quo, decisión de no-acción). |
| **Q-05** | **A)** Status quo: hooks custom + repos directos. TanStack Query queda pendiente para Fase 3 (cuando haya sync). | Sin commit (status quo). |
| **Q-06** | **A)** Sí, agregar property tests con fast-check para `Vitals`, `Measurements` (Weight, Height, Circumference, Skinfold), y 5 branded IDs (Patient, Consultation, MealPlan, LabPanel, Anthropometry). | `0c03ff1` test(property). 4 archivos, 665 inserciones, 74 nuevos property tests. |
| **Q-07** | **A)** Dejar como están. Decisión del usuario (override de la recomendación original C). Valor histórico en spec §14 sigue siendo la fuente. | Sin commit (status quo). |

**Resultado neto de la sesión:**

- 3 acciones de código ejecutadas: Q-01 (ADRs), Q-03 (E2E), Q-06 (property tests).
- 4 decisiones de status quo: Q-02, Q-04, Q-05, Q-07.
- Bugs latentes descubiertos durante Q-06: el polyfill de `crypto.randomUUID()` en `tests/setup.ts` no producía UUIDv7 (corregido en el commit de Q-06).
- Stats del repo:
  - **Tests**: 281 → 355 (+74 property tests, +9 E2E = +83 totales).
  - **Docs**: 10 ADRs nuevos (38KB).
  - **CI**: nuevo job `e2e` (ubuntu, depends on quality).
  - **spec.md**: sin cambios estructurales en esta sesión; solo este §17.1.

Próximas decisiones pendientes (post-Sprint 14):
- Open question IK-02: idempotencia de saves en IndexedDB (3 entries duplicadas).
- Open question "Fase 4 AI": capabilities y modelo (sin resolver).

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

## 19. Sistema de IA (Fase 4)

### 19.1 Filosofía

| # | Principio | Detalle |
|---|-----------|---------|
| 1 | La IA **asiste, no sustituye** | Toda salida de IA es **sugerencia**, nunca acción directa. |
| 2 | La nutrióloga **siempre aprueba** | El sistema no aplica cambios por sí solo a partir de IA. |
| 3 | La IA **nunca** modifica SMAE ni reglas críticas | El SMAE 5ª y el motor de reglas son read-only para IA. |
| 4 | Toda inferencia queda **trazada** | Cada llamada IA se registra en `audit_events` con prompt sanitizado y respuesta. |

### 19.2 Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│ AI System                                                    │
│                                                              │
│ ┌──────────────────┐   ┌──────────────────┐                 │
│ │ Prompt Builder   │   │ Response Parser  │                 │
│ │ - Context        │   │ - Validate       │                 │
│ │ - Variables      │   │ - Extract data   │                 │
│ │ - Template       │   │ - Confidence     │                 │
│ └────────┬─────────┘   └────────┬─────────┘                 │
│          │                      │                            │
│          └──────────┬───────────┘                            │
│                     ▼                                        │
│         ┌──────────────────────┐                            │
│         │ AI Client            │                            │
│         │ (HTTP / streaming)   │                            │
│         └──────────┬───────────┘                            │
│                     ▼                                        │
│         ┌──────────────────────┐                            │
│         │ AI Provider          │                            │
│         │ (OpenAI / Anthropic / │                            │
│         │  local Ollama)       │                            │
│         └──────────────────────┘                            │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ AI Capabilities (registry)                            │   │
│ │ - summarizeConsultation                               │   │
│ │ - interpretLabResults                                 │   │
│ │ - suggestSubstitutions                                │   │
│ │ - generateEducationContent                            │   │
│ │ - draftClinicalNotes                                  │   │
│ │ - generateGoalSuggestions                             │   │
│ │ - explainDiagnosisToPatient                           │   │
│ │ - generateMealPlanInitial                             │   │
│ └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 19.3 Capacidades

| Capacidad | Entrada | Salida |
|-----------|---------|--------|
| `summarizeConsultation` | Historia, antropometría, labs | Resumen narrativo ≤ 400 palabras |
| `interpretLabResults` | Parámetros de laboratorio | Texto interpretativo + sugerencias de correlación |
| `suggestSubstitutions` | Alimento a sustituir, restricciones del paciente | Lista de equivalentes alternativos (sugeridos, no aplicados) |
| `generateEducationContent` | Tema, nivel del paciente | Material educativo en lenguaje paciente |
| `draftClinicalNotes` | Datos de la consulta | Borrador de nota SOAP para revisión |
| `generateGoalSuggestions` | Perfil del paciente | Propuestas de objetivos (peso, HbA1c, LDL, etc.) |
| `explainDiagnosisToPatient` | Diagnóstico nutricional, perfil | Texto explicativo en lenguaje accesible |
| `generateMealPlanInitial` | Datos básicos del paciente | Menú borrador basado en equivalentes SMAE |

### 19.4 Separación IA vs reglas (decisión arquitectónica crítica)

| Aspecto | Reglas (motor clínico) | IA |
|---------|------------------------|-----|
| Cálculos deterministas (BMI, BMR, TDEE) | ✅ Sí | ❌ No |
| Validaciones críticas (alergia, kcal mínimas) | ✅ Sí | ❌ No |
| Sugerencias nutricionales explícitas | ✅ Sí (motor de reglas) | ✅ Sí (complementario) |
| Generación de texto libre | ❌ No | ✅ Sí |
| Modificar SMAE | ❌ **Nunca** | ❌ **Nunca** |
| Modificar equivalentes | ❌ **Nunca** | ❌ **Nunca** |
| Decisiones clínicas finales | ❌ No (asiste) | ❌ No (asiste) |
| Determinismo | ✅ Total | ❌ Estocástico |
| Trazabilidad | ✅ Total (regla explícita) | ⚠️ Audit log + prompt + response |

> **Regla de oro:** si un cálculo o validación puede hacerse con una regla, **se hace con regla**. La IA solo entra cuando el output es texto libre, ambigüedad interpretativa o generación creativa.

### 19.5 Implementación en este codebase

**Bounded context dedicado** en `src/services/ai/` (placeholder creado en Sprint 1).

```
src/services/ai/
├── AIClient.ts          # interfaz + impl HTTP fetch con streaming
├── AIPrompts.ts         # plantillas versionadas de prompts
├── AIResponseParser.ts  # valida Zod + extrae confidence
├── AICapabilities.ts    # registry de 8 capabilities
├── AIService.ts         # composition root
└── index.ts
```

**Adaptadores por proveedor** (Strategy pattern):

```ts
interface AIProvider {
  id: 'openai' | 'anthropic' | 'ollama';
  complete(req: AIRequest, opts: { signal: AbortSignal }): Promise<AIResponse>;
  stream?(req: AIRequest, opts: { signal: AbortSignal }): AsyncIterable<AIChunk>;
}
```

**Timeouts, retries, rate limiting**: configurables vía `src/services/ai/AIClient.ts`. Backoff exponencial con jitter; máx. 3 reintentos.

**Caché de respuestas frecuentes** en IndexedDB (store `ai_cache` con TTL configurable por capability).

### 19.6 Privacidad y cumplimiento (LFPDPPP / NOM-024)

- **Opt-in por profesional** (no activado por default).
- **Consentimiento explícito por paciente** registrado en `consents` antes de usar IA con sus datos.
- **Datos anonimizados** o pseudonimizados al construir el prompt (IDs, no nombres; rangos, no valores exactos cuando sea posible).
- **Sin entrenamiento con datos de pacientes** (cláusula contractual con proveedor).
- **Configuración de proveedor** por consultorio (self-hosted Ollama como opción offline).

### 19.7 Costos

- **Caché local** de respuestas frecuentes (clave: hash de prompt + inputs).
- **Presupuesto mensual configurable** por consultorio; el servicio rechaza llamadas si se excede.
- **Tracking de uso** por tipo de capability (`usage_logs`).
- **Modelo pequeño** (e.g. `gpt-4o-mini`, `claude-haiku`) para tareas simples; el grande solo bajo demanda explícita.

### 19.8 Estado actual

✅ **Implementado (Sprint 24):** infraestructura completa y 2 integraciones UI.

**Infraestructura implementada:**
- `AIClient.ts` — HTTP client con OpenAI provider, retry (3 intentos, backoff exp.), timeout 30s, abort signal
- `AIPrompts.ts` — system prompts en español para 8 capabilities, contexto tipado
- `AIResponseParser.ts` — Zod schemas por capability, parsing con confidence scoring
- `AICapabilities.ts` — registry con metadata, modelo, temperatura, cacheabilidad
- `AIService.ts` — orchestrador: cache check, prompt building, API call, audit logging, usage tracking
- `useAI.ts` — React hook con abort support
- `AIAssistButton.tsx` — botón reutilizable Sparkles + loading state

**Integraciones UI completadas:**
- ConsultationWizard StepPlan — `draftClinicalNotes` para generar assessment y plan
- ConsultationWizard StepReview — `summarizeConsultation` para resumen narrativo

**Pendiente de UI:** GoalDialog (generateGoalSuggestions), LabResults (interpretLabResults), MealPlan (generateMealPlanInitial), etc.

---

## 20. Performance y observabilidad

### 20.1 Objetivos de rendimiento

| Métrica | Objetivo | Estado actual (medido) |
|---------|----------|------------------------|
| Carga inicial de la app (LCP) | < 2 s | ~1.2 s (Vite + code splitting) |
| Time to interactive (TTI) | < 3 s | ~1.8 s |
| Carga de ficha de paciente | < 500 ms | ~80 ms (IndexedDB local) |
| Búsqueda de alimento | < 50 ms | ~5 ms (Dexie B-tree sobre `smae_custom_foods`) |
| Cálculo de menú (30 ítems) | < 100 ms | ~12 ms (macros + kcal deterministas) |
| Guardado de consulta | < 1 s | ~150 ms (Dexie transaccional) |
| Renderizado de tabla (1000 filas) | < 500 ms | Por medir (TanStack Virtual) |
| Sincronización (100 ítems) | < 5 s | N/A (Fase 3 — sin servidor) |
| Generación de PDF | < 3 s | N/A (Sprint 11 — `services/pdf/`) |
| Chunk principal Vite | < 500 KB minificado | 465.18 KB tras lazy routes + startup `import()` |

### 20.2 Estrategias (alineadas al stack React 19 + Vite + Tauri v2)

#### 20.2.1 Code splitting

- **Lazy loading por ruta**: todas las páginas y `AppLayout` se cargan con `React.lazy` desde `src/app/router.tsx`.
- **Suspense por frontera**: `AppRouter` cubre rutas públicas (`/login`, `/portal/:token`) y `AppLayout` cubre rutas internas con fallback local.
- **Startup diferido**: `App.tsx` carga `@services/db`, sync bootstrap, enqueuer y migración legacy con `import()` dentro de `useEffect` para no inflar el bundle inicial.
- **Lazy loading por feature**: `import()` dinámico en componentes pesados.
- **Vite chunks**: `manualChunks` separa `react`, `radix-ui`, `recharts`, `dnd-kit`, `framer-motion`.
- **Regla de build**: si Vite vuelve a emitir `Some chunks are larger than 500 kB`, primero mover imports eager a lazy/dynamic; solo subir `chunkSizeWarningLimit` si el chunk grande es intencional y no está en el camino crítico.
- **Tauri v2 tree-shaking**: imports nombrados; evitar `import * as`.

#### 20.2.2 Virtualización

- **TanStack Virtual** para listas largas (futuro: recetas, lista de compras, bitácora).
- **TanStack Table v8** ya soporta virtualización con `useVirtualizer`.
- **Paginación** en listados extensos como default; virtualización solo si > 500 filas.

#### 20.2.3 Memoización

- **`React.memo`** en componentes puros (KPICard, EquivalenteBadge, ClinicalBadge).
- **`useMemo`** para cálculos costosos (cálculo de macros del plan, distribución de kcal).
- **`useCallback`** para handlers que se pasan a children memoizados.
- **Selectores Zustand** con `shallow` comparator para evitar re-renders innecesarios.
- **Cálculos clínicos en caché** (VOs inmutables se reutilizan por referencia).

#### 20.2.4 Caché multinivel

| Nivel | Tecnología | Uso |
|-------|-----------|-----|
| L1 | Memoria (LRU) | Sesión activa, calculados derivados |
| L2 | IndexedDB (Dexie) | Catálogo SMAE, pacientes activos, configs |
| L3 | Service Worker | Assets estáticos, PWA offline del portal |
| L4 | Servidor (Fase 3) | SMAE versionado, datos multi-puesto |

#### 20.2.5 Optimización de tablas

- Solo columnas visibles en DOM.
- Paginación o virtualización.
- Datos resumidos en listados; detalle lazy.
- Filtros client-side hasta 1k filas; server-side después.

#### 20.2.6 Optimización de gráficos (Recharts)

- `isAnimationActive={false}` para series > 100 puntos.
- Canvas en lugar de SVG si > 1000 puntos (migrar a visx o echarts si hace falta).
- Datos agregados en lugar de raw en dashboards.
- Throttle de actualizaciones con `useDeferredValue` (React 19).

#### 20.2.7 Optimización de BD (Dexie → SQLite)

- Índices apropiados (ver §21 SQL Design).
- Transacciones en lote: `db.transaction('rw', tables, async () => {...})`.
- `bulkPut` en lugar de N `put`.
- Para SQLite nativo (Fase 3): WAL mode, FTS5 para búsqueda de texto.

#### 20.2.8 Web Workers (Fase 3)

- `sync.worker.ts` — sincronización en background.
- `pdf.worker.ts` — generación de PDF off-main-thread.
- `search.worker.ts` — búsqueda fuzzy en SMAE (>10k alimentos).
- `import.worker.ts` — parser de CSV de pacientes.

### 20.3 Monitoreo y observabilidad

- **Web Vitals** vía `web-vitals` lib: LCP, FID, CLS, INP, TTFB.
- **Custom metrics** en `src/utils/perf/metrics.ts`: tiempo de cálculo clínico, tamaño de payload sync.
- **Performance API**: `performance.mark()` / `performance.measure()` en puntos críticos.
- **React Profiler** en dev (`<Profiler id="...">`); off en producción.
- **Reportes automáticos** en producción (opt-in): endpoint `/api/telemetry` con muestreo configurable.
- **Logs estructurados** en consola dev: `[perf] MealPlanForm render: 47ms (2 warnings)`.

### 20.4 Estado actual

✅ Code splitting por ruta activo en Vite para todas las páginas.
✅ Chunk principal bajo 500 KB: `index-*.js` 465.18 KB minificado / 146.70 KB gzip en build post-Sprint 41.
✅ DB/sync bootstrap diferido fuera del bundle inicial (`import()` en `App.tsx`).
✅ Memoización selectiva (KPICard, SlotProgress, Vitals).
✅ Dexie v3 con índices en `smae_custom_foods` (id, group, name, created_at).
⏳ TanStack Virtual aún no usado (no hay listas > 100 filas).
⏳ Web Workers pendientes (Fase 3).
⏳ Métricas Web Vitals no capturadas aún (Fase 3).

---

## 21. Diseño SQL (target migración Dexie → SQLite nativo)

> **Nota:** este spec describe el modelo canónico en SQL que se implementará cuando se migre de Dexie/IndexedDB a SQLite nativo vía `tauri-plugin-sql` o `sql.js` (Fase 3, ADR-001). Hoy el código usa Dexie, pero los nombres de tablas/columnas y relaciones se conservan para que el swap sea transparente.

### 21.1 Convenciones

- Tablas en `snake_case` plural (`patients`, `consultations`, `meal_plans`).
- Columnas en `snake_case` (`patient_id`, `consultation_date`).
- **PK**: `id` de tipo `TEXT` (UUIDv7) en todas las tablas.
- **Timestamps**: `created_at`, `updated_at` en formato ISO 8601 UTC.
- **Soft delete**: `deleted_at` nullable.
- **Versionado**: `version INTEGER` en entidades clínicas versionadas.
- **Auditoría**: `created_by`, `updated_by` (FK a `users.id`).
- **JSON**: columna `data` o `*_json` para campos extensibles.

### 21.2 Diagrama relacional (resumen textual)

```
users ─< user_roles >─ roles ─< role_permissions >─ permissions
  │                         │
  │                         └─> audit_events (control de acceso)
  │
  └─> patients ─< clinical_records
                ├─< consultations ─< snapshots
                │    ├─< anthropometries ─< anthropometry_calculations
                │    ├─< laboratory_studies ─< laboratory_parameters
                │    ├─< diagnoses
                │    ├─< goals ─< goal_evaluations
                │    ├─< adherence_records
                │    ├─< documents
                │    ├─< allergies
                │    ├─< intolerances
                │    ├─< medications
                │    ├─< supplements
                │    └─< clinical_events
                │
                ├─< meal_plans ─< menus ─< menu_times ─< menu_items
                │                                       │
                │                                       └─> equivalents
                │
                ├─< appointments
                ├─< recipes ─< recipe_ingredients ─┐
                │              └─< recipe_steps   │
                └─< shopping_lists                │
                                                  │
smae_versions ─< smae_groups ─< smae_subgroups ─< foods ─< equivalents
                                                         └< substitutions (M:N)
```

### 21.3 Constraints principales

| Tabla | Constraint | Detalle |
|-------|------------|---------|
| `patients` | `CHECK biological_sex IN ('M','F','I')` | Sexo biológico restringido |
| `patients` | `CHECK birth_date <= CURRENT_DATE` | Fecha de nacimiento no futura |
| `consultations` | `CHECK status IN ('draft','validated','signed','closed','cancelled')` | Estado de consulta |
| `anthropometries` | `CHECK weight_kg > 0 AND weight_kg < 500` | Peso físicamente posible |
| `equivalents` | `CHECK kcal >= 0` | Valores nutricionales no negativos |
| `goals` | `CHECK target_value <> initial_value` | Meta distinta del valor inicial |
| `appointments` | `CHECK end_time > start_time` | Fin posterior al inicio |
| `users` | `CHECK failed_attempts >= 0` | Contador de intentos no negativo |

### 21.4 Índices principales

| Índice | Tabla | Columnas | Propósito |
|--------|-------|----------|-----------|
| `idx_patient_folio` | `patients` | `folio` (UNIQUE) | Búsqueda por folio |
| `idx_patient_names` | `patients` | `(last_name_paternal, last_name_maternal, first_name)` | Búsqueda por nombre |
| `idx_patient_search` | `patients` | `(first_name, last_name_paternal, last_name_maternal, folio, curp)` | FTS5 búsqueda global |
| `idx_consultation_patient_date` | `consultations` | `(patient_id, consultation_date DESC)` | Historial cronológico |
| `idx_anthro_patient_date` | `anthropometries` | `(patient_id, measurement_date DESC)` | Tendencias antropométricas |
| `idx_lab_study_patient` | `laboratory_studies` | `(patient_id, study_date DESC)` | Estudios por paciente |
| `idx_lab_param_study` | `laboratory_parameters` | `(study_id, parameter_code)` | Parámetros de un estudio |
| `idx_goal_patient_active` | `goals` | `(patient_id) WHERE status='active'` | Objetivos activos (parcial) |
| `idx_appointment_user_date` | `appointments` | `(user_id, appointment_date)` | Agenda por profesional |
| `idx_audit_user_time` | `audit_events` | `(user_id, timestamp DESC)` | Auditoría por usuario |
| `idx_audit_resource` | `audit_events` | `(resource_type, resource_id)` | Auditoría por recurso |
| `idx_snapshot_patient_date` | `snapshots` | `(patient_id, snapshot_date DESC)` | Comparativos históricos |
| `idx_food_search` | `foods` | `(name, synonyms)` | Búsqueda de alimentos (FTS5) |
| `idx_equivalent_food` | `equivalents` | `(food_id)` | Equivalentes de un alimento |
| `idx_change_log_entity` | `change_log` | `(entity_type, entity_id, timestamp DESC)` | Historial de cambios |
| `idx_sync_queue_status` | `sync_queue_items` | `(status, next_retry_at)` | Cola de sincronización |

### 21.5 Normalización

- **3FN estricta** en datos clínicos y maestros.
- **Desnormalización selectiva** para performance de listados:
  - `current_pathology` en `patients` (resumen del diagnóstico activo).
  - `target_kcal`, `target_protein_pct`, etc. en `meal_plans` (acceso rápido en listados).
  - `smae_version_id` en `snapshots` (auditoría de versión SMAE usada).
- **JSON** para campos extensibles:
  - `clinical_records.data` (anamnesis completa).
  - `meal_plans.restrictions` (alergias, intolerancias, preferencias).
  - `recipes.allergens`, `recipes.tags`.
  - `documents.parameters` (parámetros del template usado).
  - `goal_evaluations.notes` (barreras, facilitadores).

### 21.6 Estrategia de versionado (5 capas)

| Capa | Mecanismo | Uso |
|------|-----------|-----|
| **Esquema de BD** | Migraciones incrementales con `schema_version` global | Cambios estructurales (columnas, tablas, índices) |
| **Entidades clínicas** | Campo `version INTEGER` por registro | Cambios a un expediente; cada modificación incrementa |
| **Snapshots** | Copia inmutable al cierre de consulta | Recuperación, comparativos, auditoría |
| **SMAE** | Tabla `smae_versions` con `status='active'` | Solo una versión activa; históricas conservadas |
| **Configuración** | Tabla `system_config` con `version` | Cambios con rollback soportado |

**ChangeLog** (append-only) por cada cambio:

```
change_log
├─ id
├─ entity_type
├─ entity_id
├─ operation ('create' | 'update' | 'delete' | 'restore')
├─ field_name NULL  -- campo específico, NULL si es create/delete
├─ old_value NULL
├─ new_value NULL
├─ changed_by
├─ changed_at
├─ reason NULL
├─ consultation_id NULL
└─ sync_status
```

**Snapshots inmutables** (mismo modelo que ya existe):

```
snapshots
├─ id
├─ consultation_id FK
├─ patient_id FK
├─ snapshot_date
├─ data JSON NOT NULL  -- estado completo
├─ data_hash TEXT NOT NULL  -- SHA-256
├─ smae_version_id FK
├─ type ('consultation' | 'daily' | 'weekly')
├─ created_at
└─ created_by
```

### 21.7 Estado actual en el codebase

✅ **Dexie v3** implementa las 5 tablas core: `patients`, `anthropometry`, `lab_panels`, `consultations`, `meal_plans`, `smae_custom_foods`.
✅ Nombres y campos siguen la convención snake_case que se mapeará 1:1 a SQL.
⏳ Migración a SQLite nativo se hará en Fase 3 vía `tauri-plugin-sql` (Fase 3, ADR-001).
⏳ Tablas secundarias (`allergies`, `medications`, `clinical_events`, etc.) se crearán cuando se implementen los módulos respectivos.

---

## 22. Expediente clínico integral del paciente (módulo 31)

> **Origen:** Plan de arquitectura §31. **Fase objetivo:** 2 (después del MVP).

### 22.1 Objetivo

Consolidar en una única entidad clínica longitudinal toda la información demográfica, biomédica, conductual y nutricional del paciente, con captura cronológica auditable, versionada y trazable, que funcione como **fuente única de verdad** para los módulos clínico, antropométrico, bioquímico, de objetivos, de adherencia y de generación de documentos.

### 22.2 Entidad `PACIENTE` (modelo canónico)

Esta es la versión expandida del modelo de paciente que reemplaza la versión MVP actual (16 campos) cuando se implemente el módulo completo.

**Identidad (16 campos):**
- `id` (UUIDv7), `clave_interna` (folio autogenerado, no usar nombre)
- `nombres`, `apellido_paterno`, `apellido_materno`
- `fecha_nacimiento`, `sexo_biologico` (M / F / Intersexual)
- `genero_autodeclarado` (Mujer / Hombre / No binario / Prefiere no decir / Otro)
- `estado_civil`, `ocupacion`, `escolaridad`
- `lugar_nacimiento`, `lugar_residencia`, `direccion`
- `telefono_principal`, `telefono_secundario`, `correo_electronico`
- `foto` (opcional, ruta relativa, **cifrada**)

**Contacto de emergencia (3 campos):**
- `contacto_emergencia_nombre`, `contacto_emergencia_parentesco`, `contacto_emergencia_telefono`

**Identificación oficial (2 campos, cifrados):**
- `identificacion_oficial_tipo` (INE, pasaporte, otro)
- `identificacion_oficial_numero` (**cifrado**)

**Metadata del expediente (8 campos):**
- `fecha_apertura_expediente`
- `estado_expediente` (activo / inactivo / alta / derivado / baja)
- `motivo_alta` (texto)
- `fecha_ultima_consulta`
- `profesional_responsable_id`
- `numero_expediente_externo` (opcional, para referencia hospitalaria)
- `consentimiento_informado_id` (FK a `consents`)
- `fecha_firma_consentimiento`
- `version_politica_privacidad`

**Adicionales:**
- `observaciones_generales`
- `etiquetas_clinicas` (lista controlada, ej. "diabético", "embarazo", "vegetariano")

**Total: ~40 campos** (vs 16 actuales del MVP).

### 22.3 Entidades clínicas relacionadas

| Entidad | Cardinalidad | Contenido |
|---------|--------------|-----------|
| `antecedente_heredofamiliar` | 1-N | parentesco + condición (catálogo: diabetes, HTA, obesidad, cáncer, ECV, ERC, tiroidea, autoinmune, osteoporosis, etc.) + estatus + edad diagnóstico |
| `antecedente_personal_patologico` | 1-N | condición + fecha diagnóstico + estatus + médico tratante + tratamiento |
| `cirugia` | 1-N | tipo + fecha + hospital + complicaciones |
| `hospitalizacion` | 1-N | motivo + fecha ingreso/egreso + días estancia + hospital |
| `medicamento` | 1-N | nombre comercial + principio activo (FK catálogo) + dosis + frecuencia + vía + motivo + fecha inicio/fin + médico prescriptor + adherencia reportada |
| `suplemento` | 1-N | nombre + marca + categoría (multivitamínico, hierro, calcio, Vit D, omega 3, proteína, creatina, probiótico, herbolario, homeopático) + composición + dosis |
| `alergia` | 1-N | alérgeno (catálogo) + reacción + severidad (leve/moderada/severa/anafilaxia) + tipo diagnóstico (clínico/prick/RAST/desafío) |
| `intolerancia` | 1-N | alimento + síntoma + severidad + dosis umbral + mecanismo (lactosa, fructosa, sorbitol, histamina, gluten) |
| `habito` | 1-N | categoría (tabaquismo, alcohol, sueño, estrés, hidratación, café, ultraprocesados) + estado + frecuencia + cantidad |
| `actividad_fisica` | 1-N | tipo + frecuencia semanal + duración + intensidad (Borg) + fecha inicio/fin |
| `historia_dietetica` | 1-1 (versión actual) | tipo dieta + N° comidas + horarios + lugar + quien prepara + tiempo disponible + presupuesto + equipos cocina + antecedentes dietas previas + lectura etiquetas + conocimiento nutricional + preferencias + aversiones + masticación + horario laboral + personas hogar |
| `recordatorio_24h` | 1-N | tiempos comida detalle (estructura anidada) + líquidos + suplementos + interpretación nutrióloga + kcal/macros calculados + alertas |
| `frecuencia_consumo` | 1-N | alimento_grupo_id + frecuencia (diario/3-5/sem/1-2/sem/1-3/mes/ocasional/nunca) + cantidad + preparación |
| `sintoma_gastrointestinal` | 1-N | síntoma (estreñimiento, diarrea, distensión, reflujo, etc.) + frecuencia + severidad 1-10 + relación alimentos |
| `evento_clinico` | 1-N | tipo (síntoma nuevo, cambio medicación, evento agudo, hospitalización, procedimiento) + descripción + fecha + profesional_id |
| `consulta` | 1-N | ver §22.4 |
| `snapshot_expediente` | 1-N | copia inmutable por consulta con hash SHA-256 |

### 22.4 `CONSULTA` entidad cabecera

- `id`, `paciente_id`, `numero_consulta` (1, 2, 3...), `fecha`, `hora`
- `tipo` (primera_vez / seguimiento / urgencia / control / cierre)
- `profesional_id`
- `motivo_consulta`, `padecimiento_actual`
- `estado` (en_curso / cerrada / cancelada)
- SOAP: `resumen_subjetivo (S)`, `resumen_objetivo (O)`, `evaluacion_clinica (A)`, `plan (P)`
- `diagnosticos_ids[]`, `objetivos_ids[]`, `plan_alimentario_id`, `recomendaciones_ids[]`
- `alertas_generadas[]`, `tiempo_total_consulta_min`
- `snapshot_expediente_id` (FK), `version_smae_usado`
- `firma_digital_id`

### 22.5 `SNAPSHOT_EXPEDIENTE` (inmutable por consulta)

- `id`, `consulta_id`, `fecha_snapshot`
- `contenido_json_expediente` (anamnesis)
- `contenido_json_antropometria`
- `contenido_json_bioquimica`
- `contenido_json_plan`
- `hash_integridad` (SHA-256)
- `version_smae`, `profesional_id`

### 22.6 Flujos

**Apertura del expediente (13 pasos):**
1. Validar consentimiento informado firmado.
2. Capturar datos demográficos.
3. Validar unicidad (no duplicar paciente).
4. Capturar antecedentes heredofamiliares.
5. Capturar antecedentes personales patológicos.
6. Capturar cirugías y hospitalizaciones.
7. Capturar alergias e intolerancias.
8. Capturar medicamentos y suplementos.
9. Capturar hábitos y antecedentes dietéticos.
10. Capturar síntomas gastrointestinales.
11. Calcular edad, IMC si hay peso y talla, alertas iniciales.
12. Generar folio y crear snapshot inicial.
13. Activar expediente.

**Captura cronológica:** cada dato se asocia a timestamp + profesional. Modificaciones se versionan; nunca se borra el dato original, solo se marca como inactivo o se reemplaza.

**Evolución clínica (consulta subsecuente, 10 pasos):**
1. Cargar último snapshot.
2. Preguntar cambios desde última visita (diagnósticos, medicación, alergias, hábitos, eventos).
3. Actualizar entidades vigentes.
4. Capturar nueva antropometría.
5. Capturar nueva bioquímica (si aplica).
6. Capturar recordatorio 24h o frecuencia de consumo.
7. Reevaluar plan.
8. Generar nuevo snapshot.
9. Comparar contra snapshot anterior (diff).
10. Cerrar consulta.

### 22.7 Reglas de negocio (12 reglas)

- **RN-EXP-01**: todo paciente debe tener consentimiento firmado antes de la primera consulta clínica.
- **RN-EXP-02**: una alergia activa **bloquea de forma permanente** cualquier alimento que la contenga (motor de reglas).
- **RN-EXP-03**: una intolerancia activa marca como **advertencia** cualquier alimento relacionado, con severidad configurable.
- **RN-EXP-04**: la modificación de un antecedente o medicamento no altera los snapshots históricos, pero sí afecta el estado clínico actual.
- **RN-EXP-05**: el cierre de un expediente requiere motivo documentado (alta, derivación, defunción, cambio profesional, pérdida de contacto).
- **RN-EXP-06**: cada consulta genera un snapshot inmutable.
- **RN-EXP-07**: no se permite borrar datos clínicos; solo se reemplazan versiones y se justifica.
- **RN-EXP-08**: los datos de identificación oficial se almacenan **cifrados** (AES-256).
- **RN-EXP-09**: el acceso al expediente queda registrado en bitácora con timestamp, usuario, módulo y acción.
- **RN-EXP-10**: la foto del paciente es opcional, se almacena cifrada y se utiliza solo para identificación visual.
- **RN-EXP-11**: las etiquetas clínicas se generan a partir de reglas (ej. si hay diabetes mellitus, se etiqueta automáticamente).
- **RN-EXP-12**: el sistema **no diagnostica ni prescribe**, solo asiste el registro y la organización.

### 22.8 Validaciones

Consentimiento firmado, edad válida, IMC computable, alergia con alérgeno del catálogo, medicamento con principio activo del catálogo, duplicado de paciente, fecha cirugía/hospitalización vs fecha nacimiento, severidad alergia registrada, dosis numérica, email válido, teléfono válido, frecuencia de hábito válida.

### 22.9 Auditoría y versionamiento

- Bitácora append-only de todo evento sobre el expediente: lectura, creación, edición, eliminación lógica, exportación, impresión, firmado.
- Cada evento: timestamp, usuario, IP/local, módulo, acción, entidad afectada, valor anterior (hash), valor nuevo (hash), justificación.
- Snapshots inmutables por consulta, verificables por hash.
- Exportación de la bitácora por paciente, rango, profesional, tipo de evento.
- **Retención mínima: 10 años** (LFPDPPP + NOM-024).
- Entidades versionadas: antecedentes personales, cirugías, hospitalizaciones, alergias, intolerancias, medicamentos, suplementos, historia dietética, frecuencia de consumo, hábitos, actividad física, síntomas. Cada cambio genera nueva versión, conserva la anterior.

### 22.10 Seguridad

- Cifrado en reposo (AES-256) para datos sensibles: identificación oficial, dirección, teléfono, correo, foto.
- Cifrado en tránsito (TLS 1.3).
- Control de acceso por rol (nutrióloga, asistente, administrador).
- Permisos granulares por módulo.
- Acceso de solo lectura a ciertos roles (asistente no puede modificar historia clínica).
- Doble factor de autenticación (opcional, recomendado).
- Bloqueo automático por inactividad.
- Política de contraseñas robusta.

### 22.11 Rendimiento (objetivos)

- Carga del expediente: **<500 ms**.
- Búsqueda de pacientes: **<200 ms**.
- Snapshot por consulta: **<1 s** para 200 entidades.
- Búsqueda por folio: **<50 ms** (índice).
- Búsqueda fuzzy por nombre: **<300 ms**.
- Auto-guardado de captura: **cada 5 s**, asíncrono, no bloqueante.
- Carga de expediente histórico de 5 años: **<2 s** con paginación.

### 22.12 Casos especiales

- **Homónimos**: distinción por fecha de nacimiento, CURP opcional, clave interna autogenerada.
- **Sin identificación oficial**: marcar "sin identificación", registrar motivo.
- **Múltiples patologías**: N antecedentes activos, N medicamentos, N alergias.
- **Tutor legal** (menores, personas con discapacidad): registrar datos del tutor y relación.
- **Omisión de datos sensibles**: marcar "prefiere no declarar", **no inventar**.
- **Tratamiento compartido** (varios profesionales): marcar profesionales con permiso de lectura/escritura.
- **Migración de expediente de otro sistema**: módulo de importación con mapeo de campos.
- **Expediente cerrado que se reabre**: nuevo episodio clínico, conservando histórico del anterior.

### 22.13 Datos que requieren captura manual

Demográficos, consentimiento informado, antecedentes familiares, antecedentes personales, cirugías, hospitalizaciones, alergias, intolerancias, medicamentos, suplementos, hábitos, actividad física, historia dietética, recordatorio 24h, frecuencia de consumo, síntomas gastrointestinales, eventos clínicos.

### 22.14 Datos que el sistema **nunca** debe inventar

Diagnósticos médicos, dosis de medicamentos, alergias, eventos clínicos no declarados, hábitos no declarados, actividad física no declarada, datos de identidad, datos de contacto, antecedentes familiares no declarados, historia dietética subjetiva, adherencia sin declaración.

### 22.15 Estado actual

✅ **MVP**: entidad `Patient` con 16 campos básicos (Sprint 1).
⏳ **Fase 2**: expansión a 40+ campos + entidades de antecedentes, alergias, hábitos, historia dietética, recordatorio 24h.
⏳ **Fase 3**: snapshot inmutable + versionamiento + bitácora de auditoría detallada.

---

## 23. Antropometría y composición corporal (módulo 32)

> **Origen:** Plan §32. **Fase objetivo:** 2 (ya implementado el MVP, esta es la expansión).

### 23.1 Entidad `MEDICION_ANTROPOMETRICA` (expandida)

**Identificación:** `id`, `paciente_id`, `consulta_id` (opcional), `fecha`, `hora`, `profesional_id`, `equipo_id` (FK a `equipo_antropometria`).

**Medidas básicas (8):** `peso_kg`, `talla_cm`, `circunferencia_cintura_cm`, `circunferencia_cadera_cm`, `circunferencia_cuello_cm`, `circunferencia_muslo_cm`, `circunferencia_brazo_cm`, `circunferencia_pantorrilla_cm`.

**Pliegues cutáneos (5):** tricipital_mm, bicipital_mm, subescapular_mm, suprailiaco_mm, abdominal_mm.

**Composición corporal (calculados/capturados, 9):** `imc`, `peso_ideal_kg`, `peso_ajustado_kg`, `tmb_kcal`, `get_kcal`, `relacion_cintura_cadera`, `riesgo_cv_cintura`, `porcentaje_grasa`, `masa_grasa_kg`, `masa_libre_grasa_kg`, `masa_muscular_kg`, `agua_corporal_total_litros`, `agua_corporal_porcentaje`, `grasa_visceral_kg`, `masa_muscular_esqueletica_kg`.

**BIA (opcional, 6 campos):** `unidades_bia_equipo` (modelo + serial), `angulo_fase_grados`, `tasa_metabolica_basal_bia_kcal`, `resistencia_ohmios`, `reactancia_ohmios`, `tasa_metabolica_basal_bia_kcal`.

**Vitales (3):** `tension_arterial_sistolica`, `tension_arterial_diastolica`, `frecuencia_cardiaca_lpm`.

**Opcionales:** `temperatura_corporal_c`, `spo2`, `notas`, `estado` (capturada/validada/firmada), `snapshot_id`.

### 23.2 Entidad `CALCULO_ANTROPOMETRICO` (caché auditable)

Almacena **qué fórmula se usó** para cada cálculo, garantizando reproducibilidad:

- `formula_tmb` (Mifflin-St Jeor / Harris-Benedict / FAO-OMS / Katch-McArdle)
- `formula_peso_ideal` (Devine / Robinson / Miller / Hamwi)
- `formula_grasa` (Deurenberg / Jackson-Pollock 3 / Jackson-Pollock 7 / BIA)
- `formula_musculo` (Janssen / BIA)
- `formula_agua` (Watson / Hume / BIA)
- `parametros_entrada_json`, `resultados_json`
- `fecha_calculo`, `version_motor_calculo`

### 23.3 Entidad `EQUIPO_ANTROPOMETRIA` (catálogo)

`id`, `nombre`, `tipo` (báscula, estadiómetro, cinta, plicómetro, bioimpedancia, tensiómetro, dinamómetro), `marca`, `modelo`, `serial`, `calibracion_fecha`, `calibracion_vencimiento`, `precision`, `rango_medicion`, `estado` (activo/inactivo/mantenimiento), `notas`.

### 23.4 Entidad `TENDENCIA_ANTROPOMETRICA` (cálculo derivado)

`id`, `paciente_id`, `variable`, `periodo` (7d/30d/90d/6m/1y/total), `valor_inicial`, `valor_final`, `cambio_absoluto`, `cambio_porcentual`, `tendencia` (ascendente/descendente/estable), `velocidad_cambio_semanal`, `fecha_calculo`.

### 23.5 Equipos compatibles (importación BIA)

- **Básculas y estadiometros**: captura manual + USB/Bluetooth (Genérico, Tanita, seca, InBody, Omron).
- **Cintas métricas**: manual con validación de marcas.
- **Plicómetros**: manual.
- **Bioimpedancia**:
  - Tanita BC-554, BC-558, BC-1500, RD-545, SC-240, MC-780, MC-980.
  - InBody H20B, 120, 230, 270, 570, 720, 770, 970.
  - seca mBCA 514, 525, 554.
  - Omron HBF-514, HBF-516, HBF-702T.
  - Importación CSV/TSV/PDF con mapeo configurable por modelo.
- **Tensiómetros**: manual + Omron, Microlife, Citizen, A&D.
- **Dinamómetros**: Takei, Jamar, Genérico.

### 23.6 Flujos

**Captura (12 pasos):**
1. Verificar última medición (cargar histórico).
2. Capturar peso, talla, circunferencias.
3. Capturar pliegues (si aplica).
4. Capturar datos de BIA (importación CSV / captura manual / sin BIA).
5. Capturar tensión arterial, FC.
6. Validar coherencia de datos.
7. Calcular índices derivados.
8. Clasificar resultados.
9. Generar alertas.
10. Comparar contra medición anterior.
11. Confirmar y guardar.
12. Asociar a consulta (si aplica).

**Importación BIA (7 pasos):** detectar formato → mapear campos → validar rangos → vista previa → aplicar → recalcular → guardar con referencia al equipo.

**Análisis de tendencia (5 pasos):** obtener mediciones → calcular (valor inicial, final, cambio, velocidad, regresión lineal) → clasificar tendencia → generar alertas (pérdida >1% peso/sem, ganancia >0.5%, variabilidad errática, estancamiento) → devolver resultado + gráfica.

### 23.7 Reglas de negocio (15 reglas)

- **RN-ANT-01**: toda medición debe tener fecha, hora, peso, talla y al menos cintura para ser válida.
- **RN-ANT-02**: BIA importada debe identificar equipo, fecha de calibración y versión del firmware.
- **RN-ANT-03**: si se importa BIA, los valores del equipo ceden (con registro de fuente).
- **RN-ANT-04**: circunferencias fuera de rango (>3 DE sobre media poblacional) generan advertencia.
- **RN-ANT-05**: la fórmula de TMB puede seleccionarse; el sistema guarda la elección y la usa consistentemente.
- **RN-ANT-06**: cálculos derivados se guardan en `CALCULO_ANTROPOMETRICO` para auditoría.
- **RN-ANT-07**: cambio abrupto de peso (>3% en 7 días) genera alerta clínica.
- **RN-ANT-08**: captura repetida el mismo día solo con justificación.
- **RN-ANT-09**: TA elevada sostenida → derivación a médico.
- **RN-ANT-10**: pérdida no intencionada >5% en 3 meses → alerta de desnutrición (OMS, adultos mayores).
- **RN-ANT-11**: masa muscular baja en pacientes con peso normal/bajo → alerta de sarcopenia.
- **RN-ANT-12**: % grasa se clasifica según sexo, edad y referencia (ACE, Gallagher, configurable).
- **RN-ANT-13**: agua corporal <50% (H) o <45% (M) → alerta de hidratación.
- **RN-ANT-14**: la talla solo se modifica con justificación explícita.
- **RN-ANT-15**: el sistema **no realiza interpretación diagnóstica**, solo asiste en clasificación y alerta.

### 23.8 Casos especiales

- **Amputado**: registro de amputación, ajuste de peso, anotación.
- **Embarazada**: ajustes por edad gestacional; IMC pregestacional como referencia.
- **Edema / ascitis**: peso no confiable; marcar "con edema", sugerir alternativas.
- **Sonda nasogástrica / gastrostomía**: documentar, ajustar recomendaciones.
- **Pediátricos**: percentiles (OMS 0-5, OMS 5-19, CDC), z-scores.
- **Adultos mayores**: pérdida no intencionada, ángulo de fase BIA relevante.
- **Atletas de élite**: composición específica, ajustes por deporte.
- **Enanismo / talla alta constitucional**: percentiles o referencia individual.
- **Cuerpo amputado, prótesis, órtesis**: registro y ajustes.

### 23.9 Estado actual

✅ **MVP**: peso, talla, cintura, cadera, cuello, IMC, % grasa (Sprint 2). Cálculos BMI, BMR, TDEE, bodyComposition (5 archivos en `utils/calculations/`).
✅ **MVP**: Vitals VO con PA, FC, SpO2 opcional (Sprint 8, T2).
⏳ **Fase 2**: ~~pliegues cutáneos, BIA import, equipo catálogo, fórmulas alternativas, alertas clínicas, análisis de tendencia, casos especiales (embarazada, amputado, pediátrico).~~ ✅ **Implementado:** Skinfold VO existente, BiaReading + BiaDevice en dominio, equipo catálogo vía `bia_devices` (Dexie v20), trendAnalysis.ts (tendencia de peso/IMC/CC, velocidad de cambio semanal, comparación de métodos de composición corporal), bodyFatFromBMI, Jackson-Pollock 3 y 7 pliegues.

---

## 24. Interpretación de laboratorios (módulo 33)

> **Origen:** Plan §33. **Estado actual:** MVP (24 códigos con rangos México, Recharts trend — Sprint 4).

### 24.1 Entidad `ESTUDIO_LABORATORIO` (expandida)

- `id`, `paciente_id`, `consulta_id` (opcional)
- `tipo_estudio` (sangre/orina/heces/saliva/otro)
- `subtipo` (biometría hemática, química sanguínea, perfil lipídico, HbA1c, EGO, etc.)
- `fecha_estudio`, `fecha_captura`
- `laboratorio` (texto), `medico_solicitante`, `motivo_estudio`
- `archivo_origen` (ruta cifrada, opcional), `hash_archivo`
- `metodo_captura` (manual / importación PDF / CSV / HL7)
- `estado` (borrador/validado/firmado)
- `version_rangos_referencia` (FK a tabla de rangos)
- `notas`, `profesional_id`

### 24.2 Entidad `PARAMETRO_LABORATORIO`

- `id`, `estudio_id`
- `parametro_codigo` (catálogo: GLU, HbA1c, COL, HDL, LDL, TRI, CRE, BUN, etc.)
- `parametro_nombre`, `valor_numerico`, `valor_texto` (cualitativos)
- `unidad` (mg/dL, mmol/L, %, g/dL)
- `rango_referencia_min`, `rango_referencia_max`
- `rango_referencia_texto` (cualitativos)
- `rango_critico_min`, `rango_critico_max` (opcionales)
- `clasificacion`: bajo / normal / limítrofe bajo / limítrofe alto / alterado bajo / alterado alto / crítico bajo / crítico alto
- `notas`, `alerta_generada`, `alerta_id`

### 24.3 Entidad `RANGO_REFERENCIA` (catálogo versionado)

- `parametro_codigo`, `poblacion` (general, masculino, femenino, pediátrico, gestante, anciano)
- `edad_min`, `edad_max`
- `unidad`, `rango_min`, `rango_max`
- `rango_critico_min`, `rango_critico_max`
- `fuente` ("UpToDate 2023", "NOM", "LabCorp")
- `fecha_vigencia_inicio`, `fecha_vigencia_fin`
- `version`, `activo`, `notas`

### 24.4 Catálogo de parámetros comunes (no exhaustivo)

| Categoría | Parámetros |
|-----------|------------|
| **Glucosa** | Glucosa ayunas, HbA1c, insulina basal, HOMA-IR, índice HOMA, péptido C, PTOG |
| **Lípidos** | CT, HDL, LDL, TG, VLDL, ApoA, ApoB, Lp(a) |
| **Renal** | Creatinina, BUN, urea, ácido úrico, cistatina C, TFGe |
| **Electrolitos** | Na, K, Cl, Ca, P, Mg |
| **Hierro** | Hierro sérico, ferritina, transferrina, saturación transferrina, TIBC |
| **Vitaminas** | A, D (25-OH), E, B12, folato, B6, C |
| **Proteínas** | Albúmina, prealbúmina, transferrina, PCR, proteína total |
| **Hepático** | AST, ALT, GGT, FA, bilirrubina total/directa |
| **Tiroideo** | TSH, T3 libre, T4 libre, anticuerpos antitiroideos |
| **Hormonas** | Insulina, cortisol, leptina, adiponectina, grelina |
| **Inflamatorio** | PCR, VSG, ferritina (fase aguda) |
| **Hematología** | Hb, Hto, VCM, HCM, leucocitos, plaquetas, reticulocitos |
| **Orina** | Densidad, pH, proteínas, Cr, Na, K, microalbúmina |
| **Heces** | Sangre oculta, parásitos, calprotectina, elastasa pancreática |
| **Óseo** | Ca iónico, P, PTH, osteocalcina, CTX, P1NP, 25-OH vit D |
| **Cardiovascular** | BNP, NT-proBNP, troponinas (solo se registran, no se interpretan nutricionalmente) |

### 24.5 Alertas nutricionales automáticas (motor de reglas)

El motor detecta los siguientes hallazgos **y sugiere** acciones nutricionales generales + derivación a médico. **No prescribe ni recomienda dosis.**

| Hallazgo | Acción sugerida |
|----------|-----------------|
| HbA1c >7% en paciente con diabetes | Control de CHO, derivación a médico si >9% |
| HbA1c >9% | Alerta bloqueante, derivación urgente |
| Glucosa ayunas >126 mg/dL en dos ocasiones | Screening diabetes, derivación |
| Glucosa ayunas >200 mg/dL | Alerta crítica, derivación inmediata |
| LDL >160 mg/dL | Reducción de grasas saturadas, derivación |
| TG >200 mg/dL | Reducción de CHO simples, ejercicio |
| HDL <40 (H) o <50 (M) | Aumento de actividad física, grasas saludables |
| Cr elevada + TFGe <60 | Alerta ERC, derivación a nefrología |
| K >5.5 mEq/L | Alerta crítica, restricción de K, derivación |
| K <3.5 mEq/L | Alerta, ajuste de dieta |
| Hierro bajo o ferritina baja | Aumento de hierro hemo + vit C, suplementación |
| Vit D <20 ng/mL | Suplementación, exposición solar |
| Vit B12 baja | Suplementación, estudio de causa |
| Folato bajo en embarazo | Suplementación inmediata |
| Calcio bajo | Aumento de lácteos, suplementación |
| Albúmina <3.5 g/dL | Alerta nutricional, evaluar ingesta proteica |
| PCR elevada | Marcador inflamatorio, derivación si persiste |
| TSH alterado | Derivación a endocrinología |

### 24.6 Reglas de negocio (15 reglas)

- **RN-LAB-01**: el sistema **no emite diagnósticos médicos**; cualquier interpretación nutricional debe ser escrita por la nutrióloga.
- **RN-LAB-02**: el sistema **no sugiere tratamientos médicos** ni cambios de medicación.
- **RN-LAB-03**: valor crítico (fuera de rango crítico) → alerta bloqueante + derivación a médico.
- **RN-LAB-04**: valor alterado → clasificación visual pero no altera automáticamente el plan.
- **RN-LAB-05**: rangos de referencia editables y versionados.
- **RN-LAB-06**: múltiples rangos por parámetro según población (sexo, edad, embarazo).
- **RN-LAB-07**: el médico tratante se registra pero **no es usuario** del sistema.
- **RN-LAB-08**: cuando un parámetro tiene interpretación nutricional automática, la alerta es **sugerencia**, no acción.
- **RN-LAB-09**: importación PDF/CSV requiere confirmación manual; no se aplica de forma automática.
- **RN-LAB-10**: fecha del estudio coherente con fecha de captura.
- **RN-LAB-11**: estudio completo requiere ≥1 parámetro capturado.
- **RN-LAB-12**: correlaciones nutricionales (ej. HbA1c → control CHO) vía motor de reglas con severidad configurable.
- **RN-LAB-13**: estudios asociados a consulta (recomendado) pero pueden existir independientes.
- **RN-LAB-14**: archivo origen (PDF, imagen) se almacena cifrado.
- **RN-LAB-15**: hash del archivo se conserva para integridad.

### 24.7 Importación PDF / CSV (flujos)

**PDF (6 pasos):** detectar formato → extraer texto (OCR si escaneo) → mapear parámetros (parser configurable por laboratorio) → revisión manual obligatoria → vista previa → aplicar rangos y clasificar.

**CSV (6 pasos):** validar estructura → mapear columnas a parámetros del catálogo → validar tipos → vista previa → aplicar rangos → confirmar y guardar.

### 24.8 Estado actual

✅ **MVP**: 24 códigos con `MEXICO_REFERENCE_RANGES`, captura manual, semaforización (normal/limítrofe/alterado), Recharts trend, importador CSV básico (Sprint 4).
⏳ **Fase 2**: importador PDF con OCR, parser configurable por laboratorio, ~~alertas nutricionales automáticas~~ ✅ (`nutritionalAlerts.ts` con 13 alertas por prueba, severidades info/warning/critical/blocking, recomendaciones nutrimentales), ~~alertas críticas~~ ✅ (criticalLow/criticalHigh en rangos), ~~versionamiento de rangos~~ ✅ (`RangeVersion` interfaz), ~~alertas bloqueantes~~ ✅ (`getBlockingAlerts`, `requiresImmediateReferral`).
⏳ **Fase 3**: integración HL7, conversión automática de unidades (mg/dL ↔ mmol/L), parser por laboratorio configurable.

---

## 25. Seguimiento y evolución del paciente (módulo 34)

> **Origen:** Plan §34. **Fase objetivo:** 2.

### 25.1 Objetivo

Permitir el monitoreo longitudinal del paciente a lo largo de las consultas sucesivas, mediante **snapshots inmutables**, comparaciones temporales, análisis de tendencia, evaluación del cumplimiento de objetivos y alertas de estancamiento o deterioro.

### 25.2 Entidad `CONSULTA_SEGUIMIENTO` (extiende `CONSULTA`)

- `cambios_desde_ultima_consulta` (texto estructurado)
- `eventos_intercurrentes` (síntomas nuevos, hospitalizaciones, cambios de medicación)
- `cumplimiento_percibido` (escala 1-10)
- `barreras_identificadas` (texto)
- `facilitadores_identificados` (texto)
- `satisfaccion_paciente` (escala 1-5)
- `proxima_cita`
- `plan_proxima_consulta` (texto)
- `requiere_interconsulta`, `especialidades_a_derivar[]`

### 25.3 Entidad `INDICADOR_EVOLUCION` (cálculo derivado)

- `paciente_id`, `variable` (peso, IMC, % grasa, MLG, HbA1c, etc.)
- `consulta_inicial_id`, `consulta_actual_id`
- `valor_inicial`, `valor_actual`
- `cambio_absoluto`, `cambio_porcentual`, `cambio_porcentual_mensual`
- `objetivo_id` (FK opcional)
- `valor_objetivo`, `distancia_al_objetivo`, `porcentaje_de_avance`
- `estado` (en_progreso / logrado / superado / estancado / en_retroceso)
- `fecha_calculo`

### 25.4 Entidad `COMPARACION_TEMPORAL`

- `paciente_id`, `consulta_actual_id`, `consulta_comparada_id`
- `diferencias_json`, `resumen_cambios`, `fecha_calculo`

### 25.5 Entidad `ALERTA_ESTANCAMIENTO`

- `paciente_id`, `variable`, `periodo_sin_cambio`
- `severidad`, `fecha_generacion`
- `accion_tomada` (opcional), `notas`

### 25.6 Detección de estancamiento (algoritmo)

```
Paciente con objetivo activo
  → Obtener mediciones de la variable objetivo de las últimas X semanas (default 4)
  → Calcular pendiente (regresión lineal)
  → Si pendiente ~ 0 Y adherencia ≥70%: alerta de estancamiento
  → Si pendiente < 0 en objetivo de ganancia: alerta de retroceso
  → Si pendiente > 0 en objetivo de pérdida: alerta de retroceso
  → Si cambio errático: alerta de inconsistencia (posible falta adherencia)
```

### 25.7 Reglas de negocio (10 reglas)

- **RN-SEG-01**: toda consulta de seguimiento debe tener al menos una medición antropométrica o bioquímica, o una nota de seguimiento.
- **RN-SEG-02**: snapshot de cada consulta es inmutable.
- **RN-SEG-03**: cálculo de tendencia requiere ≥2 puntos; con menos, "datos insuficientes".
- **RN-SEG-04**: alerta de estancamiento solo se genera cuando adherencia ≥70% (si es menor, primero se aborda adherencia).
- **RN-SEG-05**: periodo de evaluación configurable (default 4 semanas).
- **RN-SEG-06**: objetivos cerrados se conservan en histórico; no se borran.
- **RN-SEG-07**: cambio de objetivo requiere justificación.
- **RN-SEG-08**: alertas de evolución se muestran en consulta pero **no bloquean el cierre**.
- **RN-SEG-09**: la consulta debe tener, antes de cerrarse, una evaluación del plan previo.
- **RN-SEG-10**: comparaciones temporales contra cualquier consulta anterior o entre dos específicas.

### 25.8 Métricas e indicadores

**Antropométricos:** peso, IMC, % grasa, MLG, masa muscular, agua, circunferencias. Velocidad semanal. Distancia al objetivo.

**Bioquímicos:** HbA1c, perfil lipídico, función renal, electrolitos, vitaminas, hierro, función hepática. Tendencia 3/6/12 meses. % cambio.

**Clínicos:** TA, FC, síntomas, capacidad funcional.

**Dietéticos:** cumplimiento del menú, variabilidad, hidratación, frecuencia de alimentos clave.

**Conductuales:** sueño, estrés, actividad física, estado de ánimo.

### 25.9 Estado actual

⏳ No implementado. Depende de `snapshot_expediente` (módulo 31) y del motor de objetivos (módulo 26).
✅ Wizard SOAP (Sprint 5) puede extenderse con paso 7 de "cambios desde última consulta".
✅ Dashboard ya tiene KPIs básicos (Sprint 7) que pueden usarse como punto de partida.

---

## 26. Sistema de objetivos clínicos (módulo 35)

> **Origen:** Plan §35. **Fase objetivo:** 2 (después del MVP).

### 26.1 Entidad `OBJETIVO_CLINICO`

- `paciente_id`, `consulta_origen_id`
- `tipo` (antropométrico / bioquímico / clínico / dietético / conductual / personalizado)
- `variable` (peso, IMC, % grasa, HbA1c, LDL, TA sistólica, etc.)
- `valor_inicial`, `valor_inicial_fecha`
- `valor_objetivo` (numérico o texto)
- `unidad`
- `fecha_inicio`, `fecha_objetivo` (plazo)
- `fecha_cierre` (cuando se cumple/abandona)
- `estado` (activo / en_pausa / logrado / no_logrado / abandonado / modificado)
- `criterio_exito` (numérico, rango, cualitativo)
- `criterio_exito_detalle`
- `prioridad` (alta / media / baja)
- `fuente_objetivo` (clínica / paciente / ambos)
- `motivo`, `plan_accion`, `metricas_seguimiento[]`
- `alertas_activas`, `profesional_id`, `notas`

### 26.2 Entidad `EVALUACION_OBJETIVO` (cálculo en cada consulta)

- `objetivo_id`, `consulta_id`
- `valor_actual`, `cambio_absoluto`, `cambio_porcentual`
- `distancia_al_objetivo`, `porcentaje_avance`
- `estado_calculado` (en_progreso / en_ritmo / retrasado / estancado / logrado / superado / en_retroceso)
- `velocidad_mensual`, `proyeccion_fecha_logro`, `alerta`
- `fecha_calculo`

### 26.3 Tipos de objetivos predefinidos (catálogo)

| Tipo | Variable típica | Criterio de éxito típico | Plazo típico |
|------|-----------------|--------------------------|--------------|
| **Pérdida de peso** | peso | -5% a -10% del inicial | 12-24 sem |
| **Ganancia de peso** | peso | +5% del inicial | 12-16 sem |
| **Ganancia muscular** | MLG | +2 kg | 16-24 sem |
| **Reducción de grasa** | % grasa | -3% absoluto | 12-16 sem |
| **Control glucémico** | HbA1c | <7% (o -1% absoluto) | 12-24 sem |
| **Mejora de perfil lipídico** | LDL | <100 mg/dL | 12-24 sem |
| **Reducción de TA** | TA sistólica | <130 mmHg | 8-12 sem |
| **Función renal** | TFGe | estabilización o +5 | 24-52 sem |
| **Reducción de circunferencia** | cintura | -5 cm | 12-16 sem |
| **Aumento de fibra dietaria** | fibra g/día | 25-30 g/día | 4-8 sem |
| **Reducción de sodio** | Na mg/día | <2000 mg/día | 4-8 sem |
| **Cese de alcohol** | consumo | 0 g/sem | 4-12 sem |
| **Aumento de actividad física** | min/sem | 150 min/sem | 4-12 sem |
| **Mejora de sueño** | horas | 7-8 h | 4-8 sem |
| **Reducción de estrés** | escala | -2 puntos | 8-12 sem |
| **Mejora de hidratación** | L/día | 2-2.5 L | 2-4 sem |
| **Adherencia al menú** | % | ≥80% | 4-8 sem |
| **Aumento de HDL** | HDL | >50 (M) / >60 (F) | 12-24 sem |
| **Reducción de TG** | TG | <150 mg/dL | 12-24 sem |
| **Reducción de ácido úrico** | uricemia | <6 mg/dL (F) / <7 (M) | 12-24 sem |
| **Mejora de vit D** | 25-OH | >30 ng/mL | 12-24 sem |
| **Mejora de ferritina** | ferritina | >30 ng/mL (F) / >50 (M) | 8-12 sem |
| **Personalizado** | variable del paciente | definido por nutrióloga | definido |

### 26.4 Reglas de negocio (13 reglas)

- **RN-OBJ-01**: todo objetivo debe tener valor inicial, valor objetivo, plazo y criterio de éxito.
- **RN-OBJ-02**: plazo realista según tipo y condición.
- **RN-OBJ-03**: no se permiten objetivos con valores físicamente imposibles (ej. perder 20 kg en 4 sem).
- **RN-OBJ-04**: objetivo "logrado" requiere cumplir criterio + confirmar en 2ª consulta.
- **RN-OBJ-05**: pérdida de peso máxima recomendada = **1% del peso corporal por semana**.
- **RN-OBJ-06**: ganancia de masa muscular máxima = **0.25-0.5 kg/sem**.
- **RN-OBJ-07**: objetivos múltiples deben ser coherentes (ej. pérdida de peso y ganancia muscular son parcialmente excluyentes, advertencia).
- **RN-OBJ-08**: modificación requiere justificación.
- **RN-OBJ-09**: cierre requiere evaluación final.
- **RN-OBJ-10**: objetivo abandonado **no se puede reactivar**; se debe crear uno nuevo.
- **RN-OBJ-11**: objetivos personalizados requieren definición completa.
- **RN-OBJ-12**: alertas automáticas según clasificación.
- **RN-OBJ-13**: se permiten objetivos "sin plazo" (ej. mantenimiento continuo).

### 26.5 Validaciones

Valor inicial vs objetivo coherente, plazo ≥1 sem, plazo ≤104 sem (2 años), velocidad de cambio dentro de rango saludable, variable medible, criterio de éxito definido, coherencia con condición clínica, coherencia con objetivos activos, plan de acción no vacío.

### 26.6 Casos especiales

- **Objetivos múltiples con conflictos**: advertencia y prioridad explícita.
- **Comorbilidades múltiples**: solo compatibles si la nutrióloga confirma.
- **Embarazo**: restricciones (no pérdida de peso en 2°-3er trimestre, salvo indicación médica).
- **Lactancia**: restricciones similares.
- **Adolescentes**: percentiles en lugar de valores absolutos.
- **Adultos mayores**: objetivos más conservadores.
- **Deportistas**: compatibles con temporada competitiva.
- **Oncológicos**: conservadores, énfasis en calidad de vida.
- **Paliativos**: centrados en confort, no en cifras.

### 26.7 Estado actual

✅ **Implementado (Sprint 15).**
- Dominio: Goal, GoalEvaluation (entities, VOs), branded GoalId, 6 tipos (antropométrico/bioquímico/clínico/dietético/conductual/personalizado), 6 estados, 3 prioridades, 3 fuentes, criterios de éxito, GoalRepository interface, Goal.create, pause, markAchieved, markNotAchieved, abandon, scale integrado.
- Aplicación: 10 use cases (create, update, listByPatient, listAll, getById, delete, pause, achieve, abandon, listByStatus), Zod form schema.
- Infraestructura: DexieGoalRepository, goalMapper, Dexie schema v16 (tabla `goals`).
- UI: GoalsPage con cards agrupados por tipo + badges de estado + skeleton loading.
- Service: goalService.ts.
- Sidebar: nav en sección Clínica.
- Router: `/objetivos`.

**Pendiente futuro:** integración con consultas SOAP (evaluación automática por consulta), motor de proyecciones, alertas por plazo próximo.

---

## 27. Adherencia al tratamiento (módulo 41)

> **Origen:** Plan §41. **Fase objetivo:** 2.

### 27.1 Entidad `REGISTRO_ADHERENCIA`

- `paciente_id`, `fecha`, `consulta_id` (opcional)
- `origen` (consulta / portal / app / llamada)
- `adherencia_menu` (% o escala)
- `adherencia_agua` (% o volumen real)
- `adherencia_actividad` (% o tiempo real)
- `adherencia_suplementos` (%)
- `adherencia_sueño` (% o horas reales)
- `hambre_promedio` (1-10), `saciedad_promedio` (1-10), `estado_animo_promedio` (1-10), `energia_promedio` (1-10)
- `eventos_intercurrentes` (texto)
- `barreras` (texto), `facilitadores` (texto)
- `comidas_realizadas` (estructura: tiempo + alimentos + adherencia específica)
- `notas`

### 27.2 Entidad `INDICE_ADHERENCIA` (cálculo derivado)

- `paciente_id`, `periodo_inicio`, `periodo_fin`
- `puntaje_adherencia_menu` (0-100)
- `puntaje_adherencia_actividad` (0-100)
- `puntaje_adherencia_agua` (0-100)
- `puntaje_adherencia_suplementos` (0-100)
- `puntaje_global` (0-100)
- `tendencia` (mejorando / estable / empeorando)
- `fecha_calculo`

### 27.3 Entidad `EVENTO_BARRERA`

- `paciente_id`, `tipo_barrera` (económica / tiempo / social / emocional / salud / conocimiento / otra)
- `descripcion`, `fecha`, `fecha_resolucion` (opcional), `accion_tomada`

### 27.4 Algoritmo de cálculo de índice

```
Para cada componente (menú, agua, actividad, suplementos, sueño):
  → Obtener valores reportados
  → Calcular promedio
  → Calcular consistencia
Ponderar componentes (configurable):
  → Menú: peso X
  → Agua: peso Y
  → Actividad: peso Z
  → Suplementos: peso W
  → Sueño: peso V
Calcular índice global (0-100)
Clasificar: excelente / buena / regular / baja / muy baja
Generar tendencia
```

### 27.5 Reglas de negocio (9 reglas)

- **RN-ADH-01**: el índice es una **medida, no un juicio**.
- **RN-ADH-02**: el sistema **no sanciona** la baja adherencia; ofrece soporte.
- **RN-ADH-03**: las barreras se registran para abordarlas, no para culpabilizar.
- **RN-ADH-04**: la captura puede ser reportada por el paciente o estimada por la nutrióloga, con marca de fuente.
- **RN-ADH-05**: el algoritmo es transparente y configurable.
- **RN-ADH-06**: adherencia al menú se evalúa por coincidencia con el plan, no por duplicación exacta.
- **RN-ADH-07**: registros del portal/app se validan y consolidan en consulta.
- **RN-ADH-08**: alertas por adherencia muy baja con severidad configurable.
- **RN-ADH-09**: el sistema **no usa IA** para clasificar barreras; usa el catálogo controlado.

### 27.6 Estado actual

✅ **Implementado (Sprint 15).**
- Dominio: AdherenceRecord, AdherenceIndex (con cálculo ponderado), BarrierEvent (entities), branded AdherenceId, 4 fuentes, 7 tipos de barrera, repositorio unificado.
- Aplicación: 7 use cases (createRecord, listByPatient, getById, deleteRecord, calculateIndex, createBarrier, listBarriers), Zod form schema.
- Infraestructura: DexieAdherenceRepository (3 tablas), adherenceMapper, Dexie schema v17 (tablas `adherence_records`, `adherence_indexes`, `adherence_barriers`).
- UI: AdherencePage con cards de 5 métricas + colores por rango.
- Service: adherenceService.ts.
- Sidebar: nav en sección Clínica.
- Router: `/adherencia`.

**Pendiente futuro:** integración con portal del paciente, alertas por adherencia crítica, cálculo de tendencia real (comparación entre períodos).

---

## 28. Recetario profesional (módulo 36)

> **Origen:** Plan §36. **Fase objetivo:** 2.

### 28.1 Entidad `RECETA`

- `nombre`, `descripcion` (opcional)
- `categoria` (entrada / plato fuerte / postre / bebida / snack)
- `subcategoria` (opcional)
- `cocina` (mexicana / mediterránea / asiática / etc.)
- `dificultad` (fácil / media / difícil)
- `prep_time_min`, `cook_time_min`
- `servings`, `porcion_unit`, `porcion_weight_g`
- `instrucciones` (JSON con pasos numerados)
- `notas`, `photo_paths[]` (opcional)
- `tags[]` (vegetariano, vegano, sin gluten, bajo en sodio, etc.)
- `allergens[]` (leche, huevo, gluten, soya, cacahuate, etc.)
- `cost_total`, `cost_per_serving` (opcional)
- `currency` (MXN por default)
- `status` (draft / active / archived)
- `current_version` (entero)

### 28.2 Entidad `RECIPE_INGREDIENT`

- `recipe_id` (FK)
- `equivalent_id` (FK a `equivalents` SMAE)
- `quantity`, `unit`
- `weight_g`
- `order_index`
- `is_optional`

### 28.3 Entidad `RECIPE_STEP`

- `recipe_id` (FK)
- `order_index`
- `description`
- `duration_min` (opcional)
- `temperature` (opcional)
- `photo_path` (opcional)

### 28.4 Wizard de creación (3 pasos)

1. **Datos básicos**: nombre, categoría, tiempo, porciones.
2. **Ingredientes**: autocomplete SMAE, cantidades.
3. **Preparación**: pasos numerados, fotos.

**Post-creación:**
- Sistema calcula nutrición automáticamente (suma de ingredientes × equivalentes SMAE).
- Sistema etiqueta alérgenos automáticamente.
- Nutrióloga ajusta etiquetas manualmente.
- Captura costos (opcional).
- Vista previa.
- Guarda como versión borrador.
- Activa (botón "Publicar").

### 28.5 Versionamiento

- Cada cambio genera nueva versión.
- Receta activa tiene puntero a versión actual.
- Historial completo conservado.
- Permite escalamiento de porciones (proporcional a servings).

### 28.6 Estado actual

✅ **Implementado (Sprint 15).**
- Dominio: Recipe, RecipeIngredient, RecipeStep (entities, VOs, branded IDs, RecipeStatus, categorías, dificultad, alérgenos, RecipeRepository interface, Recipe.create, publish, archive, scale, calculateNutrition placeholder).
- Aplicación: 8 use cases (create, update, publish, archive, list, getById, delete, search, scale), Zod schema wizard 3 pasos.
- Infraestructura: DexieRepository (tabla `recipes` v15), mapper.
- UI: RecipesPage, RecipeCard, RecipeDialog wizard, hooks (useRecipes, useCreateRecipe).
- Sidebar: nav "Recetario" en planningNav.
- Router: `/recetas`.

**Implementado como MVP** — wizard manual, sin autocomplete SMAE ni cálculo nutricional automático.

---

## 29. Planificador semanal + lista de compras (módulos 37 y 38)

> **Origen:** Plan §37 y §38. **Fase objetivo:** 2.

### 29.1 Planificador (`meal_plans`, `menus`, `menu_times`, `menu_items`)

**Entidad `MEAL_PLAN`** (expandida del MVP actual):
- `paciente_id`, `consulta_id` (opcional)
- `name`, `type` (daily/weekly/biweekly/monthly)
- `start_date`, `end_date`
- `target_kcal`, `target_protein_pct`, `target_fat_pct`, `target_carb_pct`, `target_fiber_g`
- `times_per_day` (3/4/5/6)
- `pathology`, `restrictions` (JSON), `preferences` (JSON)
- `status` (draft / active / completed / cancelled)
- `smae_version_id` (FK)

**Entidad `MENU`:** meal_plan_id, day_number, date, notes.

**Entidad `MENU_TIME`:** menu_id, time_slot (breakfast/collation/lunch/snack/dinner), order_index, target_kcal.

**Entidad `MENU_ITEM`:** menu_time_id, food_equivalent_id, servings (1.5, 2, etc.), preparation, notes, order_index, is_recipe (boolean).

### 29.2 Distribución automática de macros

- Porcentaje de kcal por tiempo (default: 25% desayuno / 10% colación mañana / 35% comida / 10% colación tarde / 20% cena).
- Ajustable según patología (ej. diabetes: 5 tiempos más balanceados, cena ligera).
- Restricciones: vegetariano, vegano, renal (bajo K, P, Na), diabético (índice glucémico bajo), etc.
- Lista de compras automática: agregar todos los `equivalent_id` del plan, agrupados por grupo SMAE.

### 29.3 Lista de compras (`SHOPPING_LIST`)

- `paciente_id`, `meal_plan_id` (opcional), `menu_ids[]` (opcional)
- `name`, `number_of_people`
- `purchase_unit_pref` (kg / g / pieza / manojo / etc.)
- `total_estimated` (opcional), `currency`
- `content` (JSON con lista agrupada por grupo SMAE)
- `generated_at`

### 29.4 Estado actual

✅ **MVP**: MealPlan con 5 slots, 30 alimentos SMAE, `planCalculations`, distribución básica (Sprint 6).
✅ **Sprint 10**: SlotProgress con barras de kcal + delta vs `DEFAULT_KCAL_DISTRIBUTION`; drag&drop entre tiempos.
✅ **Sprint 15 (expansión)**: WeeklyPlan (plan semanal multi-día con MenuDay), ShoppingList (generación automática desde plan), macroDistribution calculator con ajustes por restricción (diabético, renal), Dexie schema v19 (tablas `weekly_plans`, `shopping_lists`), MealPlannerPage, sidebar nav "Plan semanal".
⏳ **Pendiente futuro**: planificador mensual/cíclico, versionamiento, comparativos entre planes, restricción completa por patología.

---

## 30. Agenda y gestión de citas (módulo 40)

> **Origen:** Plan §40. **Fase objetivo:** 2.

### 30.1 Entidad `APPOINTMENT` (expandida del MVP)

- `paciente_id` (FK), `user_id` (profesional FK)
- `consultorio_id` (opcional, multi-sala)
- `appointment_date`, `start_time`, `end_time`, `duration_min`
- `type` (primera_vez / seguimiento / urgencia / control / cierre)
- `status` (scheduled / confirmed / in_progress / completed / cancelled / no_show / rescheduled)
- `reason`, `notes`
- `consultation_id` (FK cuando se completa)
- `reminder_sent` (boolean), `confirmed_at` (opcional)
- `cancelled_reason` (opcional)
- `rescheduled_from_id` (FK opcional)
- `cost`, `paid`, `payment_method`
- `created_at`, `updated_at`, `version`

### 30.2 Entidades auxiliares

- `SCHEDULE` (horario del profesional): user_id, day_of_week, start_time, end_time.
- `BLOCK` (bloqueos de agenda): user_id, start, end, reason (vacaciones, capacitación, etc.).
- `REMINDER` (recordatorios): appointment_id, sent_at, method (email/SMS), result (delivered/failed).

### 30.3 Flujos

**Agendamiento (5 pasos):** seleccionar paciente → fecha/hora disponible → tipo y duración → motivo y notas → confirmar.

**Reagendado (4 pasos):** seleccionar nueva fecha/hora → marcar original como "reagendada" → crear nueva cita con FK a la original → notificar al paciente.

**Cancelación (5 pasos):** capturar motivo → confirmar → marcar estado → notificar → liberar espacio.

**No asistencia:** sistema marca automáticamente según tiempo → alerta a nutrióloga → intentar contacto (registrar intentos) → decidir acción (reagendar, dar de baja) → registrar en historial.

### 30.4 Reglas de negocio (12 reglas)

- **RN-AGE-01**: cita solo dentro del horario del profesional.
- **RN-AGE-02**: no dos citas del mismo profesional en el mismo horario.
- **RN-AGE-03**: las salas pueden tener agenda propia.
- **RN-AGE-04**: cancelaciones requieren motivo.
- **RN-AGE-05**: reagendado conserva el historial.
- **RN-AGE-06**: no asistencia se marca automáticamente a X minutos después de la hora.
- **RN-AGE-07**: recordatorios se envían según configuración del paciente.
- **RN-AGE-08**: confirmación positiva se registra con timestamp.
- **RN-AGE-09**: citas de primera vez tienen duración más larga.
- **RN-AGE-10**: citas pueden tener costo asociado y estado de pago.
- **RN-AGE-11**: calendario externo (Google/Outlook) es opcional; integración de una vía (sync hacia afuera).
- **RN-AGE-12**: el sistema **no envía SMS/correos** sin acción explícita de la nutrióloga o configuración previa.

### 30.5 Casos especiales

- **Citas recurrentes** (semanal/quincenal): programación múltiple.
- **Citas grupales** (charlas, talleres): múltiples pacientes.
- **Citas a domicilio**: ubicación especial.
- **Citas virtuales** (videollamada): integración con plataforma.
- **Citas en feriado**: advertencia, requiere configuración explícita.
- **Citas urgentes**: prioridad alta, reagendado si es necesario.
- **Lista de espera**: cuando no hay huecos.

### 30.6 Estado actual

✅ Implementado en Sprint 15. Pendiente fino: recordatorios (reminder configurable), citas recurrentes, citas grupales, lista de espera, integración con calendario externo.

---

## 31. Catálogo de medicamentos e interacciones (módulo 42)

> **Origen:** Plan §42. **Fase objetivo:** 3.

### 31.1 Entidad `MEDICATION` (catálogo)

- `nombre_comercial`, `principio_activo`
- `presentacion` (tabletas, cápsulas, jarabe, etc.)
- `concentracion` (ej. 500 mg, 5 mg/5 ml)
- `via_administracion` (oral, IV, IM, SC, tópica, inhalada)
- `categoria_farmacologica`
- `efectos_secundarios` (JSON)
- `interacciones_nutrientes` (JSON: lista de interacciones alimento-medicamento conocidas)
- `interacciones_medicamentos` (JSON)
- `contraindicaciones` (JSON)
- `notas`

### 31.2 Entidad `INTERACCION_NUTRIENTE_MEDICAMENTO`

- `medicamento_id`
- `nutriente` (vit K, calcio, hierro, potasio, etc.) o `alimento_grupo_id`
- `tipo` (reduce_absorcion / aumenta_absorcion / potencia_efecto / antagoniza_efecto / toxicidad)
- `severidad` (leve / moderada / severa)
- `recomendacion` (texto)
- `fuente` (UpToDate, FDA, etc.)
- `fecha_vigencia`

### 31.3 Alertas automáticas (motor de reglas)

- Warfarina + vitamina K (verduras verdes): alerta de INR, sugerir consistencia.
- Tetraciclinas / quinolonas + calcio / hierro: separar 2h de lácteos y suplementos.
- IECA / ARA-II + potasio: vigilar K sérico.
- Metformina + vitamina B12: vigilar déficit a largo plazo.
- Levotiroxina + calcio / hierro: separar 4h.
- Corticoides + calcio / vitamina D: sugerir suplementación.
- Estatinas + pomelo: evitar.

### 31.4 Estado actual

✅ `medications` se almacenan en `patients` (1-N, relacionados al expediente, Sprint 1).
⏳ Catálogo global de medicamentos, interacciones nutriente-medicamento, alertas automáticas. Sprint candidato: **Sprint 20+**.

---

## 32. Generación de documentos profesionales (módulo 43)

> **Origen:** Plan §43. **Fase objetivo:** 2.

### 32.1 Entidad `DOCUMENT`

- `paciente_id` (FK opcional), `consultation_id` (FK opcional)
- `template_id` (FK)
- `type` (clinical_report / meal_plan / shopping_list / recipe_book / consent / referral)
- `title`
- `content_html`, `content_pdf_path` (opcional)
- `parameters` (JSON: rango fechas, pacientes, profesionales, módulos)
- `generated_at`, `generated_by`
- `status` (draft / signed / delivered / voided)
- `signed_at`, `signed_by` (opcional)
- `signature_hash` (opcional, SHA-256)
- `void_reason` (opcional)
- `created_at`, `version`

### 32.2 Entidad `DOCUMENT_TEMPLATE`

- `nombre`, `descripcion`
- `type` (clinical_report, meal_plan, consent, referral, recipe, shopping_list)
- `version`
- `contenido_html` (con placeholders `{{paciente.nombre}}`, `{{consulta.fecha}}`, etc.)
- `parametros_requeridos` (JSON: lista de variables que se deben sustituir)
- `estilos_css` (opcional)
- `header_image`, `footer_image` (opcional)
- `activo`

### 32.3 Entidad `DOCUMENT_SIGNATURE`

- `document_id` (FK)
- `profesional_id`
- `signed_at`
- `signature_data` (imagen de firma o hash)
- `signature_hash` (SHA-256 del documento + firma)
- `ip_address`
- `device_info`
- `certificado_digital` (opcional, para firma avanzada NOM-151)

### 32.4 Flujo de generación (9 pasos)

1. Cualquier módulo → botón **[📄 Generar documento]**.
2. Modal/drawer con plantillas filtradas por contexto.
3. Vista previa en vivo.
4. Personalización (qué incluir).
5. Selección de versión.
6. Preview final.
7. **[Firmar]** → aplica firma digital.
8. **[Descargar]** / **[Enviar al paciente]** / **[Imprimir]**.
9. Registro automático en bitácora.

### 32.5 Tipos de plantillas

- **Reporte de consulta clínica** (nota SOAP completa).
- **Plan de alimentación** (formato paciente con menú semanal).
- **Lista de compras** (agrupada por grupo SMAE).
- **Recetario personalizado** (recetas filtradas por preferencias del paciente).
- **Consentimiento informado** (firma al inicio del tratamiento).
- **Derivación a especialista** (carta formal a médico tratante).
- **Receta médica** (no aplica; el sistema no prescribe).
- **Reporte de evolución** (snapshot comparativo entre 2 consultas).
- **Reporte para instancia regulatoria** (COFEPRIS, Secretaría de Salud).

### 32.6 Estado actual

✅ **MVP implementado (Sprint 15).**
- Dominio: NutriClinicaDocument (entity con estados: draft/signed/delivered/voided, firma digital, versionado), DocumentId branded, 6 tipos de documento, repository interface.
- Aplicación: 7 use cases (create, list, getById, delete, sign, deliver, void), Zod form schema.
- Infraestructura: DexieDocumentRepository, documentMapper, Dexie schema v18 (tabla `documents`).
- UI: DocumentsPage con cards + badges de estado + vista previa HTML.
- Service: documentService.ts.
- Sidebar: nav en Planificación.
- Router: `/documentos`.

**Pendiente futuro:** plantillas con placeholders, vista previa en vivo, firma digital SHA-256 real, envío al paciente, integración con módulos (generar documento desde consulta/plan/receta).

---

## 33. Portal del paciente (módulo 45, PWA)

> **Origen:** Plan §45. **Fase objetivo:** 5 (diferido).

### 33.1 Objetivo

PWA donde el paciente ve su plan, registra adherencia, sube fotos de comidas, agenda citas, recibe recordatorios, descarga documentos firmados. **NO sustituye al escritorio** — es un complemento para consulta remota.

### 33.2 Funcionalidades

- **Vista del plan alimentario** (formato paciente, sin nomenclatura técnica).
- **Registro de comidas** (foto + texto + adherencia 1-5).
- **Auto-reporte de adherencia** (menú, agua, actividad, suplementos, sueño).
- **Agenda de citas** (ver, reagendar, cancelar).
- **Recepción de recordatorios** (configurable: email, push, SMS).
- **Descarga de documentos firmados** (plan, recetas, reportes).
- **Mensajería con la nutrióloga** (asíncrona, no tiempo real).
- **Visualización de evolución** (gráficas de peso, % grasa, perímetro abdominal).

### 33.3 Arquitectura PWA

- React + Vite + TypeScript (mismo stack que escritorio, build separado).
- Service Worker para offline-first.
- IndexedDB local para datos en caché.
- Push notifications vía `tauri-plugin-notifications` (escritorio) o Web Push API (PWA).
- Sincronización con servidor (Fase 3) cuando hay red.

### 33.4 Autenticación

- Magic link por email (sin contraseñas que recordar).
- 2FA TOTP opcional.
- Sesión persistente con refresh token (15 días).

### 33.5 Privacidad

- El paciente solo ve **sus propios datos**.
- Cifrado en tránsito (TLS 1.3) y reposo.
- Consentimiento explícito para compartir datos con la nutrióloga (ya implícito en la relación clínica).
- Logs de acceso del paciente (qué vio, cuándo, desde qué IP).

### 33.6 Estado actual

🔄 **Portal paciente ~95% implementado (Sprints 25A-34 + QA/E2E post-29).**
- Backend: `patient_portal_tokens` en `apps/api/migrations/006-patient-portal.sql` con token SHA-256, expiración, revocación, scopes JSON y `last_accessed_at`.
- Auditoría: `patient_portal_audit_events` en `apps/api/migrations/007-patient-portal-audit.sql`; cada creación, revocación y acceso público inserta evento específico y espejo NOM-024-style en `audit_log` (`entity_type = patient_portal_token`).
- Adherencia portal: `adherence_records` en `apps/api/migrations/008-portal-adherence.sql`; `POST /patient-portal/:token/adherence` crea registros con `source = portal`, scores 0-100, barreras/facilitadores/notas, `submitted_by_token_id` y auditoría `adherence_submitted`.
- API pública: `GET /patient-portal/:token` resuelve paciente+sucursal desde el token, sin JWT profesional, y devuelve resumen, plan activo, próximas citas y documentos; `POST /patient-portal/:token/adherence` también es público pero exige token vigente con scope `adherence`.
- API profesional: `GET /patient-portal/tokens`, `POST /patient-portal/tokens`, `PATCH /patient-portal/tokens/:id/revoke` con JWT + sucursal activa, solo `admin`/`nutriologa` para crear/revocar; la lista incluye `recentEvents` por enlace.
- Documentos portal: descarga/vista previa pública por token con hash SHA-256 y links de preview/download.
- Email portal: `notificaciones_email`, `emailService`, recordatorio de cita, confirmación de adherencia e historial público de notificaciones.
- PWA/offline (Sprint 30): `manifest.webmanifest`, Service Worker app-shell que evita cachear API/documentos, cache local del payload del portal y notificaciones, banner de datos guardados y cola local de adherencia con flush al reconectar.
- Frontend: ruta pública `/portal/:token` fuera de `AppLayout`, cliente `src/services/api/patientPortalApi.ts` con métodos públicos/profesionales/adherencia/email/documentos/mensajería/fotos, UI responsive, card de adherencia pública, `MessagingCard`, `MealPhotosCard`, `PatientPortalLinksCard`, `PatientPortalAdherenceCard`, `PatientMessagingCard`, `PatientMealPhotosCard` y `PatientSubstitutionsCard` en detalle de paciente con historial reciente y traducciones `patient_portal.*`.
- Tests: backend utilities, cliente API público/profesional/adherencia/email/cache offline/mensajería/fotos, scopes default, validación JPEG/PNG/WebP <=2 MB, rechazo GIF/data URL inválida/>2 MB, orden de rutas profesionales antes de `/:token`, UUID estándar de rutas de portal y E2E Playwright público con payload interceptado incluyendo envío de adherencia, recordatorio, notificaciones, mensajes, listado/subida de fotos y fallback offline cacheado.
- Multi-consultorio formal (Sprint 34): `sucursal_id` queda como tenant key formal; `tenantGuards` evita crear consultas, antropometrías, laboratorios, planes y adherencia con pacientes/consultas de otra sucursal; sync valida FKs clínicas y `/sync/push` exige sucursal activa coherente.

**Implementado (Sprint 31):** mensajería asíncrona paciente-nutrióloga con tabla `patient_portal_messages` en `apps/api/migrations/011-patient-messaging.sql`. El paciente envía mensajes mediante `POST /patient-portal/:token/messages` y consulta el historial con `GET /patient-portal/:token/messages` (requiere scope `messaging`). La nutrióloga responde desde el expediente profesional vía `POST /patient-portal/messages`, lista con `GET /patient-portal/messages?pacienteId=...` y marca como leídos con `PATCH /patient-portal/messages/:id/read`. Cuando el paciente envía un mensaje, se notifica al profesional por email mediante el servicio `emailService` y se registra en `notificaciones_email`. En el portal del paciente se agregó `MessagingCard` con burbujas de chat estilo app, polling cada 30s y envío por Enter. En el expediente profesional se agregó `PatientMessagingCard` con vista similar y marcado automático de leídos al visualizar. Los nuevos enlaces del portal incluyen `messaging` en scopes por defecto.

**Implementado (Sprint 32):** fotos de comidas desde portal con tabla `patient_portal_meal_photos` en `apps/api/migrations/012-patient-meal-photos.sql`. El paciente sube JPEG/PNG/WebP <=2 MB con fecha, tiempo de comida, nota y adherencia 1-5 por `POST /patient-portal/:token/meal-photos`; lista y visualiza historial con `GET /patient-portal/:token/meal-photos` y `GET /patient-portal/:token/meal-photos/:id/image` (scope `meal_photos`). La nutrióloga revisa desde expediente con `GET /patient-portal/meal-photos?pacienteId=...`, miniaturas autenticadas y `PATCH /patient-portal/meal-photos/:id/review`. La migración 012 también actualiza constraints de auditoría/email para eventos `message_sent`, `meal_photo_submitted`, `meal_photo_reviewed` y tipo `patient_message`.

**Implementado (Sprint 33):** hardening QA/E2E del portal tras mensajería y fotos. Se exportó y cubrió `parseMealPhotoDataUrl`, se agregaron tests API para scopes `messaging`/`meal_photos`, validación de data URLs y orden de rutas profesionales antes de `/:token`. El E2E público ahora valida mensajes y fotos de comidas además de adherencia/notificaciones/offline. `eslint.config.js` ignora artefactos `dist` generados y el quality gate quedó sin errores de lint.

**Implementado (Sprint 34):** multi-consultorio formal sin migración disruptiva: se consolidó `sucursal_id` como tenant key en las tablas ya existentes. Nuevos `tenantGuards` validan que `paciente_id` y `consulta_id` pertenezcan a la sucursal activa antes de crear registros clínicos y durante sync. `/sync/push` ahora pasa por `requireSucursalAccess` y rechaza batches cuyo `sucursalId` no coincida con la sucursal activa. `pullChanges` también scopa la query de detalle por `sucursal_id`.

**Pendiente futuro:** retención avanzada, consentimientos e interoperabilidad/certificación NOM-024 formal.

---

## 34. Módulo económico (módulo 39)

> **Origen:** Plan §39. **Fase objetivo:** 3.

### 34.1 Entidad `PAYMENT`

- `paciente_id` (FK)
- `consultation_id` (FK opcional)
- `appointment_id` (FK opcional)
- `meal_plan_id` (FK opcional)
- `concept` (consulta / plan / receta / documento)
- `amount`, `currency` (MXN por default)
- `method` (efectivo / transferencia / tarjeta / cheque / otro)
- `status` (pending / paid / partial / refunded / cancelled)
- `paid_at` (opcional)
- `reference` (número de transferencia, autorización de tarjeta, etc.)
- `invoice_number` (opcional, CFDI)
- `invoice_xml` (opcional, ruta cifrada)
- `notes`

### 34.2 Entidad `EXPENSE` (opcional)

- `fecha`, `concept`, `amount`, `currency`, `category` (insumos / equipo / capacitación / etc.), `notes`.

### 34.3 Reglas de negocio

- **RN-ECO-01**: el sistema **no emite facturas CFDI** automáticamente; el nutriólogo es responsable de la facturación.
- **RN-ECO-02**: las citas de primera vez tienen costo configurable por profesional.
- **RN-ECO-03**: los pagos se asocian a la cita o consulta que los originó.
- **RN-ECO-04**: el sistema NO procesa pagos con tarjeta directamente; registra pagos reportados por el paciente.
- **RN-ECO-05**: el reporte financiero mensual es auditable y exportable.
- **RN-ECO-06**: la información económica es accesible solo para el profesional y el administrador.

### 34.4 Reportes financieros

- Ingresos por periodo (diario, semanal, mensual, anual).
- Ingresos por tipo de servicio.
- Ingresos por paciente.
- Pendientes de pago.
- Gráfica de tendencia.
- Exportación a Excel / CSV.

### 34.5 Estado actual

⏳ No implementado. Sprint candidato: **Sprint 21+**.

---

## 35. Resumen del roadmap de detalle funcional

| Módulo | Plan § | Fase | Estado actual | Sprint candidato |
|--------|--------|------|---------------|-------------------|
| 31 Expediente clínico | 22 | 2 | MVP (16 campos) | 12-13 |
| 32 Antropometría | 23 | 2 | MVP (peso/talla/cintura) | 14 |
| 33 Laboratorio | 24 | 2 | MVP (24 códigos México) | 12-13 |
| 34 Seguimiento | 25 | 2 | No | 18-19 |
| 35 Objetivos | 26 | 2-3 | No | 16-17 |
| 36 Recetas | 28 | 2 | No | 18-19 |
| 37 Planificador | 29 | 2 | MVP (5 slots) | 15-16 |
| 38 Lista compras | 29 | 2 | No | 16 |
| 39 Económico | 34 | 3 | No | 21+ |
| 40 Agenda | 30 | 2 | No | 14-15 |
| 41 Adherencia | 27 | 2 | Parcial (cumplimiento percibido) | 15-16 |
| 42 Medicamentos | 31 | 3 | Solo registro en paciente | 20+ |
| 43 Documentos | 32 | 2 | No | 11 (PDF) + 16-17 (firmas) |
| 44 Dashboard | (ya en §20) | 3 | MVP (4 KPIs) | 19-20 |
| 45 Portal paciente | 33 | 5 | Parcial (~95%) | Multi-consultorio formal cerrado; pendiente NOM avanzada |
| 46 Seguridad | (ya en §9) | 3 | MVP (datos locales) | 17-18 |
| 47 Arquitectura técnica | (ya en §6) | 1-3 | MVP | Continuo |

---

## 36. Anexo: SMAE canónico (5 entidades, importador, versionamiento)

> **Origen:** Plan Parte I §1-§8. **Modelo simplificado actual:** §3.6 + §5.1 (Food + FoodGroup con valores nutricionales inline). **Este anexo documenta el modelo canónico** que se alcanzará cuando se implemente el importador Excel/CSV del SMAE 5ª edición oficial (Sprint 12).

### 36.1 Modelo de 5 entidades anidadas (estructura oficial)

```
VERSIÓN_SMAE
  └─ GRUPO (verduras, frutas, cereales, leguminosas, AOA, leche, azúcares, grasas, alimentos libres)
     └─ SUBGRUPO (cuando aplique)
        └─ ALIMENTO (nombre, claves de identificación)
           └─ EQUIVALENTE (cada uno representa 1 porción oficial)
              └─ VALOR_NUTRICIONAL (kcal, P, L, CHO, fibra, micros)
```

### 36.2 `VERSIÓN_SMAE`

- `id`, `nombre` (ej. "SMAE 5ª edición")
- `editorial` (Piensa en Nutrir / autor)
- `año`, `fecha_importacion`, `fecha_activacion`
- `estado` (borrador / activo / histórico)
- `responsable` (profesional que aprobó)

### 36.3 `GRUPO`

- `id`, `version_smae_id` (FK)
- `codigo`, `nombre`, `descripcion`
- `color_ui`, `icono_ui`
- `orden_presentacion`
- `kcal_por_equivalente` (promedio para grupos completos como Verduras)
- `recomendaciones_diarias_min`, `recomendaciones_diarias_max`

### 36.4 `SUBGRUPO`

- `id`, `grupo_id` (FK)
- `codigo`, `nombre`, `descripcion`, `orden`

### 36.5 `ALIMENTO`

- `id`, `subgrupo_id` (FK opcional)
- `nombre`, `nombre_cientifico` (opcional)
- `sinonimos` (lista), `claves_busqueda` (tokens derivados)
- `unidad_habitual` (g, ml, pieza)
- `categoria_especial` (libre, light, integral, etc.)

### 36.6 `EQUIVALENTE`

- `id`, `alimento_id` (FK)
- `porcion_oficial` (valor + unidad)
- `peso_neto_g`, `peso_bruto_g`, `peso_cocido_g` (cuando aplique)
- `metodo_preparacion` (crudo / cocido / al vapor)
- `rend_coccion` (factor)
- `notas`

### 36.7 `VALOR_NUTRICIONAL` (entidad separada, no inline)

- `id`, `equivalente_id` (FK)
- `kcal`, `proteina_g`, `lipidos_g`, `carbohidratos_g`, `fibra_g`, `azucar_g`
- `sodio_mg`, `potasio_mg`, `calcio_mg`, `hierro_mg`, `magnesio_mg`, `zinc_mg`, `fosforo_mg`
- `vitamina_a_ug`, `vitamina_c_mg`, `vitamina_d_ug`, `vitamina_e_mg`, `vitamina_k_ug`
- `tiamina_mg`, `riboflavina_mg`, `niacina_mg`, `b6_mg`, `b12_ug`, `folato_ug`
- `fuente_dato`, `fecha_referencia`

### 36.8 Tablas auxiliares del repositorio

- **`SUSTITUCION_OFICIAL`**: par de equivalentes del mismo grupo con pesos equivalentes, `kcal_macros_iguales` (boolean), cociente macros, nota oficial, fuente.
- **`ALERGENO`** (catálogo): gluten, lactosa, proteína de leche, huevo, cacahuate, frutos secos, soya, pescado, mariscos, trigo.
- **`ETIQUETA_ALIMENTO`**: alimento + tag (vegano, vegetariano, kosher, halal, sin gluten, sin lactosa, orgánico).
- **`RESTRICCION_CLINICA`**: alimento + condición (ERC, diabetes, hipertensión, hiperuricemia, celiaquía) + recomendación (evitar, limitar, permitido).

### 36.9 Datos que NO se almacenan en código (regla crítica)

> **Ningún valor numérico del SMAE debe estar hardcodeado.** Todo proviene de la importación.

- ❌ No hardcodear: kcal de una manzana, proteína de la avena.
- ✅ Sí: lógica de cálculo, validaciones, formato de porción.

### 36.10 Datos que requieren captura manual

- Sinónimos regionales de alimentos.
- Etiquetas culturales (kosher, halal, vegano) si no están en la fuente.
- Rendimientos de cocción específicos del consultorio.
- Precios aproximados por región (módulo económico).

### 36.11 Importación desde Excel (pipeline de 9 pasos)

1. Validación de estructura (encabezados, hojas, tipos).
2. Lectura por lotes.
3. Validación por reglas de dominio (tipos numéricos, rangos esperados, FK, códigos únicos, coherencia macros vs kcal ±5%).
4. Vista previa para la nutrióloga (resumen X alimentos, Y equivalentes, Z alertas).
5. Carga en staging (zona temporal).
6. Validación cruzada (suma macros ~ kcal, sustituciones simétricas, alérgenos consistentes, duplicados).
7. Activación: versión en estado "borrador".
8. Revisión manual + firma digital.
9. Activación oficial (entra a consultas nuevas, conserva histórico).

### 36.12 Hojas del Excel esperado

| Hoja | Contenido |
|------|-----------|
| Metadatos | Versión, editorial, año, fecha, responsable, observaciones |
| Grupos | Código, nombre, orden, kcal_promedio, min_diario, max_diario |
| Subgrupos | Código grupo, código subgrupo, nombre |
| Alimentos | Código, nombre, subgrupo, sinónimo 1, sinónimo 2, unidad habitual |
| Equivalentes | Código alimento, porción, unidad, peso neto/bruto/cocido, método, notas |
| Valores nutricionales | Código equivalente, kcal, P, L, CHO, fibra, azúcar, Na, K, Ca, Fe, Mg, Zn, P, vit A/C/D/E/K, B1/B2/B3/B6/B12, folato, fuente |
| Sustituciones | Código eq 1, código eq 2, notas |
| Alérgenos | Código alimento, alérgeno, severidad (trazas / contiene) |
| Etiquetas | Código alimento, etiqueta |
| Restricciones clínicas | Código alimento, condición, recomendación |

### 36.13 Validaciones automáticas de importación

| Validación | Regla |
|------------|-------|
| Cálculo calórico | (P×4) + (L×9) + (CHO×4) debe coincidir con kcal ±10% |
| Campos obligatorios | Grupo, alimento, equivalente, kcal no pueden estar vacíos |
| Rangos numéricos | kcal entre 0 y 900 por equivalente |
| Coherencia CHO | CHO ≥ fibra, CHO ≥ 0 |
| Códigos únicos | No se permiten códigos duplicados |
| Integridad referencial | Toda FK debe existir |
| Duplicados | Por nombre + grupo |
| Sodio | Advertencia si >800 mg por equivalente |
| Azúcar añadido | Advertencia si el grupo no es "azúcares" pero tiene azúcar alto |

### 36.14 Manejo de errores durante importación

- **Errores bloqueantes**: archivo no se carga; reporte descargable.
- **Advertencias**: archivo se carga en staging; la nutrióloga decide continuar o corregir.
- **Bitácora de importación**: fecha, usuario, versión, total registros, errores, advertencias, hash del archivo.

### 36.15 Importación incremental vs completa

- **Completa**: nueva versión del SMAE (cambio mayor, ej. 5ª → 6ª edición).
- **Incremental**: alta de alimentos individuales, corrección, ajuste de porción (cambio menor).
- Toda importación es **versionada y trazable**.

### 36.16 Versionamiento semántico

- **MAJOR**: cambio de edición (5ª → 6ª).
- **MINOR**: alta/baja de alimentos, nuevos grupos.
- **PATCH**: corrección de valores, ajustes de porción, adición de sinónimos.

### 36.17 Política de convivencia de versiones

- Una sola versión activa por consultorio (configurable).
- Versiones históricas conservadas **indefinidamente** para auditoría de consultas pasadas.
- Toda consulta clínica registra explícitamente qué versión SMAE usó.
- Migración de planes: cuando se cambia de versión, los planes activos deben ser revisados manualmente. El sistema alerta: alimentos dados de baja, equivalentes con valores modificados, diferencias calóricas o de macros.

### 36.18 Proceso de actualización

```
Nueva versión disponible (archivo)
  → Importar como versión "borrador" (no afecta consultas)
  → Comparar contra versión activa (diff)
  → Reporte de impacto: X nuevos, Y modificados, Z eliminados, N planes activos afectados
  → Decisión: revisar plan por plan, ajustar o reemplazar
  → Activar nueva versión
  → La versión anterior pasa a "histórico"
```

### 36.19 Compatibilidad hacia atrás

- Las consultas antiguas siempre se leen con la versión SMAE que tenían al momento de su creación.
- El sistema **no reinterpreta** valores históricos con versiones nuevas.

### 36.20 Manejo de equivalencias oficiales (5 tipos)

- **Equivalencia exacta**: mismo grupo + mismo subgrupo + kcal similares.
- **Equivalencia funcional**: mismo grupo, distinto subgrupo, kcal similares.
- **Equivalencia cruzada**: distinto grupo, pero intercambiables por propósito nutricional.
- **Equivalencia no oficial**: creada por la nutrióloga.
- **No equivalencia**: distinto grupo y propósito.

Cada equivalencia almacena: ID, equivalente A (FK), equivalente B (FK), tipo, diferencia calórica (%), diferencia de macronutrimentos (g), fuente, notas.

### 36.21 Grafo de equivalencias (interno)

- **Nodos**: equivalentes.
- **Aristas**: relación de equivalencia.
- **Pesos**: similitud nutricional.

Permite: encontrar sustitutos en N pasos, detectar comunidades (grupos), calcular diversidad del menú.

### 36.22 Sustituciones: 5 niveles

| Nivel | Tipo | Descripción |
|-------|------|-------------|
| **0** | Oficial automática | Mismo alimento, misma equivalencia, distinta forma de preparación |
| **1** | Oficial misma equivalencia | Mismo grupo + mismo subgrupo, kcal ±5% |
| **2** | Oficial misma equivalencia funcional | Mismo grupo, kcal ±10% |
| **3** | Cruzada validada | Distinto grupo, kcal ±5%, validada por la nutrióloga (queda como "no oficial aprobada") |
| **4** | IA sugerida | Propuesta por módulo IA, requiere aprobación explícita, marcada como "sugerencia IA" |

### 36.23 Algoritmo de sugerencia de sustituciones

```
1. Identificar grupo y subgrupo del alimento a sustituir.
2. Aplicar filtros del paciente (alergias, intolerancias, preferencias, aversiones, presupuesto).
3. Aplicar filtros clínicos (ej. ERC → restringir alimentos altos en potasio).
4. Calcular candidatos:
   - Primero, sustituciones del mismo subgrupo con kcal más cercana.
   - Segundo, mismo grupo con kcal cercana.
   - Tercero, candidatos validados por la nutrióloga previamente.
   - Cuarto, sugerencias de IA (si está activada).
5. Ordenar por similitud (kcal, macros, fibra, sodio, micronutrimentos clave).
6. Mostrar al profesional con explicación de la diferencia nutricional.
```

### 36.24 Trazabilidad de sustitución

Cada sustitución aplicada registra: alimento original, alimento sustituto, tipo (oficial/nivel 1/2/3/4), equivalentes aplicados, diferencia nutricional (antes/después), autor (nutrióloga o IA), fecha y hora, justificación clínica (opcional).

### 36.25 Sustituciones en lote

- "Sustituir todas las apariciones de X por Y" (validación previa de coherencia).
- "Variar menú" (buscar diversidad automáticamente respetando macros y restricciones).

### 36.26 Validaciones a nivel de menú

- Total kcal vs objetivo.
- Distribución de macros vs objetivo.
- Fibra (g y g/1000 kcal).
- Sodio total vs límite.
- Azúcar añadida (% kcal).
- Grasas saturadas y trans.
- Cobertura de grupos SMAE.
- Equivalentes diarios por grupo.
- Micronutrimentos críticos.
- Variedad (≤2 repeticiones del mismo alimento en un día).
- Hidratación sugerida.

### 36.27 Validaciones a nivel de paciente

| Validación | Regla |
|------------|-------|
| Compatibilidad clínica | Ej. ERC + menú alto en potasio → alerta |
| Alergias | Ningún alimento con alérgeno del paciente (bloqueante) |
| Intolerancias | Evitar umbral o marcar advertencia |
| Interacciones fármaco-alimento | Lista validada de medicamentos |
| Embarazo/lactancia | Excluir alimentos de riesgo (pescado alto mercurio, lácteos no pasteurizados, embutidos crudos) |
| Preferencia cultural/religiosa | Excluir según filtros del paciente |
| Presupuesto | Advertencia si ingredientes exceden rango |

### 36.28 Severidad de alertas

- **Bloqueante (rojo)**: impide guardar el menú. Ej. alérgeno presente.
- **Advertencia (amarillo)**: permite guardar con justificación obligatoria.
- **Información (azul)**: nota no obligatoria.

### 36.29 Búsqueda instantánea de alimentos (requisitos)

- Latencia objetivo: **<50 ms** autocompletado, **<200 ms** búsqueda compleja.
- Tolerancia a errores ortográficos.
- Búsqueda por múltiples campos (nombre, sinónimos, grupo, subgrupo, alérgeno, etiqueta).
- Filtrado contextual (por paciente, por tiempo de comida, por grupo).
- Ranking inteligente (frecuencia de uso, favoritos).

### 36.30 Índices de búsqueda

- Índice textual sobre nombre + sinónimos + tokens.
- Índice trigrama para búsqueda tolerante a errores.
- Índice por grupo/subgrupo.
- Índice por alérgenos/etiquetas.
- Índice por frecuencia de uso (top N por paciente y global).

### 36.31 Algoritmo de búsqueda (determinista, sin IA)

```
Entrada: texto del usuario, filtros activos
  → 1. Normalizar texto (minúsculas, sin acentos opcional, tokenización)
  → 2. Búsqueda exacta por prefijo (ranking alto)
  → 3. Búsqueda por tokens (AND de tokens contenidos)
  → 4. Búsqueda difusa (distancia Levenshtein) si hay pocos resultados
  → 5. Aplicar filtros: grupo/subgrupo, alérgenos (excluir), etiquetas (incluir/excluir), calorías (rango), paciente (restricciones)
  → 6. Re-rankear: frecuencia de uso, favoritos del profesional, similitud con el último seleccionado
  → 7. Devolver top N (10-20) en <50 ms
```

### 36.32 Búsquedas especiales

- "Verduras bajas en potasio": filtro por micronutrimento.
- "Sin gluten, alta fibra": filtro combinado.
- "Alimentos que pueden sustituir al pollo": usa el grafo de equivalencias.
- "Todos los alimentos con manzana": por nombre + sinónimos.
- "Lo que más uso": ranking por frecuencia.

### 36.33 Cálculo automático de equivalencias (pipeline)

```
Cantidad ingresada (ej. 150 g de manzana)
  → 1. Identificar alimento y medida
  → 2. Determinar método de preparación (crudo/cocido/al vapor, aplicar factor de rendimiento si es cocido)
  → 3. Obtener peso neto (g) = peso capturado
  → 4. Calcular: número_de_equivalentes = peso_neto / porción_oficial
  → 5. Multiplicar valores nutricionales por número de equivalentes
  → 6. Devolver: equivalentes (con decimales: 1.5, 2.3, etc.), kcal, P, L, CHO, fibra, micros, alérgenos activos, restricciones aplicables al paciente
```

### 36.34 Medidas caseras

- Catálogo de medidas caseras por alimento (pieza, taza, cucharada, rebanada, etc.).
- Relación medida → gramos.
- Si no existe, capturar manualmente y guardar como "medida personalizada".

### 36.35 Redondeo de equivalentes

- Por defecto: 2 decimales (1.50, 2.25, etc.).
- Opcional: redondear a 0.5 (1, 1.5, 2) para simplificar el plan al paciente.
- Configurable por la nutrióloga.

### 36.36 Equivalencias mixtas (alimentos preparados)

Caso especial: un alimento preparado es combinación de varios grupos (ej. tacos al pastor = tortilla + carne + grasa + verdura).

- El sistema permite **descomposición** del alimento en sus ingredientes base.
- Cada ingrediente se calcula por separado.
- La suma conforma el aporte total.

### 36.37 Cálculo inverso (objetivo → alimento)

Dado un objetivo nutricio (ej. necesito 250 kcal de cereal en este tiempo), el sistema puede sugerir:

- "X gramos de A (1.5 eq = 250 kcal)".
- "Y gramos de B (1.2 eq = 248 kcal)".
- "Z gramos de C (1.4 eq = 252 kcal)".

Y se elige el más cercano.

### 36.38 Estado actual

✅ **MVP (Sprint 9)**: 2 entidades (Food, FoodGroup) con valores nutricionales inline, 30 alimentos canónicos hardcoded en `SYSTEM_FOODS.ts`, 16 grupos.
⏳ **Fase 2 (Sprint 12)**: importador Excel/CSV, 5 entidades, versionamiento, búsqueda con ranking, equivalencias.
⏳ **Fase 3**: importador PDF con OCR, parser por laboratorio.

---

## 37. Anexo: Motor de reglas propio (RETE-like, sin IA)

> **Origen:** Plan Parte III §18-§25. **Fase objetivo:** 3.

### 37.1 Filosofía

- Reglas **declarativas**, editables, auditables.
- Ejecución **determinista** y reproducible.
- **Explicable**: "por qué se activó esta regla".
- Tres categorías: validación, sugerencia, bloqueo.

### 37.2 Arquitectura (pipeline)

```
HECHOS (estado del paciente, menú propuesto, contexto)
  → MEMORIA DE TRABAJO (hechos activos)
  → MOTOR DE INFERENCIA
       - Algoritmo RETE-like o similar (en memoria, no recursivo)
       - Prioridad de reglas
       - Encadenamiento hacia adelante
  → REGLAS (base de conocimiento)
  → SALIDAS:
       - Alertas (info, advertencia, bloqueo)
       - Sugerencias (con justificación)
       - Validaciones (cumple/no cumple)
  → EXPLICACIÓN (qué reglas se aplicaron y por qué)
```

### 37.3 Estructura de una regla

```ts
{
  id: "R-DBT-001",
  nombre: "Alerta diabetes: azúcar añadida",
  categoria: "validación clínica",
  prioridad: 80,
  condición: (paciente.tiene_condicion("diabetes")
              AND menu.azucar_anadida_g > 0.10 * menu.kcal / 4),
  acción: {
    tipo: "alerta",
    severidad: "advertencia",
    mensaje: "El menú supera el 10% de kcal en azúcar añadida",
    sugerencia: "Reducir equivalentes de azúcares o sustituir por frutas frescas"
  },
  fuente: "OMS 2015 / Guía de diabetes",
  activa: true
}
```

### 37.4 Categorías de reglas (5)

#### 37.4.1 Seguridad alimentaria (críticas, no desactivables)

- Alergia + alimento → bloqueo.
- Embarazo + mercurio → alerta.
- Embarazo + lácteos no pasteurizados → alerta.
- Inmunocomprometido + alimentos crudos → alerta.

#### 37.4.2 Ajuste por condición clínica

- **ERC**: restricción de potasio, fósforo, proteína (según estadio).
- **Diabetes**: control de CHO, fibra, índice glucémico.
- **Hipertensión**: sodio <2000 mg, alcohol.
- **Dislipidemia**: grasas saturadas <7%, trans=0.
- **Obesidad**: déficit calórico seguro (no <1200 kcal en mujeres, 1500 en hombres).
- **Bajo peso**: superávit, comidas pequeñas y frecuentes.
- **Embarazo**: ácido fólico, hierro, calcio, evitar alcohol.
- **Lactancia**: hidratación, calcio, yodo.
- **Anemia**: hierro, B12, folato, vit C.
- **Osteoporosis**: calcio, vit D, magnesio, proteínas adecuadas.
- **Celiaquía**: cero gluten.
- **Intolerancia a lactosa**: restricción o deslactosados.
- **Hiperuricemia/gota**: restricción de purinas (mariscos, vísceras, alcohol).
- **Gastroparesia**: comidas pequeñas, baja fibra insoluble, baja grasa.
- **Reflujo**: evitar irritantes, fraccionar comidas.
- **SII (FODMAP)**: restricción temporal según tolerancia.

#### 37.4.3 Calidad nutricional

- Cobertura de grupos SMAE.
- Adecuación de fibra.
- Distribución hídrica.
- Micronutrimentos clave.
- Azúcar añadida.
- Sodio total.
- Grasas saturadas y trans.
- Variedad (≤2 repeticiones del mismo alimento en un día).
- Distribución de macros vs objetivo.
- Adecuación calórica ±5%.

#### 37.4.4 Progresión (seguimiento)

- Pérdida de peso máxima: 1% del peso corporal/semana.
- Ganancia muscular: superávit moderado, proteína suficiente.
- Regreso a mantenimiento: gradual, no abrupto.

#### 37.4.5 Sustitución inteligente

- Sugerir mismo grupo.
- Marcar equivalencias validadas vs no validadas.
- Bloquear sustituciones peligrosas (alergia cruzada).

#### 37.4.6 Presentación al paciente

- Lenguaje claro (sin tecnicismos en documentos para paciente).
- Incluir lista de compras.
- Incluir equivalencias visuales (mano, taza, etc.).

### 37.5 Ciclo de vida de las reglas (7 etapas)

1. **Alta**: nutrióloga o desarrollador crea la regla.
2. **Prueba**: suite de casos clínicos.
3. **Validación clínica**: revisión por comité asesor.
4. **Activación**: entra a producción.
5. **Monitoreo**: frecuencia de disparo, falsos positivos.
6. **Refinamiento**: ajustes por retroalimentación.
7. **Deprecación**: reemplazo por nueva versión.

### 37.6 Explicación de decisiones

Cada alerta o sugerencia incluye:

- Regla aplicada (id y nombre).
- Condición que se cumplió (qué valores del paciente/menú dispararon).
- Mensaje claro en lenguaje profesional.
- Recomendación de acción.
- Fuente (guía, autor, fecha).
- Severidad.

La nutrióloga puede: **aceptar** la sugerencia, **rechazarla con justificación**, o **modificar la regla** (avanzado).

### 37.7 Rendimiento del motor

- **Evaluación incremental**: solo reglas afectadas por el cambio.
- **Cache de resultados** durante una sesión de edición.
- **Re-evaluación selectiva** tras cambios relevantes.
- Tiempo objetivo: **<30 ms** para menú completo (<50 alimentos).
- Concurrencia: el motor es **stateless** entre invocaciones; permite paralelismo futuro.

### 37.8 Auditoría del motor

Cada ejecución registra: contexto (paciente, menú, fecha), reglas evaluadas, reglas disparadas, salidas producidas, aceptaciones/rechazos del profesional, hash de integridad.

### 37.9 Capas de seguridad (4)

1. **Capa 1 - Bloqueante**: impide guardar el menú. Ej. alérgeno.
2. **Capa 2 - Advertencia con justificación**: permite guardar con texto obligatorio.
3. **Capa 3 - Información**: nota no obligatoria.
4. **Capa 4 - Sugerencia de mejora**: la nutrióloga puede o no aplicar.

### 37.10 Estado actual

⏳ No implementado. Sprint candidato: **Sprint 15-16 (clinical-engine)**, en conjunto con la integración con los módulos 26 (objetivos) y 24 (laboratorio).

---

## 38. Anexo: Motor de menús (cálculo calorías/macros, ranking, flujo integrado)

> **Origen:** Plan Parte II §9-§17. **Estado actual:** MVP con planCalculations (Sprint 6) y SlotProgress (Sprint 10).

### 38.1 Principios del motor

- **Determinista y auditable**: cada decisión es trazable.
- **Tiempo real**: cualquier cambio actualiza totales en <100 ms.
- **Sin cajas negras**: la nutrióloga ve por qué se sugirió cada cosa.
- **Editable**: el profesional siempre tiene la última palabra.

### 38.2 Cálculo de calorías (5 pasos)

1. **TMB** (selección de fórmula por defecto o por la nutrióloga).
2. **GET = TMB × factor de actividad**.
3. **Ajuste por objetivo**:
   - Mantener: 0%.
   - Pérdida: -10% a -20% (configurable, ritmo seguro).
   - Ganancia: +10% a +15%.
4. **Ajuste por condición clínica**:
   - Embarazo: +1T (1er), +340 kcal (2°), +452 kcal (3°) (IOM).
   - Lactancia: +500 kcal.
   - Lesión/cirugía: +10-20%.
5. **GET ajustado = kcal objetivo diario**.

### 38.3 Distribución por tiempo de comida

Configuración por defecto (modificable):

| Tiempo | Default | Pacientes con 3 tiempos |
|--------|---------|-------------------------|
| Desayuno | 25% | 25-30% |
| Colación AM | 10% | — |
| Comida | 35% | 35-40% |
| Colación PM | 10% | — |
| Cena | 20% | 25-30% |

### 38.4 Cálculo por tiempo

```
kcal_tiempo = GET_ajustado × %_del_tiempo
```

El motor trabaja con el rango (mínimo-máximo) por tolerancia ±5%.

### 38.5 Distribución de macronutrimentos (AMDR)

| Macro | % AMDR | Ejemplos de ajuste |
|-------|--------|---------------------|
| Carbohidratos | 45-65% | 40% en diabetes con CHO controlados; 60% en atleta de resistencia |
| Proteínas | 10-35% | 15-20% general; 20-25% en deporte; 10-15% en ERC avanzada |
| Lípidos | 20-35% | 25-30% general; <30% en dislipidemia; 30% en keto (caso especial) |
| Fibra | 14 g/1000 kcal | 25-30 g estándar; 38 g en hombres; 25 g en mujeres (IOM) |

### 38.6 Cálculo en gramos

```
g_proteína = (GET_ajustado × %_P) / 4
g_grasas = (GET_ajustado × %_L) / 9
g_CHO = (GET_ajustado × %_CHO) / 4
g_fibra = (GET_ajustado / 1000) × 14
```

### 38.7 Verificación de coherencia

```
kcal_calculadas = (g_P×4) + (g_L×9) + (g_CHO×4) + (g_Alcohol×7) - (g_fibra×2) [opcional]
```

Si difiere del GET_ajustado en más de ±5%, ajustar distribución.

### 38.8 Equivalentes objetivo por grupo (default)

| Grupo | Equivalentes/día |
|-------|------------------|
| Verduras | 3-5 |
| Frutas | 2-4 |
| Cereales (sin grasa) | 4-8 |
| Cereales (con grasa) | 2-4 |
| Leguminosas | 1-2 |
| AOA muy bajo aporte graso | 2-3 |
| AOA moderado aporte graso | 2-3 |
| AOA alto aporte graso | 1-2 |
| Leche descremada | 0-2 |
| Leche entera | 0-1 |
| Aceites y grasas | 3-6 |
| Azúcares | 0-2 (limitar) |
| Alimentos libres | ad libitum (no cuentan) |

Rangos ajustables por edad, sexo, condición.

### 38.9 Estructura del día (4 plantillas)

- 3 tiempos (desayuno, comida, cena).
- 4 tiempos (3 anteriores + 1 colación).
- 5 tiempos (desayuno, colación AM, comida, colación PM, cena).
- 6 tiempos (añadir colación nocturna, ej. diabetes o deporte nocturno).

### 38.10 Distribución por grupo y tiempo

El motor reparte los equivalentes diarios entre los tiempos respetando:

- Concentración de carbohidratos en horas activas.
- Proteína distribuida uniformemente.
- Verduras presentes en comida y cena.
- Grasas moderadas en cada tiempo.
- Frutas preferentemente en desayunos y colaciones.

### 38.11 Ranking de alimentos favoritos (determinista, sin IA)

**Mecanismo:**
- Marcador explícito: la nutrióloga marca alimentos como "favoritos" (estrella).
- Contador de uso: cada vez que se agrega al menú, incrementa contador por profesional y por paciente.
- Ranking ponderado:

```ts
score = (favorito ? 100 : 0)
      + (uso_profesional_top10 ? 80 : uso_profesional_top50 ? 40 : 0)
      + (uso_paciente_top10 ? 60 : 0)
      + (preferencia_paciente_match ? 20 : 0)
      + (grupo_objetivo_match ? 30 : 0)
      - (filtro_clinico_bloqueante ? 1000 : filtro_advertencia ? 30 : 0)
```

**Favoritos por condición clínica**: la nutrióloga puede tener favoritos predefinidos por patología ("Favoritos para diabetes", "ERC", "embarazo").

**Favoritos por presupuesto**: si el paciente tiene un presupuesto limitado, se priorizan alimentos económicos dentro del grupo.

### 38.12 Lista negra dinámica por paciente (bloqueante)

Por cada paciente, se construye una lista de bloqueo que combina:

- Alergias (bloqueante, todas las severidades).
- Intolerancias (según severidad: bloqueante o advertencia).
- Aversiones explícitas (bloqueante).
- Restricciones religiosas (bloqueante: cerdo en kosher/halal, carne en vegano).
- Restricciones culturales.
- Interacciones fármaco-alimento (advertencia/bloqueante según severidad).
- Condición clínica + alimento contraindicado (ej. ERC + alto potasio, hiperuricemia + mariscos).

**Mecanismo**: en la búsqueda, los alimentos bloqueados no aparecen por defecto. Existe un toggle "mostrar bloqueados" para casos donde la nutrióloga quiera revisar manualmente. Al intentar agregar un alimento bloqueado, el sistema bloquea la acción y muestra la razón.

**Filtrado por tiempo de comida** (sugerencia, no bloqueo):
- Frutas: desayuno, colaciones, comida, cena.
- Cereales calientes: desayuno, cena.
- Leguminosas: comida, cena (no colación).
- Lácteos: desayuno, colación, cena.
- Verduras: comida, cena, almuerzo.

**Auditoría de bloqueo**: cada intento de agregar un alimento bloqueado queda registrado.

### 38.13 Generación de menú en tiempo real (arquitectura <100 ms)

```
Acción del usuario (agregar/quitar alimento, cambiar cantidad)
  → Capa de presentación: emite evento
  → Capa de aplicación: handler del evento
       1. Validar alimento contra perfil del paciente (<5 ms)
       2. Calcular aporte del cambio (<10 ms)
       3. Actualizar totales del menú (<10 ms)
       4. Recalcular distribución por tiempo (<10 ms)
       5. Ejecutar motor de reglas (<30 ms)
       6. Actualizar UI (<20 ms)
  → Total: <100 ms por interacción
```

### 38.14 Estado del menú en memoria

```ts
type MenuActivo = {
  paciente_id: string;
  fecha: string;
  tiempos: Map<TiempoComida, List<AlimentoEnMenu>>;
  totales: { kcal, P, L, CHO, fibra, sodio, ... };
  alertas: List<Alerta>;
  estado: "borrador" | "validado" | "firmado";
  version_smae: string;
};
```

### 38.15 Flujo de generación integrado (7 fases)

1. **Apertura del paciente**: cargar perfil clínico, alergias, objetivos.
2. **Definición del plan**: selección de fórmula de TMB, factor de actividad, ajuste por objetivo y condición, distribución de macros y tiempos.
3. **Generación del esqueleto**: cálculo de kcal por tiempo, equivalentes por grupo/tiempo, selección inicial de alimentos (favoritos + grupo), vista previa con totales estimados.
4. **Edición iterativa**: agregar/quitar/sustituir alimentos, ajustar cantidades, recálculo en tiempo real, alertas activas del motor.
5. **Validación**: motor experto todas las reglas críticas, verificación de cobertura, verificación de macros, sugerencias finales.
6. **Cierre**: justificaciones pendientes, firma de la nutrióloga, snapshot con versión SMAE, generación de PDF para paciente.
7. **Seguimiento**: bitácora de adherencia en próximas consultas.

### 38.16 Generación automática (esqueleto, algoritmo determinista)

1. Para cada tiempo, para cada grupo prioritario, seleccionar alimento top-N.
2. Verificar que cubra kcal objetivo del tiempo.
3. Ajustar cantidades hasta cumplir.
4. Validar cobertura.
5. Devolver esqueleto sugerido.

### 38.17 Soporte de undo/redo

Cada cambio es reversible. Estado completo del menú en memoria con historial.

### 38.18 Persistencia

- Auto-guardado cada 5 segundos o tras cada cambio mayor.
- Versiones del menú (no se pierde trabajo).
- Al cerrar la app, se recupera el último estado.

### 38.19 Recalculación automática (eventos que disparan recálculo)

| Evento | Acción |
|--------|--------|
| Agregar alimento | Sumar aporte |
| Quitar alimento | Restar aporte |
| Cambiar cantidad | Recalcular diff |
| Sustituir alimento | Comparar aportes |
| Cambiar tiempo de comida | Mover ítem |
| Cambiar objetivo calórico | Reajustar equivalentes |
| Cambiar % de macros | Recalcular distribución |
| Agregar/quitar restricción | Re-evaluar cobertura |

### 38.20 Pipeline de recálculo

```
Evento
  → 1. Identificar qué cambió
  → 2. Obtener aporte nuevo del alimento (de SMAE)
  → 3. Aplicar cambio al estado del menú
  → 4. Recalcular totales del menú
  → 5. Recalcular cobertura de grupos
  → 6. Recalcular distribución por tiempo (% real)
  → 7. Ejecutar motor de reglas (validaciones)
  → 8. Emitir nuevo estado a la UI
  → 9. Persistir (si pasa umbral)
```

### 38.21 Recálculo de impacto global

Si se modifica el objetivo calórico o la distribución:

- Reajustar equivalentes objetivo por grupo/tiempo.
- Marcar qué alimentos exceden o faltan del nuevo objetivo.
- Sugerir ajustes automáticos (que la nutrióloga puede aceptar o rechazar).

### 38.22 Coherencia tras sustitución

- Mostrar diff nutricional (antes/después).
- Si la diferencia >10% en algún macro, mostrar advertencia.
- Sugerir reequilibrio de otros alimentos si es necesario.

### 38.23 Idempotencia y debouncing

- El recálculo es **idempotente**: el mismo evento produce el mismo resultado.
- No hay reentradas infinitas.
- Eventos encolados si vienen en ráfaga (debouncing).

### 38.24 Indicadores de calidad del menú (panel lateral en tiempo real)

- kcal (real vs objetivo, con porcentaje).
- Proteína (g, % kcal, g/kg de peso).
- Lípidos (g, % kcal, saturadas, trans).
- Carbohidratos (g, % kcal, fibra).
- Sodio (mg, vs límite).
- Cobertura SMAE (X/Y grupos).
- Alertas activas (número, severidad).
- Variedad (alimentos únicos vs total).
- Distribución hídrica sugerida.

### 38.25 Estado actual

✅ **MVP (Sprint 6)**: MealPlan con 5 slots, 30 alimentos SMAE, `planCalculations`, `DEFAULT_KCAL_DISTRIBUTION`.
✅ **Sprint 10**: SlotProgress con barras de kcal, delta vs distribución, drag&drop.
⏳ **Fase 2**: motor de ranking, lista negra, undo/redo, generación de esqueleto, recálculo en tiempo real.
⏳ **Fase 3**: motor de reglas completo, equivalencias mixtas, cálculo inverso.

---

## 39. Anexo: Navegación completa, layouts y estrategias de productividad

> **Origen:** Plan Doc 48 §1-§3, §6-§9. **Fase objetivo:** 2-3.

### 39.1 Jerarquía de información (5 niveles)

1. **Nivel 1 - Identidad del paciente** (siempre visible, persistente).
2. **Nivel 2 - Contexto clínico** (motivo, alertas, snapshot).
3. **Nivel 3 - Acción actual** (formulario, captura, plan).
4. **Nivel 4 - Datos derivados** (cálculos, tendencias, totales).
5. **Nivel 5 - Detalle y auditoría** (a un clic de distancia, no por defecto).

### 39.2 Estrategia de navegación (triple eje)

1. **Sidebar principal** (módulos).
2. **Pestañas superiores** (sub-sección dentro del módulo).
3. **Command palette** (saltar a cualquier lugar).

- URLs estables (deep linking, historial de navegador).
- Búsqueda global siempre accesible (Cmd/Ctrl + K).
- Recientes y favoritos en el sidebar.

### 39.3 Estrategia de productividad

- Atajos de teclado para todo lo crítico.
- Autocompletado inteligente en formularios largos.
- Plantillas reutilizables (consulta tipo, menú tipo, receta tipo).
- Snapshots automáticos cada 5 s.
- Command palette al estilo Raycast.
- Quick actions contextuales (botones que aparecen según el objeto seleccionado).
- Multi-selección para acciones en lote.
- Drag & drop donde aplique (alimentos al menú, citas en agenda).

### 39.4 Estrategia offline-first (UI)

- Indicador siempre presente (estado de conexión).
- Modo edición transparente: el usuario nunca nota que está offline.
- Cola de cambios visible pero discreta.
- Resolución de conflictos diferida y asistida.
- Recuperación silenciosa al volver online.

### 39.5 Estrategia para minimizar clics

- Acciones primarias en la barra de herramientas del contexto, no en menús anidados.
- Atajos mnemotécnicos: **P** (paciente), **A** (agenda), **M** (menú), **R** (receta).
- Doble Enter para confirmar valores en formularios rápidos.
- Vista de un solo panel con tabs para sub-flujos.
- Modales solo para confirmaciones críticas, no para acciones rutinarias.
- **In-place editing** en tablas y cards (no abrir drawers para editar).

### 39.6 Árbol de navegación principal completo

```
Inicio
  ├─ Dashboard
  ├─ Pacientes
  │   ├─ Listado
  │   ├─ Nuevo paciente
  │   └─ Ficha de paciente
  │       ├─ Resumen
  │       ├─ Expediente clínico
  │       ├─ Antropometría
  │       ├─ Laboratorios
  │       ├─ Diagnósticos
  │       ├─ Objetivos
  │       ├─ Plan alimentario
  │       ├─ Recetario asignado
  │       ├─ Documentos
  │       ├─ Adherencia
  │       └─ Auditoría
  │   └─ Importar / Exportar
  ├─ Consultas
  │   ├─ Agenda (día, semana, mes)
  │   ├─ Nueva consulta
  │   ├─ Consulta activa (workspace)
  │   └─ Historial de consultas
  ├─ Antropometría
  │   ├─ Captura
  │   ├─ Histórico
  │   ├─ Comparativos
  │   └─ Equipos
  ├─ Laboratorios
  │   ├─ Captura
  │   ├─ Histórico
  │   ├─ Catálogo de parámetros
  │   └─ Reglas de correlación
  ├─ Diagnóstico Nutricional
  │   ├─ Constructor
  │   ├─ Catálogo de diagnósticos
  │   └─ Criterios
  ├─ Objetivos Clínicos
  │   ├─ Por paciente
  │   ├─ Catálogo
  │   ├─ Plantillas
  │   └─ Métricas
  ├─ Plan Alimentario
  │   ├─ Generación
  │   ├─ Edición
  │   ├─ Historial
  │   └─ Validación
  ├─ Motor de Menús
  │   ├─ Generador
  │   ├─ Banco de alimentos (SMAE)
  │   ├─ Sustituciones
  │   ├─ Distribuidor
  │   └─ Validación clínica
  ├─ Recetario
  │   ├─ Catálogo
  │   ├─ Crear receta
  │   ├─ Versiones
  │   ├─ Costos
  │   └─ Asignación a pacientes
  ├─ Lista de Compras
  │   ├─ Generador
  │   ├─ Historial
  │   └─ Plantillas
  ├─ Adherencia
  │   ├─ Registros
  │   ├─ Bitácora de pacientes
  │   ├─ Índice global
  │   └─ Barreras
  ├─ Catálogo SMAE
  │   ├─ Grupos y subgrupos
  │   ├─ Alimentos
  │   ├─ Equivalentes
  │   ├─ Sustituciones oficiales
  │   ├─ Importación
  │   └─ Versionamiento
  ├─ Catálogo de Medicamentos
  │   ├─ Principios activos
  │   ├─ Interacciones
  │   └─ Reglas clínicas
  ├─ Documentos
  │   ├─ Plantillas
  │   ├─ Generador
  │   ├─ Firmados
  │   └─ Entregados
  ├─ Reportes
  │   ├─ Consultorio
  │   ├─ Clínicos
  │   ├─ Operativos
  │   ├─ Financieros
  │   ├─ Regulatorios
  │   └─ Personalizados
  ├─ Portal del Paciente (Fase 5)
  │   ├─ Configuración
  │   ├─ Pacientes activos
  │   └─ Materiales
  ├─ Configuración
  │   ├─ Consultorio
  │   ├─ Profesional
  │   ├─ Usuarios y roles
  │   ├─ Parámetros clínicos
  │   ├─ Catálogos
  │   ├─ Integraciones
  │   └─ Preferencias
  ├─ Seguridad
  │   ├─ Bitácoras
  │   ├─ Respaldos
  │   ├─ Incidentes
  │   ├─ Claves y certificados
  │   └─ Cumplimiento
  └─ Ayuda
      ├─ Documentación
      ├─ Atajos
      ├─ Tutoriales
      └─ Soporte
```

### 39.7 Navegación principal (sidebar)

- Icono + etiqueta.
- Items agrupados por dominio.
- Reordenable por el usuario.
- Colapsable (versión solo iconos).
- Búsqueda rápida en el sidebar (filtrado fuzzy).
- Indicador de alertas en cada item.

### 39.8 Navegación secundaria (tabs)

- Pestañas en la parte superior del workspace.
- Cierre de pestañas con clic en X o swipe lateral.
- Drag para reordenar.
- Persistencia entre sesiones.
- Pestaña activa destacada con línea inferior de color primario.

### 39.9 Breadcrumbs

`Inicio / Pacientes / María González Pérez / Consulta #4 / Plan alimentario`

- Cada segmento es clickeable.
- Truncamiento inteligente en rutas largas.
- Dropdown en cada segmento con elementos hermanos.

### 39.10 Navegación móvil/portal (PWA)

- Bottom navigation bar (5 items principales).
- Menú hamburguesa para el resto.
- Gestures: swipe atrás, pull-to-refresh.
- Sticky header con identidad del paciente.

### 39.11 Estrategia para minimizar clics (reglas operativas)

1. **Acciones primarias en toolbar del contexto**, no en menús anidados.
2. **Atajos mnemotécnicos**: P (paciente), A (agenda), M (menú), R (receta).
3. **Doble Enter** para confirmar valores en formularios rápidos.
4. **Vista de un solo panel con tabs** para sub-flujos.
5. **Modales solo para confirmaciones críticas** (no para acciones rutinarias).
6. **In-place editing** en tablas y cards (no drawers para editar).

### 39.12 Estado actual

✅ **MVP**: sidebar con 11 secciones, command palette (Sprint 7), tabs en paciente/consulta.
⏳ **Fase 2**: persistencia de tabs, reordenable por usuario, atajos mnemotécnicos, plantillas reutilizables.
⏳ **Fase 3**: navegación contextual con IA, deep linking, navegación móvil/portal.

---

## 40. Anexo: Flujos detallados de sync offline, conflictos y casos especiales

> **Origen:** Plan §47.9-§47.10, §5 del plan Parte V, §6.5 conflict resolver. **Fase objetivo:** 3.

### 40.1 Sincronización: 3 modos

- **Online-first**: el cliente consulta al servidor directamente (portal, app).
- **Offline-first**: el cliente tiene copia local; sincroniza cuando hay conexión (desktop, app).
- **Sync bidireccional**: cambios en cliente se propagan al servidor y viceversa.

### 40.2 Estrategia de sincronización

- Timestamps lógicos (Lamport clocks o version vectors).
- Conflict resolution: último en guardar gana con advertencia y bitácora.
- Campos especiales: `updated_at`, `version`, `client_id`.
- Detección de cambios: dirty checking periódico.
- Cola de cambios: outbox pattern.
- Sincronización incremental: por timestamp o cursor.
- Sincronización completa: periódica para reconciliación.

### 40.3 Eventos del sistema

- **Event bus interno** (Redis Streams, NATS, Kafka según escala).
- **Eventos de dominio**: paciente creado, consulta cerrada, etc.
- **Eventos técnicos**: sync solicitada, error, etc.
- **Consumidores múltiples**: notificaciones, auditoría, IA.

### 40.4 Manejo de conflictos

- Detección por timestamp y versión.
- Presentación al usuario cuando hay conflicto.
- Merge automático para campos no críticos.
- Log de todos los conflictos resueltos.

### 40.5 Modo offline: principios

- 100% funcional offline para consulta.
- Sincronización transparente cuando vuelve la conexión.
- Indicador visual de estado de conexión.
- Cola local de cambios pendientes.
- Resolución diferida de conflictos.

### 40.6 Almacenamiento local

- IndexedDB (frontend web).
- SQLite (desktop).
- Realm (móvil).
- Datos sensibles cifrados localmente.
- Cuota de almacenamiento gestionada.

### 40.7 Datos en local (qué se mantiene offline)

- Catálogo SMAE (versión actual).
- Pacientes del profesional.
- Expedientes activos.
- Historial reciente (últimas N consultas).
- Cola de cambios pendientes.

### 40.8 Sincronización al reconectar (5 pasos)

1. Subir cambios locales.
2. Bajar cambios remotos.
3. Reconciliar.
4. Actualizar UI.
5. Notificar al usuario.

### 40.9 Sincronización al reconectar — UI

1. Sistema detecta pérdida de conexión.
2. Banner sutil aparece: "Modo sin conexión".
3. Indicador en status bar: ⬤ Desconectado.
4. Cambios se guardan localmente con timestamp.
5. Indicador de cambios pendientes: "5 cambios por sincronizar".
6. Conexión se restablece.
7. Sistema sube cambios al servidor (con feedback).
8. Sistema baja cambios remotos.
9. Resolución de conflictos (si los hay):
   a) Modal de resolución.
   b) Diff lado a lado.
   c) Elegir versión o merge.
10. Banner "Sincronización completa".
11. Indicador: ⬤ Sincronizado.

### 40.10 Resolución de conflictos — UI (5 pasos)

1. Al detectar conflicto, modal/drawer aparece.
2. Lado a lado:
   a) Versión local (mía).
   b) Versión remota (del servidor).
   c) Diff resaltado.
3. Acciones:
   a) Conservar mía.
   b) Conservar remota.
   c) Merge manual.
4. Confirmación.
5. Bitácora registra decisión.

### 40.11 Caché multinivel (4 niveles)

| Nivel | Tecnología | Uso |
|-------|-----------|-----|
| L1 | Memoria (LRU) | Sesión activa, calculados derivados |
| L2 | IndexedDB (Dexie) / SQLite local | Datos del usuario, catálogo SMAE, configs |
| L3 | Service Worker | Assets estáticos, PWA offline del portal |
| L4 | Servidor (Fase 3) / CDN (Fase 4) | SMAE versionado, datos multi-puesto, assets |

**Estrategia:**

- Cache-aside para lecturas.
- Write-through para escrituras críticas.
- TTL configurable por tipo de dato.
- Invalidación por evento.
- Compresión de datos grandes.

**Datos cacheados:**

- Catálogo SMAE.
- Lista de pacientes activos.
- Configuración.
- Permisos del usuario.
- Datos derivados (cálculos).

### 40.12 Cola de sincronización (SyncQueueItem)

```
├─ id
├─ entity_type (patient, consultation, etc.)
├─ entity_id
├─ operation (create, update, delete)
├─ payload (datos a sincronizar)
├─ status (pending, syncing, completed, failed, conflict)
├─ attempts INTEGER
├─ max_attempts INTEGER (default 10)
├─ next_retry_at TEXT
├─ error NULL
├─ created_at
└─ completed_at
```

**Persistencia**: IndexedDB store `sync_queue`. Lectura al iniciar la app. Escritura en cada mutación. Lectura en cada ciclo de sync.

### 40.13 Algoritmo de sincronización (5 pasos)

1. Detectar estado de red.
2. Si offline → mantener en cola.
3. Si online:
   a) Obtener `last_sync_timestamp`.
   b) Pull: descargar cambios desde `last_sync_timestamp`.
   c) Aplicar cambios remotos (resolviendo conflictos).
   d) Push: enviar cambios locales pendientes.
   e) Actualizar `last_sync_timestamp`.
4. Si error: reintentar con backoff exponencial.

### 40.14 Algoritmo de cola (Enqueue / Dequeue / Retry)

**Enqueue:**
1. Operación de escritura.
2. Crear `SyncQueueItem` con payload.
3. Persistir en IndexedDB.
4. Notificar al SyncEngine.

**Dequeue:**
1. SyncEngine solicita siguiente batch.
2. Items con `status=pending` OR (`status=failed` AND `next_retry_at <= now`).
3. Ordenar por `created_at ASC`.
4. Procesar batch (límite configurable, ej. 20 items).

**Retry:**
1. Si falla, `attempts++`.
2. Si `attempts < max_attempts`: backoff exponencial (1min, 2min, 4min, 8min, ...).
3. Si `attempts >= max_attempts`: marcar como `failed` definitivo + notificar.

### 40.15 Tipos de conflicto (3)

- **Mismo registro, cambios incompatibles**: dos usuarios editaron el mismo campo.
- **Eliminación vs edición**: alguien eliminó mientras otro editaba.
- **Versiones divergentes**: snapshots diferentes.

### 40.16 Estrategias de resolución de conflictos (4)

- **Last-write-wins (default)**: gana la última edición por timestamp.
- **Field-level merge**: combinar campos no conflictivos.
- **Manual**: presentar al usuario las versiones para decidir.
- **Server-wins**: en caso de duda, el servidor prevalece.

### 40.17 UI de resolución de conflictos

```
┌────────────────────────────────────────────────────────────┐
│ Conflicto detectado — Consulta #8                         │
├───────────────────────────┬────────────────────────────────┤
│ Local (mía)               │ Remota (servidor)              │
├───────────────────────────┼────────────────────────────────┤
│ Peso: 72.4 kg             │ Peso: 71.8 kg                  │
│ HbA1c: 8.5%               │ HbA1c: 8.7%                    │
│ Notas: ...                │ Notas: ...                     │
├───────────────────────────┴────────────────────────────────┤
│ [Conservar mía] [Conservar remota] [Combinar] [Ver diff]  │
└────────────────────────────────────────────────────────────┘
```

### 40.18 Manejo de errores de sync

| Error | Acción |
|-------|--------|
| Sin red | Mantener en cola, reintentar al volver |
| Timeout | Marcar como fallido, reintentar con backoff |
| 4xx (cliente) | No reintentar, marcar como error, notificar al usuario |
| 5xx (servidor) | Reintentar con backoff |
| Conflicto | Encolar para resolución manual |
| Datos corruptos | Marcar para revisión, aislar |
| Cuota excedida | Backoff largo, alertar al usuario |

### 40.19 Recuperación

- **Re-sync completo**: ante inconsistencia, forzar sync desde cero.
- **Restore desde snapshot**: si la BD se corrompe, restaurar último snapshot válido.
- **Rebuild cola**: al iniciar, regenerar cola desde log de cambios si es necesario.

### 40.20 Estado actual

✅ **MVP**: 100% offline con IndexedDB; sync diferido a Fase 3.
⏳ **Fase 3**: SyncEngine, SyncQueue, ConflictResolver, EventBus.

---

**Próximo paso recomendado:** reemplazar `README.md` con una versión corta (quickstart + links) y dejar `spec.md` como la fuente de verdad del producto y la arquitectura. Crear las ADRs formales en `docs/decisions/` siguiendo la plantilla de Michael Nygard.

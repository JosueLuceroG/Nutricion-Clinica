# NutriClinica

> Plataforma profesional de nutrición clínica para consultorios.
> Tauri v2 + React 19 + TypeScript.

[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](.github/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![License: UNLICENSED](https://img.shields.io/badge/license-UNLICENSED-red)]()

---

## Estado actual

**Fase 1: MVP foundations (en curso)**

Módulos implementados:

- **Pacientes** — CRUD completo, validaciones Zod, persistencia local, búsqueda y filtros
- **Antropometría** — Registro de mediciones con peso, talla, 8 circunferencias y 7 pliegues cutáneos
  - Cálculos automáticos: BMI, % grasa (Deurenberg), RCC, RCE, suma de pliegues
  - Clasificación OMS/IDF de riesgo cardiovascular
- **Cálculos clínicos** — BMI, BMR (Mifflin-St Jeor + Harris-Benedict), TDEE, distribución de macros
- **Consultas** — Módulo pendiente (siguiente sprint)
- **Planes alimentarios** — Módulo pendiente
- **Laboratorio** — Módulo pendiente

Métricas:

- 93 tests unitarios y de integración (Vitest)
- TypeScript strict mode, 0 errores
- ESLint sin errores
- Build: 1763 módulos → 458KB → 140KB gzip

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19.2 + TypeScript 5.9 + Vite 6.4 |
| Desktop runtime | Tauri 2.11 (Rust) |
| Persistencia local | IndexedDB (Dexie 4) — migrable a SQLite |
| Estado | Zustand 5 (7 stores) |
| Routing | React Router 7 (hash mode para Tauri) |
| Formularios | React Hook Form 7 + Zod 3 |
| UI | shadcn/ui + Radix UI + Tailwind CSS 3 |
| Tablas | TanStack Table 8 |
| Iconos | Lucide React |
| Tests | Vitest 3 + Testing Library + fake-indexeddb |
| Linter | ESLint 9 + typescript-eslint |
| Formatter | Prettier 3 + prettier-plugin-tailwindcss |

---

## Arquitectura

Hexagonal (puertos y adaptadores) con tres capas:

```
┌──────────────────────────────────────────────────────────────┐
│  UI Layer (src/app, src/components, src/modules/*/ui)        │
│  React, RHF, shadcn/ui — sin lógica de negocio              │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│  Application Layer (src/modules/*/application)               │
│  Use cases, Zod schemas — orquesta dominio + infra          │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│  Domain Layer (src/modules/*/domain)                        │
│  Entidades inmutables, VOs, puertos (interfaces)            │
│  CERO dependencias de React, Tauri, IndexedDB, etc.          │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  Infrastructure Layer (src/modules/*/infrastructure)        │
│  Adaptadores: DexiePatientRepository, DexieAnthropometryRepo │
│  Hoy: IndexedDB. Mañana: SQLite vía Tauri commands.         │
└──────────────────────────────────────────────────────────────┘
```

### Inversión de dependencias

```ts
// Dominio define el puerto
export interface PatientRepository {
  save(patient: Patient): Promise<void>;
  findById(id: PatientId): Promise<Patient | null>;
  // ...
}

// Infraestructura implementa el puerto
export class DexiePatientRepository implements PatientRepository { ... }

// Contenedor de DI (src/services/patientService.ts)
const repository: PatientRepository = new DexiePatientRepository(db);
```

Migrar a SQLite (Tauri): **una clase cambia**, dominio/UI/tests intactos.

### Modelo de datos (hoy)

- **Patient** (UUIDv7) — datos personales, contacto, status, soft delete
- **Anthropometry** (UUIDv7) — peso, talla, circunferencias, pliegues, notas
- Tablas en IndexedDB con índices para búsqueda y orden

### Offline-first

- 100% funcional sin conexión
- IndexedDB como capa de persistencia local
- Sync queue (stub actual) preparada para backend HTTP futuro

---

## Estructura del proyecto

```
src/
├── app/                  # Shell de la aplicación
│   ├── layout/           # AppLayout, Sidebar, Header, StatusBar, CommandPalette
│   ├── pages/            # Páginas (pacientes, antropometría, etc.)
│   ├── providers/        # ThemeProvider, NotificationProvider
│   ├── ErrorBoundary.tsx
│   └── router.tsx        # React Router 7 (hash)
├── components/           # Componentes UI genéricos
│   ├── ui/               # shadcn/ui primitives
│   └── layout/           # EmptyState, Breadcrumbs
├── modules/              # Bounded contexts (dominio)
│   ├── patient/
│   │   ├── domain/       # Patient entity, VOs, repository port
│   │   ├── application/  # Use cases, Zod schemas
│   │   ├── infrastructure/  # DexiePatientRepository, mappers
│   │   └── ui/           # PatientForm, hooks de React
│   └── anthropometry/    # Mismo patrón
├── services/             # Adaptadores transversales
│   ├── db/               # Dexie schema
│   ├── patientService.ts # DI container
│   └── anthropometryService.ts
├── store/                # Zustand stores (UI state)
├── utils/
│   ├── cn.ts             # shadcn helper
│   └── calculations/     # BMI, BMR, TDEE, body composition
├── assets/css/           # globals.css con design tokens
└── main.tsx
```

---

## Desarrollo

### Prerrequisitos

- Node.js ≥ 20
- pnpm ≥ 9
- (Para Tauri) Rust stable + Visual Studio Build Tools en Windows

### Setup

```bash
pnpm install
pnpm approve-builds esbuild  # necesario en Windows
```

### Scripts

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Vite dev server (puerto 1420) |
| `pnpm dev:tauri` | Tauri dev (compila Rust, abre ventana nativa) |
| `pnpm build` | Build de producción (TS + Vite) |
| `pnpm build:tauri` | Empaqueta instalador nativo |
| `pnpm test` | Ejecuta tests con Vitest |
| `pnpm test:coverage` | Tests con coverage v8 |
| `pnpm typecheck` | `tsc -b --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm lint:fix` | ESLint con autofix |
| `pnpm format` | Prettier |
| `pnpm e2e` | Playwright E2E tests |

### Convenciones

- **Código en español**: UI, mensajes de error, comentarios de dominio
- **Identificadores en inglés**: variables, funciones, tipos
- **Path aliases**: `@/`, `@app/`, `@components/`, `@modules/`, `@services/`, `@store/`, `@utils/`, `@assets/`
- **Naming**: PascalCase para clases/tipos, camelCase para funciones/variables
- **Tests**: archivo `.test.ts` adyacente al código que prueba
- **UUIDs**: v7 (ordenable por tiempo) para todas las entidades

---

## Roadmap

- [x] **Fase 1 (actual)**: Pacientes, Antropometría, cálculos clínicos
- [ ] **Fase 2**: Consultas, Laboratorio, equivalencias SMAE
- [ ] **Fase 3**: Plan alimentario (drag & drop), motor de reglas, sincronización
- [ ] **Fase 4**: Multi-plataforma, IA asistente, multi-clínica

---

## Seguridad y datos clínicos

- Datos almacenados localmente, sin envío automático
- Estructura preparada para cifrado en reposo (campo `encryption_status` en schema)
- Soft delete con `deleted_at` para auditoría
- Snapshots inmutables de mediciones (no se modifican, se corrigen con nueva medición)
- Validación de entrada con Zod en el boundary UI↔dominio
- TypeScript strict mode previene errores de tipo en datos clínicos

---

## Licencia

UNLICENSED — uso privado.

# NutriClínica

NutriClínica es una plataforma profesional para la gestión integral de consultorios de nutrición clínica. Centraliza pacientes, consultas, mediciones antropométricas, laboratorios, planes alimenticios, agenda, cobros, reportes, documentos, telemedicina y portal del paciente en una experiencia moderna de escritorio/web.

El proyecto está pensado para nutriólogos, clínicas y equipos de salud que necesitan una herramienta rápida, segura y organizada para operar su consulta diaria, dar seguimiento clínico y mantener la información del paciente disponible incluso en escenarios offline-first.

## Funcionalidades Principales

- Gestión de pacientes, historial clínico y expediente nutricional.
- Registro de consultas, mediciones, antropometría y composición corporal.
- Laboratorios, documentos clínicos y seguimiento de indicadores.
- Creación y administración de planes alimenticios.
- Agenda operativa, alertas, notificaciones y pendientes.
- Cobros, pagos, recibos, gastos y reportes administrativos.
- Portal del paciente, telemedicina y soporte para videollamadas.
- Módulos de IA para asistencia clínica y automatización controlada.
- Aplicación desktop con Tauri y frontend moderno en React.

## Stack Técnico

| Capa               | Tecnología                                         |
| ------------------ | -------------------------------------------------- |
| Frontend           | React 19 + TypeScript 5 + Vite 6                   |
| Desktop            | Tauri 2 (Rust)                                     |
| Persistencia local | IndexedDB (Dexie 4)                                |
| Backend            | Express + SQL Server (apps/api)                    |
| Auth               | JWT + Argon2 + 2FA TOTP                            |
| Telemedicina       | WebRTC + WebSocket signaling + AES-GCM grabaciones |
| Tests              | Vitest 3 + Playwright + Testing Library            |
| CI                 | GitHub Actions (typecheck + lint + build + test)   |

## Quickstart

```bash
pnpm install
cp .env.example .env.local
cp apps/api/.env.example apps/api/.env  # editar DB_*, JWT_SECRET y llaves server-side
pnpm --filter @nutriclinica/api migrate
pnpm --filter @nutriclinica/api seed
pnpm --filter @nutriclinica/api dev  # API :3000
pnpm dev              # frontend :1420
pnpm typecheck && pnpm --filter @nutriclinica/api test && pnpm test
pnpm run lint && pnpm run build  # quality gate adicional
pnpm run e2e          # requiere servidores arriba
```

## Operación Segura

- El backend restringe CORS con `CORS_ORIGIN`, deshabilita `x-powered-by`, agrega headers de seguridad y aplica rate limit en login/IA.
- `POST /auth/register` no es público: requiere JWT válido y rol `admin`.
- Los secretos TOTP se cifran server-side. Configura `TOTP_ENCRYPTION_KEY` o `FIELD_ENCRYPTION_KEY` y aplica `apps/api/migrations/019-totp-secret-length.sql`.
- Las llaves de IA viven solo en `apps/api/.env` (`OPENAI_API_KEY`); el frontend llama `POST /ai/complete` autenticado.
- Sync anuncia solo entidades soportadas actualmente: `pacientes`, `consultas`, `antropometrias`, `lab_panels`, `planes_alimenticios`, `adherence_records`.

## Fases completadas

- **Fase 1** MVP foundations (Sprints 1-7)
- **Fase 2** Clinical expansion (Sprints 8-11)
- **Fase 3** Engine, sync, security (Sprints 12-14)
- **Fase 4** Multi-platform, IA (Sprints 23-24)
- **Fase 5** Portal paciente + telemedicina (Sprints 25-43)

## Documentación

- [`spec.md`](spec.md) — especificación completa del producto y arquitectura (~5400 líneas)
- [`docs/roadmap/saas-ux-clinical-sprints.md`](docs/roadmap/saas-ux-clinical-sprints.md) — roadmap operativo SaaS/UX/clínico por sprints
- [`docs/decisions/`](docs/decisions/) — ADRs formales (Michael Nygard)
- [`docs/operations/pre-production-checklist.md`](docs/operations/pre-production-checklist.md) — validación final local y checklist staging/producción
- [`apps/api/.env.example`](apps/api/.env.example) — variables de entorno del backend

## Licencia

UNLICENSED — uso interno.

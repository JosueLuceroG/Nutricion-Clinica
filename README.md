# NutriClínica

> Plataforma profesional de nutrición clínica para consultorios.
> Tauri v2 + React 19 + TypeScript. Offline-first, hexagonal, dominio puro.

## Quickstart

```bash
pnpm install
cp apps/api/.env.example apps/api/.env  # editar credenciales SQL Server
pnpm --filter @nutriclinica/api migrate
pnpm --filter @nutriclinica/api seed
pnpm dev              # frontend :1420
pnpm --filter @nutriclinica/api dev  # API :3000
pnpm test             # 985 frontend + 126 API + 10 E2E
pnpm run typecheck && pnpm run lint && pnpm run build  # quality gate
pnpm run e2e          # requiere servidores arriba
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript 5 + Vite 6 |
| Desktop | Tauri 2 (Rust) |
| Persistencia local | IndexedDB (Dexie 4) |
| Backend | Express + SQL Server (apps/api) |
| Auth | JWT + Argon2 + 2FA TOTP |
| Telemedicina | WebRTC + WebSocket signaling + AES-GCM grabaciones |
| Tests | Vitest 3 + Playwright + Testing Library |
| CI | GitHub Actions (typecheck + lint + build + test ~1107) |

## Fases completadas

- **Fase 1** MVP foundations (Sprints 1-7)
- **Fase 2** Clinical expansion (Sprints 8-11)
- **Fase 3** Engine, sync, security (Sprints 12-14)
- **Fase 4** Multi-platform, IA (Sprints 23-24)
- **Fase 5** Portal paciente + telemedicina (Sprints 25-43)

## Documentación

- [`spec.md`](spec.md) — especificación completa del producto y arquitectura (~5400 líneas)
- [`docs/decisions/`](docs/decisions/) — ADRs formales (Michael Nygard)
- [`apps/api/.env.example`](apps/api/.env.example) — variables de entorno del backend

## Licencia

UNLICENSED — uso interno.

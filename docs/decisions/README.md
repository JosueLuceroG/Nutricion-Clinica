# Architecture Decision Records (ADRs)

This directory contains the formal ADRs for the platform, written in the
[Michael Nygard template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

Each ADR captures a *significant* architectural decision: its context, the
options that were considered, the chosen option, and its consequences.

The authoritative reference for these decisions is `spec.md` §13 (narrative
ADRs). The files in this directory are the *formal* version of the same
decisions, suitable for code review and onboarding.

## Index

| # | Decision | Status | Date |
|---|----------|--------|------|
| [0001](0001-dexie-indexeddb-local-sqlserver-sync.md) | Use Dexie/IndexedDB now with SQL Server sync | Accepted | 2026-05-20 |
| [0002](0002-hash-routing-tauri.md) | Use hash routing for Tauri webview | Accepted | 2026-05-20 |
| [0003](0003-smae-unica-fuente-nutricional.md) | SMAE 5ª edición as the single source of nutritional truth | Accepted | 2026-05-20 |
| [0004](0004-zod-single-source-of-truth.md) | Zod schemas in `application/` as single source of truth for validation | Accepted | 2026-05-20 |
| [0005](0005-soft-delete-immutable-snapshots.md) | Soft delete + immutable snapshots for clinical data | Accepted | 2026-05-20 |
| [0006](0006-branded-ids-uuidv7.md) | Branded ID types (UUIDv7) instead of plain strings | Accepted | 2026-05-20 |
| [0007](0007-service-containers-manuales.md) | Manual service containers, no DI framework | Accepted | 2026-05-20 |
| [0008](0008-zod-preprocess-nan-null-undefined.md) | Zod preprocess for NaN, null, undefined, empty strings (Bug T1) | Accepted | 2026-05-20 |
| [0009](0009-boton-guardar-no-submit.md) | Guardar consulta is `type="button"`, not `type="submit"` (Bug T2) | Accepted | 2026-05-20 |
| [0010](0010-native-checkbox-radix-checkbox.md) | Native `<input type="checkbox">` over shadcn/Radix Checkbox | Accepted | 2026-05-20 |
| [0011](0011-ai-server-side-proxy.md) | Keep AI provider secrets behind the API | Accepted | 2026-06-12 |

## How to add a new ADR

1. Copy the latest NNNN-*.md to `NNNN+1-short-title.md`.
2. Update the status: `Proposed` while under discussion, `Accepted` when
   approved, `Superseded by ADR-NNNN` if replaced.
3. Add a row to the index above.
4. Reference the ADR from `spec.md` (narrative) and from any code that
   depends on it.

## Superseding an ADR

When a decision is reversed, do **not** delete or rewrite the original ADR.
Instead, change its status to `Superseded by ADR-NNNN` and write the new
ADR. The history is the point.

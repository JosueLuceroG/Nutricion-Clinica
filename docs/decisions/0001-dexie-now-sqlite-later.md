# 0001 — Use Dexie/IndexedDB now, migrate to SQLite in Phase 3

* Status: Accepted
* Date: 2026-05-20
* Deciders: José Manuel (lead nutriologist), IA agent
* Source: `spec.md` §13 ADR-001

## Context and Problem Statement

We need a durable client-side storage layer for the nutriology platform that supports
structured queries, indices, transactions, and can scale to ~10k records (patients,
consultations, meal plans, lab results) before requiring a server.

The trade-off is between (a) staying with a JS-only stack that works in any browser
without native compilation, and (b) using a SQL engine that requires Tauri native
build tooling to compile.

## Decision Drivers

* Zero-friction local dev: `pnpm install` + `pnpm dev` must work without VS Build Tools.
* Offline-first: the app must work without internet and without a server.
* Sufficient capacity for solo nutriologist (1k–10k patients) on a laptop.
* The domain layer must not depend on the storage technology (hexagonal architecture).
* Test infrastructure must be fast: in-memory or `fake-indexeddb` for unit tests.

## Considered Options

* **A) Dexie 4 + IndexedDB** — JS-only, no native build, decent query API.
* **B) `tauri-plugin-sql` with SQLite** — proper SQL, requires VS Build Tools on Windows.
* **C) `better-sqlite3` (Node-only)** — fast SQL, but doesn't work in Tauri's webview.

## Decision Outcome

Chosen option: **A) Dexie 4 + IndexedDB**, because the dev environment is Windows
PowerShell 5.1 where VS Build Tools are not guaranteed to be installed, and the data
volume is well within IndexedDB's capacity. The repository pattern (hexagonal) means
the migration to SQLite in Phase 3 will only require writing a new adapter
(`DexiePatientRepository` → `SqlitePatientRepository`), not changing the domain.

### Positive Consequences

* `pnpm dev` works on any machine with Node 24.
* Domain layer is pure (no Dexie imports in `domain/`).
* Tests run in ms with `fake-indexeddb`.
* IndexedDB has automatic persistence (no flush logic).

### Negative Consequences

* No real SQL: complex joins must be done in memory.
* No ACID across tabs (each tab has its own DB).
* Migration to SQLite in Phase 3 will require a data-export step.
* IndexedDB has quirks (e.g., blocked upgrades, quota errors).

## Pros and Cons of the Options

### A) Dexie 4 + IndexedDB

* Good, because zero native build, works everywhere.
* Good, because mature (v4), well-documented, large community.
* Good, because the `liveQuery` API gives reactive queries.
* Bad, because the data model is JS-only (no SQL types).
* Bad, because complex queries degrade at >100k records.

### B) `tauri-plugin-sql` with SQLite

* Good, because real SQL with proper types and joins.
* Good, because SQLite is the de-facto standard for local-first apps.
* Bad, because requires VS Build Tools on Windows to compile native code.
* Bad, because the build step is fragile across dev environments.

### C) `better-sqlite3` (Node-only)

* Good, because fastest SQL in Node.
* Bad, because incompatible with Tauri's webview (V8 sandbox).
* Bad, because not browser-compatible for unit tests.

## Links

* ADR source: `spec.md` §13 ADR-001.
* Hexagonal architecture: `spec.md` §6.5.
* Migration plan: `spec.md` §36.9 (importador SMAE) and §40 (sync).
* Repository pattern: `src/modules/{patient,anthropometry,laboratory,consultation,mealplan,smae}/domain/*Repository.ts`.

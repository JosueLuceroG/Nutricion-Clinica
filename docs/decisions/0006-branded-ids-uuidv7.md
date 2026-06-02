# 0006 — Branded ID types (UUIDv7) instead of plain strings

* Status: Accepted
* Date: 2026-05-20
* Deciders: José Manuel, IA agent
* Source: `spec.md` §13 ADR-006

## Context and Problem Statement

Entity identifiers in the domain are conceptually distinct (`PatientId`,
`ConsultationId`, `MealPlanId`, `FoodId`, ...), but a `string` cannot express that
distinction to the TypeScript compiler. Passing a `ConsultationId` where a
`PatientId` is expected is a real bug class that has bitten us before.

The trade-off is between (a) `string` everywhere (simple, no type safety), and
(b) branded types with their own nominal type and equality semantics.

## Decision Drivers

* Compile-time prevention of `PatientId` ↔ `ConsultationId` mix-ups.
* Free temporal ordering (UUIDv7 encodes the creation timestamp in the first
  48 bits).
* Equality semantics: a branded ID's `equals(other)` method prevents
  `===` mistakes when IDs are wrapped (e.g., from JSON parse).
* Persistence transparency: the wire/storage format is still a plain string.

## Considered Options

* **A) Branded UUIDv7 types per entity** — `PatientId`, `ConsultationId`, etc.
  Generated via `XId.generate()` (UUIDv7) or `XId.fromUnsafe(s)`.
* **B) Plain `string` types** — simplest, but no type safety.
* **C) `nominal` types library (e.g., `brand.ts`)** — generic, but each ID type
  needs to be re-declared.
* **D) UUIDv4 (random) with explicit `createdAt` field** — no temporal
  ordering from the ID itself.

## Decision Outcome

Chosen option: **A) Branded UUIDv7 types per entity**, because UUIDv7 gives us
temporal ordering for free (a `repo.list()` sorted by ID is automatically sorted
by creation time) and the brand prevents mix-ups at compile time. Each ID is a
thin class with `equals()`, `toString()`, and a static `generate()` that calls
`crypto.randomUUID()` (browser-native, UUIDv7-shaped) or `uuidv7()` polyfill.

### Positive Consequences

* Type safety: `PatientId` ≠ `ConsultationId` at compile time.
* Temporal ordering: sort by ID = sort by creation time.
* Equality is by value, not reference (`idA.equals(idB)`, not `===`).
* Wire format is still a plain string (JSON-serializable).

### Negative Consequences

* One small class per entity (~10 lines each).
* `fromUnsafe()` returns a new object every call: must be memoized in React
  dependencies to avoid re-renders (see commit `69fcc35` for the bug we hit).
* Tests must use `equals()` not `===`.

## Pros and Cons of the Options

### A) Branded UUIDv7 types

* Good, because type safety + free temporal ordering.
* Good, because equality semantics are explicit.
* Bad, because each ID class is ~10 lines of boilerplate.

### B) Plain `string` types

* Good, because zero boilerplate.
* Bad, because the compiler cannot help with mix-ups.
* Bad, because ordering requires a separate `createdAt` field and index.

### C) `nominal` types library

* Good, because generic (one library for all IDs).
* Bad, because adds a dependency for ~10 lines of code per ID.
* Bad, because the "branded" type is just a string, so equality is still `===`.

### D) UUIDv4 with explicit `createdAt`

* Good, because no temporal ordering in the ID (no leakage).
* Bad, because `createdAt` is a separate field that must be indexed separately.
* Bad, because UUIDv4 wastes 48 bits that could be a timestamp.

## Links

* ADR source: `spec.md` §13 ADR-006.
* ID classes: `src/shared/domain/BrandedId.ts` (or per-module in
  `src/modules/{patient,consultation,...}/domain/*Id.ts`).
* Bug fix memoization: commit `69fcc35` (`useMemo` in 10 pages where
  `XId.fromUnsafe()` would otherwise return new objects on every render).

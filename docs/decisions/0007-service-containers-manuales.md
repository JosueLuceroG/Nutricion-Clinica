# 0007 — Manual service containers, no DI framework

* Status: Accepted
* Date: 2026-05-20
* Deciders: José Manuel, IA agent
* Source: `spec.md` §13 ADR-007

## Context and Problem Statement

The composition root (where repositories, use cases, and services are wired
together) must be readable, type-safe, and easy to substitute in tests.

The trade-off is between (a) a DI framework (Inversify, tsyringe, nest) with
decorators and container metadata, and (b) a plain TS object with use cases
pre-instantiated.

## Decision Drivers

* Zero magic: the wiring must be readable top-to-bottom in one file.
* Type safety: the compiler must catch mismatches (no `any` in the container).
* Testability: tests must be able to substitute repositories with mocks
  without spinning up a container.
* Zero runtime overhead: no `reflect-metadata`, no decorators.
* Bundle size: Tauri apps with React are already big; we don't need a
  30KB DI framework on top.

## Considered Options

* **A) Manual service objects** — `src/services/patientService.ts` exports
  `patientService = { create: ..., update: ..., list: ..., ... }`.
* **B) InversifyJS** — annotations, container, decorator-heavy.
* **C) tsyringe** — Microsoft's lightweight DI, decorator-based.
* **D) Constructor injection at the React root** — no container, pass
  services via React Context.

## Decision Outcome

Chosen option: **A) Manual service objects**, because the wiring is a one-time
read, the use cases are static (no runtime registration), and the tests can
just construct their own mock service (`const mockSvc: PatientService = { ... }`)
and pass it to a custom React provider. The complexity of a DI framework is
not justified at our scale.

### Positive Consequences

* Wiring is one file per service, ~30 lines, fully typed.
* No `reflect-metadata` polyfill, no decorator magic.
* Tests inject mocks directly: `const svc = makeServiceWith({ patientRepo: mockRepo })`.
* Zero bundle overhead.

### Negative Consequences

* If a service depends on another service, the dependency order is manual
  (mitigated by alphabetical filename ordering: `aService` → `bService`).
* No automatic lifecycle management (but we don't need scopes/lazy init).
* Adding a new use case to a service requires editing the service object.

## Pros and Cons of the Options

### A) Manual service objects

* Good, because zero magic, zero runtime overhead.
* Good, because testable with plain mocks.
* Bad, because no automatic dependency resolution (manual ordering).

### B) InversifyJS

* Good, because mature, full-featured.
* Bad, because requires `reflect-metadata` polyfill (~30KB).
* Bad, because decorator-based, harder to grep.

### C) tsyringe

* Good, because lighter than Inversify.
* Bad, because still decorator-based, still adds bundle size.
* Bad, because the "lightweight" pitch is false at our scale (a 30-line
  manual file replaces the whole framework).

### D) Constructor injection at React root

* Good, because idiomatic React.
* Bad, because every component that needs a service must consume a context,
  adding boilerplate.

## Links

* ADR source: `spec.md` §13 ADR-007.
* Service files: `src/services/{patient,anthropometry,laboratory,consultation,mealplan,smae}Service.ts`.
* Composition root: `src/app/providers.tsx` (provides services via Context).
* Hexagonal architecture: `spec.md` §6.5.

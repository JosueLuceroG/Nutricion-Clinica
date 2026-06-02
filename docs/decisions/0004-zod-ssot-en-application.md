# 0004 — Zod schemas in application/ as single source of truth for validation

* Status: Accepted
* Date: 2026-05-20
* Deciders: José Manuel, IA agent
* Source: `spec.md` §13 ADR-004

## Context and Problem Statement

The boundary between the UI layer and the domain layer is the most error-prone part
of the app: form data arrives as `string | number | null | undefined | NaN`, and the
domain expects strict types (VOs, branded IDs, range-checked numbers).

The trade-off is between (a) ad-hoc validation in each form, (b) a single
declarative schema per use case, and (c) a heavy validation framework.

## Decision Drivers

* Type safety: schemas must infer TypeScript types automatically.
* Reusability: the same schema should validate UI input, API input, and tests.
* Error messages: must be specific per field (no generic "Invalid input").
* Zero coupling: the domain layer must not import Zod (or any UI lib).
* React Hook Form integration: `zodResolver` is the standard.

## Considered Options

* **A) Zod schemas per use case in `application/`** — declarative, type-inferring,
  integrates with RHF via `zodResolver`.
* **B) Yup** — similar feature set, less TypeScript-friendly inference.
* **C) Manual validation in each form** — total control, but repetitive and
  error-prone.

## Decision Outcome

Chosen option: **A) Zod schemas in `application/`**, because the type inference
is the best of any validator in the TS ecosystem, the error structure
(`ZodError.issues[]`) is well-suited for per-field UI messages, and the integration
with React Hook Form via `zodResolver` is a one-liner. The domain layer validates
at construction time (VOs throw on invalid input), but the *schemas* are the
single source of truth for *form input* validation.

### Positive Consequences

* One schema per use case, reused by UI, tests, and (future) API.
* RHF + zodResolver gives type-safe form state with minimal boilerplate.
* Errors are structured: `error.issues[0].path` and `.message` drive the UI.
* Domain stays pure: VOs validate themselves, schemas validate input.

### Negative Consequences

* Schemas must be kept in sync with VOs (drift risk).
* Zod's bundle is ~50KB gzipped (acceptable for a desktop app).
* Edge cases (NaN, null, empty string) require `z.preprocess()` workarounds
  (see ADR-008).

## Pros and Cons of the Options

### A) Zod schemas in `application/`

* Good, because best-in-class TS inference.
* Good, because `z.infer<typeof schema>` gives the form state type.
* Bad, because preprocessing edge cases (NaN, null) is verbose.

### B) Yup

* Good, because mature, large community.
* Bad, because TypeScript inference is weaker (needs `@types/yup`).
* Bad, because no first-class `zodResolver` equivalent for RHF.

### C) Manual validation in each form

* Good, because zero dependencies.
* Bad, because repetitive (`if (!email) return "Required"` × 50 fields).
* Bad, because errors are not structured, so per-field messages are ad-hoc.

## Links

* ADR source: `spec.md` §13 ADR-004.
* Schemas: `src/modules/{patient,anthropometry,laboratory,consultation,mealplan,smae}/application/*Schema.ts`.
* VOs: `src/modules/{patient,anthropometry,laboratory,consultation,mealplan,smae}/domain/*Vo.ts`.
* RHF integration: `src/modules/.../ui/*Form.tsx` (`useForm({ resolver: zodResolver(schema) })`).
* Related: ADR-008 (Zod preprocess for NaN/null).

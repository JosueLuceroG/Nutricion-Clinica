# 0008 — Zod preprocess for NaN, null, undefined, and empty strings (Bug T1)

* Status: Accepted
* Date: 2026-05-20
* Deciders: José Manuel, IA agent
* Source: `spec.md` §13 ADR-008 (Bug T1)

## Context and Problem Statement

Zod's default behavior is to *reject* `null` and `undefined` for non-optional
fields, and to *not* have a sensible default for empty strings. But form inputs
in React Hook Form arrive as `null` for unfilled number fields, `""` for empty
text fields, and `NaN` for invalid number conversions.

The trade-off is between (a) repeating `z.preprocess(...)` everywhere, (b)
defining reusable preprocessors, and (c) accepting all input and validating
in the VO.

## Decision Drivers

* DRY: the same 5 preprocessors appear in 30+ schemas.
* Correctness: `z.literal(NaN)` doesn't work because `NaN !== NaN`; we must
  preprocess to `undefined` before validating.
* Readability: the schema's *intent* (range, format, optionality) must be
  visible, not buried in preprocessing.
* Testability: preprocessors must be unit-testable in isolation.

## Considered Options

* **A) Reusable preprocessors (`optionalText`, `vitalField`, `optionalNumber`)
  in `src/shared/validation/zodPreprocessors.ts`.**
* **B) `z.coerce.number()` everywhere and pray** — fails on `""`, `null`, `NaN`.
* **C) Custom Zod refinement on each field** — verbose, error-prone.
* **D) Drop Zod, validate in the VO** — domain becomes UI-aware.

## Decision Outcome

Chosen option: **A) Reusable preprocessors**, because the same 5 patterns recur
in 30+ schemas, and centralizing them gives us one place to fix bugs and add
tests. The pattern is:

```ts
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().trim().max(max).optional().or(z.literal("")).transform(/* normalize */),
  );

const vitalField = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "number" && Number.isNaN(v) ? undefined : v),
    z.coerce.number().int().min(min).max(max).optional(),
  );
```

### Positive Consequences

* Schemas read like English: `weight: vitalField(0, 500)`.
* One bug fix propagates to 30+ schemas.
* Preprocessors are unit-tested in isolation.
* New devs see the pattern and copy it.

### Negative Consequences

* Preprocessors are an extra layer of indirection (a junior dev might not
  know to use them).
* `z.preprocess` returns `unknown` until the inner schema validates, so
  IDE intellisense is weaker in nested cases.

## Pros and Cons of the Options

### A) Reusable preprocessors

* Good, because DRY, centralized, testable.
* Bad, because a layer of indirection.

### B) `z.coerce.number()` everywhere

* Good, because one-liner.
* Bad, because `""` → `0` (a 5-year-old's age = 0?), `null` → `0` (same).
* Bad, because `NaN` propagates silently.

### C) Custom refinement per field

* Good, because explicit.
* Bad, because repetitive: `z.number().refine(v => !Number.isNaN(v), ...)`
  in 30+ fields.

### D) Validate in the VO

* Good, because the domain is the source of truth.
* Bad, because the VO throws on invalid input, breaking the form's per-field
  error display.
* Bad, because the UI must catch and re-throw, which leaks domain knowledge
  into the UI.

## Links

* ADR source: `spec.md` §13 ADR-008.
* Preprocessors: `src/shared/validation/zodPreprocessors.ts` (to be created
  in Sprint 11 alongside the PDF service).
* Bug T1 commit: `1e158e6`.
* Test: `tests/unit/zodPreprocessors.test.ts` (proposed).
* Related: ADR-004 (Zod SSOT).

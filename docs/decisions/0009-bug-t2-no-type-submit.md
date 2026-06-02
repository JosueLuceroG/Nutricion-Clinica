# 0009 — Guardar consulta is type="button", not type="submit" (Bug T2)

* Status: Accepted
* Date: 2026-05-20
* Deciders: José Manuel, IA agent
* Source: `spec.md` §13 ADR-009 (Bug T2)

## Context and Problem Statement

In the consultation wizard (6 steps, step 5 is the last data-entry step, step 6
is the review), the navigation buttons changed from "Atrás" / "Siguiente"
(both `type="button"`) to "Atrás" / "Guardar consulta" (`type="submit"`).

When the user clicked "Siguiente" in step 5, React re-rendered the navigation
footer. The DOM node at the button's position was reused, but its `type`
attribute changed to `"submit"`. The browser's pending click event was then
re-targeted to the *new* button (the "Guardar" submit), firing the form's
`onSubmit` *before* the user had reached step 6 to review.

The trade-off is between (a) living with the auto-submit bug and adding a
"are you sure" dialog, (b) using `type="submit"` with a guard, and
(c) using `type="button"` and calling `methods.handleSubmit(...)` programmatically.

## Decision Drivers

* Predictability: the user must explicitly click "Guardar" to submit.
* No accidental submissions: a click on "Siguiente" should never save.
* Code clarity: the "Guardar" handler is the same `methods.handleSubmit(...)`
  used in dev tests, so there's only one submit path.
* Browser correctness: avoid the click-re-targeting edge case entirely.

## Considered Options

* **A) `type="button"` with `onClick={() => void onSubmit()}`** — the button
  never triggers form submission via the browser.
* **B) `type="submit"` with a "are you sure" dialog** — adds a step and
  still has the same DOM-replacement edge case.
* **C) Disable submit on step 5 and only enable on step 6** — confusing UX.
* **D) Wrap the wizard in a separate `<form>` per step** — overkill, and
  breaks RHF's state continuity.

## Decision Outcome

Chosen option: **A) `type="button"` with explicit `onClick`**, because it
eliminates the bug at the root: the browser never sees a "submit" button,
so the click event is never re-targeted. The handler is `onClick={() => void
onSubmit()}` where `onSubmit = methods.handleSubmit(onValid, onInvalid)`.

```tsx
<Button type="button" onClick={() => void onSubmit()} disabled={submitting}>
  <Save /> {submitting ? "Guardando…" : "Guardar consulta"}
</Button>
```

### Positive Consequences

* No auto-submit bug: the browser never sees a submit button in the footer.
* One submit path: `methods.handleSubmit(...)` is the only way to submit.
* The button works the same in step 6 (review) as in any other step.
* No DOM-replacement edge case: the button's identity never changes.

### Negative Consequences

* The button does not respond to the Enter key in a text field (Enter would
  submit the form via the default `type="submit"` somewhere else). Mitigation:
  the wizard's text fields are in step 1–5, and "Siguiente" advances with
  a click, so Enter is not expected to submit.

## Pros and Cons of the Options

### A) `type="button"` with explicit onClick

* Good, because eliminates the bug at the root.
* Good, because one submit path.
* Bad, because Enter key in a text field does not submit (acceptable here).

### B) `type="submit"` with confirmation dialog

* Good, because the user gets a second chance.
* Bad, because the bug is still possible (race conditions on re-render).
* Bad, because extra clicks are friction.

### C) Disable submit until step 6

* Good, because the button is visually "safe" before step 6.
* Bad, because the bug is still possible if the disabled state is wrong.
* Bad, because users wonder why "Guardar" is greyed out.

### D) Per-step `<form>`

* Good, because the browser's submit scope is per-step.
* Bad, because RHF's `useForm` must be re-initialized per step (state loss).
* Bad, because validation can't be cross-step (e.g., "all required fields
  in steps 1–5").

## Links

* ADR source: `spec.md` §13 ADR-009.
* Bug T2 commit: `786e9e6`.
* Wizard code: `src/modules/consultation/ui/ConsultationWizard.tsx`.
* Test: `tests/e2e/consultation-wizard.spec.ts` (regression test, to be
  created in Q-03 E2E suite).
* Related: ADR-010 (native checkbox vs Radix Checkbox, also a wizard
  rendering bug).

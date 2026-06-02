# 0010 — Native `<input type="checkbox">` over shadcn/Radix Checkbox

* Status: Accepted
* Date: 2026-05-20
* Deciders: José Manuel, IA agent
* Source: `spec.md` §13 ADR-010

## Context and Problem Statement

The shadcn Checkbox (built on `@radix-ui/react-checkbox`) caused a
`Cannot update a component while rendering` warning in the consultation
wizard's step 3 (vital signs), specifically when the user toggled
"¿Se tomaron signos vitales?". The warning was not blocking but was
emitted on every toggle in dev mode (React 19 strict mode doubles
renders, so the warning appeared 2-3 times per toggle).

The trade-off is between (a) using the shadcn primitive for visual
consistency, (b) using a native `<input type="checkbox">` with Tailwind
styling, and (c) wrapping the native input in a `React.forwardRef`
component to mimic the shadcn API.

## Decision Drivers

* Zero React warnings in dev: the toggle must not emit
  `Cannot update a component while rendering`.
* Visual consistency with the rest of the design system (small, but real).
* Accessibility: focus visible, label associated, keyboard support.
* Bundle size: a native `<input>` is 0 bytes; Radix Checkbox is ~5KB.
* Maintainability: the bug is in Radix, not in our code, so we cannot
  fix it directly.

## Considered Options

* **A) Native `<input type="checkbox">` with Tailwind classes** —
  `accent-primary`, `focus-visible:ring-1`, label associated.
* **B) shadcn Checkbox (Radix)** — visual consistency, but emits the warning.
* **C) Custom checkbox component wrapping native `<input>` with
  `React.forwardRef`** — same as A, but with the shadcn API surface.
* **D) File an issue upstream and wait** — indefinite wait.

## Decision Outcome

Chosen option: **A) Native `<input type="checkbox">` with Tailwind
classes**, because the bug is in Radix and not ours to fix, the visual
difference is minor (`accent-primary` looks identical to the Radix
checkbox in the default theme), and the bundle savings are real. We
can re-introduce Radix Checkbox later if the upstream bug is fixed
and we re-test in isolation.

```tsx
<label className="flex items-center gap-2">
  <input
    type="checkbox"
    {...methods.register("vitalsEnabled")}
    className="h-4 w-4 accent-primary focus-visible:ring-1 focus-visible:ring-ring"
  />
  <span>¿Se tomaron signos vitales?</span>
</label>
```

### Positive Consequences

* Zero React warnings on toggle.
* Smaller bundle (no Radix Checkbox in this code path).
* Accessibility is preserved (label associated, focus visible, keyboard).
* No `forwardRef` boilerplate.

### Negative Consequences

* Visual consistency: the native checkbox may differ slightly from
  Radix's in older browsers (acceptable in Tauri 2.11 with WebView2).
* No `indeterminate` state (we don't need it: vitals are either
  taken or not).
* If we later need a switch component, we'll face the same trade-off
  and apply the same rule (native first, Radix if needed).

## Pros and Cons of the Options

### A) Native `<input type="checkbox">`

* Good, because zero warnings, zero bundle cost.
* Good, because accessibility is built-in.
* Bad, because visual style is browser-default (mitigated with `accent-primary`).

### B) shadcn Checkbox (Radix)

* Good, because visual consistency with the rest of the design system.
* Good, because controlled/uncontrolled API is well-designed.
* Bad, because emits `Cannot update a component while rendering` in
  React 19 strict mode + wizard context.
* Bad, because the bug is upstream and not fixable by us.

### C) Custom wrapper around native input

* Good, because same API as shadcn (easy to swap back later).
* Bad, because boilerplate for a 5-line input.
* Bad, because the wrapper itself can introduce the same warning if
  not careful.

### D) File upstream and wait

* Good, because the "right" solution in an ideal world.
* Bad, because indefinite wait, and we need to ship now.

## Links

* ADR source: `spec.md` §13 ADR-010.
* Wizard code: `src/modules/consultation/ui/ConsultationWizard.tsx`,
  step 3 vital signs toggle.
* Radix issue: https://github.com/radix-ui/primitives/issues
  (search for "Cannot update a component while rendering" + Checkbox).
* Related: ADR-009 (T2 auto-submit bug, also a wizard rendering edge case).
* Design system: `spec.md` §8.6.

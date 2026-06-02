# 0005 — Soft delete + immutable snapshots for clinical data

* Status: Accepted
* Date: 2026-05-20
* Deciders: José Manuel, IA agent
* Source: `spec.md` §13 ADR-005

## Context and Problem Statement

Clinical data is legal evidence. In Mexico, a nutriologist's records can be requested
by COFEPRIS, by a patient's lawyer, or in a malpractice claim. Deleting a record
(because of a typo or a wrong click) destroys the audit trail; correcting a record
without preserving the original destroys the patient's history.

The trade-off is between (a) hard delete + overwrites (simple, but lossy), and
(b) soft delete + immutable snapshots (more complex, but lossless).

## Decision Drivers

* Legal: NOM-024 requires preserving clinical records with full edit history.
* Clinical: a wrong weight or wrong diagnosis must be traceable to when it was
  entered and who entered it.
* Simplicity: the data model must remain understandable to a single dev.
* Performance: queries on the live UI must not slow down with audit data.

## Considered Options

* **A) Soft delete (`deletedAt`) + immutable snapshots** — never physically delete;
  corrections create a new row with a `supersedesId` pointer.
* **B) Hard delete + audit log** — physical delete, but emit a log entry.
* **C) Event sourcing** — store only events, project current state.
* **D) Hard delete + edit-in-place** — simplest, but loses history.

## Decision Outcome

Chosen option: **A) Soft delete + immutable snapshots**, because the
implementation cost is small (one timestamp field + one `withXxx()` method per
VO) and the legal/clinical benefits are non-negotiable. Every VO is immutable:
corrections produce a new instance via `withXxx()`, and the old row stays
with `deletedAt` set to the correction time.

### Positive Consequences

* No data is ever lost: audit, legal, and clinical review are possible.
* VOs are immutable, which prevents entire classes of bugs.
* Soft delete is filterable: `repo.list()` returns `deletedAt === null` only.
* Snapshots are cheap: UUIDv7 IDs give free temporal ordering.

### Negative Consequences

* Tables grow indefinitely: a 5-year-old patient may have 50+ consultation
  rows, all retained.
* Queries must remember to filter `deletedAt === null` (mitigated by a
  `BaseRepository.findActive()` method).
* Migration to SQLite (Phase 3) must preserve the same model.

## Pros and Cons of the Options

### A) Soft delete + immutable snapshots

* Good, because lossless, legally defensible.
* Good, because VOs are immutable, preventing in-place mutation bugs.
* Bad, because tables grow unbounded.

### B) Hard delete + audit log

* Good, because tables stay small.
* Bad, because reconstructing the state at a past date is hard.
* Bad, because the audit log is a separate source of truth (drift risk).

### C) Event sourcing

* Good, because mathematically pure, time-travel debugging.
* Bad, because massive over-engineering for a solo dev's app.
* Bad, because every query requires a projection.

### D) Hard delete + edit-in-place

* Good, because the simplest model.
* Bad, because destroys legal evidence.
* Bad, because patients cannot see the history of their own records.

## Links

* ADR source: `spec.md` §13 ADR-005.
* Immutable VOs: `src/modules/{patient,anthropometry,laboratory,consultation,mealplan,smae}/domain/*Vo.ts`.
* Soft delete convention: `BaseRepository.findActive()` (in repo interfaces).
* NOM-024 compliance: `spec.md` §32 (Documentos clínicos).
* Idempotencia saves (IK-02): pendiente dedup por `consultationNumber` o UUID.

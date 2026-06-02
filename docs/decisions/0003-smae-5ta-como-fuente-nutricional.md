# 0003 — SMAE 5ª edición as the single source of nutritional truth

* Status: Accepted
* Date: 2026-05-20
* Deciders: José Manuel (lead nutriologist), IA agent
* Source: `spec.md` §13 ADR-003

## Context and Problem Statement

Meal plans in the app must express food portions in a way that is clinically meaningful
to Mexican nutriologists, comparable across patients, and culturally appropriate.

The trade-off is between (a) using raw calories and macros (universal but impersonal),
and (b) using **equivalencias SMAE** (Mexico's official nutritional education system,
5ª edición, 2014).

## Decision Drivers

* Clinical credibility: Mexican nutriologists learn with SMAE in their university
  training. Plans that don't use equivalencias look "amateur".
* Interchangeability: equivalencias let patients swap foods within a group
  (e.g., 1 manzana ↔ 1 pera mediana) without breaking the plan's macro targets.
* Cultural fit: SMAE groups ("verduras", "leguminosas", "AOA", etc.) match how
  patients think about food.
* Auditability: a meal plan expressed in equivalencias can be reviewed by another
  nutriologist in seconds.

## Considered Options

* **A) SMAE 5ª edition equivalencias** — official Mexican standard, 5 entities
  (VERSIÓN_SMAE → GRUPO → SUBGRUPO → ALIMENTO → EQUIVALENTE → VALOR_NUTRICIONAL).
* **B) Raw calories + macros** — universal, but requires manual food swaps to be
  re-calculated.
* **C) USDA FoodData Central** — richer nutrient coverage, but US-centric and
  not aligned with Mexican clinical practice.

## Decision Outcome

Chosen option: **A) SMAE 5ª edición equivalencias**, because the user is a Mexican
licensed nutriologist whose patients and peers expect this format. We embed the
SMAE 5ª as a *first-class bounded context* (`src/modules/smae/`), and **never**
hardcode nutritional values: every macro comes from the `VALOR_NUTRICIONAL` table
for a given `ALIMENTO` × `EQUIVALENTE` pair.

### Positive Consequences

* Plans are clinically credible and inter-exchangeable.
* The importador SMAE (Sprint 12) will load the official 5ª-edition Excel into the
  5-entity model.
* The motor de reglas (Sprint 14) can reason in equivalencias ("paciente necesita
  3 equivalentes de verdura al día").

### Negative Consequences

* We depend on the 5ª-edition Excel being available and well-formed.
* The 5-entity model is more complex than the current 2-entity model
  (Food + FoodGroup with inline values) — migration is in Sprint 12.
* New foods require adding a `VALOR_NUTRICIONAL` row, not just a constant.

## Pros and Cons of the Options

### A) SMAE 5ª edición equivalencias

* Good, because it's the Mexican clinical standard.
* Good, because equivalencias enable patient-friendly swaps.
* Bad, because the 5-entity model is heavier to maintain.

### B) Raw calories + macros

* Good, because simpler data model.
* Bad, because plans are not inter-changeable across patients/nutriologists.
* Bad, because patients in Mexico expect "equivalentes", not "kcal".

### C) USDA FoodData Central

* Good, because richer nutrient coverage (vitamins, minerals).
* Bad, because not aligned with Mexican clinical practice.
* Bad, because US portion sizes and food names confuse Mexican patients.

## Links

* ADR source: `spec.md` §13 ADR-003.
* Canonical 5-entity model: `spec.md` §36 (SMAE canónico).
* Current simplified model: `src/modules/smae/domain/{Food,FoodGroup}.ts`.
* Migration plan: Sprint 12 (importador Excel).
* Rule "never hardcode nutritional values": `spec.md` §36.9.

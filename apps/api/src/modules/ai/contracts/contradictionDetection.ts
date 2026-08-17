/** Detección determinista de contradicciones estructurales. No es un motor de razonamiento diagnóstico. */
export type ContradictionSeverity = 'critical' | 'warning' | 'info';

export interface Contradiction {
  id: string;
  severity: ContradictionSeverity;
  reason: string;
  references: string[];
}

export interface ContradictionInput {
  /** Dos valores bajo la misma referencia con valores incompatibles. */
  values?: Array<{ ref: string; value: unknown; observedAt?: string; recordDate?: string }>;
  /** Incompatibilidades declaradas por metadata (ej. sexo/genero incompatibles, fechas inválidas). */
  metadataIncompatibility?: Array<{ ref: string; detail: string }>;
  /** Fechas de fuentes que invalidan comparaciones (comparación entre ventanas distintas). */
  sourceDates?: Array<{ ref: string; date?: string; compareKey?: string }>;
  /** Contradicciones explícitas detectadas por validadores deterministas. */
  explicitClaims?: Array<{ ref: string; contradictsRef: string; detail: string }>;
}

function hashOf(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join('|');
}

export function detectContradictions(input: ContradictionInput): Contradiction[] {
  const contradictions: Contradiction[] = [];

  for (const claim of input.explicitClaims ?? []) {
    contradictions.push({
      id: `ctr-${hashOf(claim.ref, claim.contradictsRef)}`,
      severity: 'critical',
      reason: claim.detail,
      references: [claim.ref, claim.contradictsRef],
    });
  }

  for (const item of input.metadataIncompatibility ?? []) {
    contradictions.push({
      id: `ctr-meta-${hashOf(item.ref)}`,
      severity: 'warning',
      reason: item.detail,
      references: [item.ref],
    });
  }

  const byRef = new Map<string, NonNullable<ContradictionInput['values']>>();
  for (const value of input.values ?? []) {
    const list = byRef.get(value.ref) ?? [];
    list.push(value);
    byRef.set(value.ref, list);
  }
  for (const [ref, list] of byRef) {
    if (list.length > 1) {
      const serialized = list.map((v) => JSON.stringify(v.value));
      if (new Set(serialized).size > 1) {
        contradictions.push({
          id: `ctr-val-${hashOf(ref)}`,
          severity: 'critical',
          reason: `Valores incompatibles para '${ref}' dentro de la misma fuente`,
          references: list.map((v) => `${ref}@${v.observedAt ?? v.recordDate ?? 'unknown'}`),
        });
      }
    }
  }

  const datesByKey = new Map<string, NonNullable<ContradictionInput['sourceDates']>>();
  for (const date of input.sourceDates ?? []) {
    const key = date.compareKey ?? 'default';
    const list = datesByKey.get(key) ?? [];
    list.push(date);
    datesByKey.set(key, list);
  }
  for (const [key, list] of datesByKey) {
    if (list.length > 1) {
      const dated = list.filter((d) => Boolean(d.date));
      if (dated.length === list.length) {
        const uniqueDates = new Set(list.map((d) => d.date)).size;
        if (uniqueDates > 1) {
          contradictions.push({
            id: `ctr-date-${hashOf(key)}`,
            severity: 'warning',
            reason: `Fuentes con fechas distintas invalidan la comparación (${key})`,
            references: list.map((d) => d.ref),
          });
        }
      }
    }
  }

  return contradictions;
}
/**
 * retrieval-policy-v2: expansion determinista de sinonimos/abreviaturas.
 * Sin embeddings: capa lexica controlada y versionada.
 * La expansion NO expande permisos: los filtros de seguridad se aplican antes.
 */
export const RETRIEVAL_POLICY_VERSION = 'retrieval-policy.v2';

const SYNONYM_GROUPS: readonly string[][] = [
  ['sodio', 'sal', 'cloruro'],
  ['potasio', 'k'],
  ['hipertension', 'hta', 'presion arterial', 'presion alta'],
  ['diabetes', 'dm', 'glucosa', 'azucar en sangre', 'glicemia'],
  ['imc', 'indice de masa corporal', 'masa corporal'],
  ['calorias', 'kcal', 'energia'],
  ['proteinas', 'proteina'],
  ['fibra', 'fibra dietetica'],
  ['vitamina d', 'calciferol'],
  ['omega 3', 'omega-3', 'aceite de pescado'],
  ['trigliceridos', 'tg', 'triglicerido'],
  ['hdl', 'colesterol bueno'],
  ['ldl', 'colesterol malo'],
  ['ayunas', 'en ayunas', 'glucosa en ayunas'],
  ['porcion', 'porciones', 'racion'],
  ['manzana', 'fruta'],
  ['zanahoria', 'verdura'],
  ['smae', 'sistema mexicano de alimentos equivalentes'],
  ['intolerancia', 'intolerancias', 'lactosa'],
  ['desnutricion', 'bajo peso'],
  ['obesidad', 'exceso de peso'],
  ['rehidratacion', 'hidratacion', 'agua'],
];

const SYNONYM_INDEX = new Map<string, string[]>();

for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    const existing = SYNONYM_INDEX.get(term) ?? [];
    SYNONYM_INDEX.set(term, [...new Set([...existing, ...group.filter((g) => g !== term)])]);
  }
}

/** Expande un termino a sus sinonimos (si existen); si no, lo deja tal cual. Siempre incluye el original. */
export function expandTerm(term: string): string[] {
  return [term, ...(SYNONYM_INDEX.get(term) ?? [])];
}

/** Expande una lista de terminos manteniendo el original primero. */
export function expandTerms(terms: string[]): string[] {
  return terms.flatMap((term) => expandTerm(term));
}

/** Frases sinonimas (multi-palabra) presentes en la consulta: anade los terminos del grupo. */
export function expandPhraseMatches(query: string): string[] {
  const extra: string[] = [];
  const lower = ` ${query.toLowerCase().replace(/\s+/g, ' ')} `;
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      if (term.includes(' ') && lower.includes(` ${term} `)) {
        for (const sibling of group) {
          if (sibling !== term && !extra.includes(sibling)) extra.push(sibling);
        }
      }
    }
  }
  return extra;
}

export function hasSynonymGroup(term: string): boolean {
  return SYNONYM_INDEX.has(term);
}

/** Fingerprint del diccionario: cambia con cualquier sinonimo editado. */
export function synonymPolicyFingerprint(): string {
  let hash = 0x811c9dc5;
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      for (let i = 0; i < term.length; i += 1) {
        hash ^= term.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
    }
  }
  return `${RETRIEVAL_POLICY_VERSION}-fnv1a-${hash.toString(16).padStart(8, '0')}`;
}
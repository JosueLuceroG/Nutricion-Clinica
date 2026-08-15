export const ESCALATION_MARKERS: readonly string[] = [
  'sangrado',
  'sangre',
  'desmayo',
  'desmayos',
  'perdida del conocimiento',
  'dolor intenso',
  'dolor toracico',
  'dolor en el pecho',
  'falta de aire',
  'dificultad para respirar',
  'vomito',
  'vomitos',
  'vomite',
  'fiebre',
  'quemadura',
  'reaccion alergica',
  'alergia grave',
  'medicamento',
  'medicamentos',
  'insulina',
  'cancer',
  'embarazo',
  'accidente',
  'convulsion',
  'convulsiones',
  'diabetes',
  'urgencia',
  'emergencia',
  'suicidio',
  'autolesion',
];

export interface EscalationDecision {
  escalate: boolean;
  matchedTerms: string[];
}

export function classifyEscalation(query: string): EscalationDecision {
  const lowered = query.toLowerCase();
  const matchedTerms = ESCALATION_MARKERS.filter((marker) => lowered.includes(marker));
  return { escalate: matchedTerms.length > 0, matchedTerms };
}

export const UNSAFE_OUTPUT_PATTERNS: readonly string[] = [
  'usted tiene',
  'usted padece',
  'usted sufre',
  'diagnostico',
  'diagnostica',
  'su enfermedad',
  'usted esta enfermo',
  'esta enfermo de',
  'cura',
  'curar',
  'tratamiento medico',
  'dosis',
  'suspenda',
  'deje de tomar',
  'reemplace su medicamento',
  'tome su medicamento',
  'es grave',
  'puede ser mortal',
];

export interface SafeLanguageReport {
  unsafe: boolean;
  flags: string[];
}

export function safeLanguageCheck(content: string): SafeLanguageReport {
  const lowered = content.toLowerCase();
  const flags = UNSAFE_OUTPUT_PATTERNS.filter((pattern) => lowered.includes(pattern));
  return { unsafe: flags.length > 0, flags };
}
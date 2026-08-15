import type { PatientContext } from './contextBuilder.js';
import { calculateBmi } from './calculators.js';
import { GOLDEN_RULES } from './goldenRules.js';

export type SafetySeverity = 'info' | 'warning' | 'blocker';

export interface SafetyFlag {
  id: string;
  severity: SafetySeverity;
  ruleId: string;
  message: string;
}

export interface SafetyReport {
  flags: SafetyFlag[];
  hasBlocker: boolean;
  requiresReferral: boolean;
}

const REFERRAL_KEYWORDS = [
  'embarazo',
  'lactancia',
  'diabetes',
  'insulina',
  'enfermedad renal',
  'insuficiencia renal',
  'erc',
  'insuficiencia cardiaca',
  'trastorno de la conducta alimentaria',
  'trastorno alimenticio',
  'desnutricion',
  'cancer',
];

function matchesReferralKeyword(conditions: string[]): string | undefined {
  return REFERRAL_KEYWORDS.find((keyword) => conditions.some((c) => c.toLowerCase().includes(keyword)));
}

function severityFor(value: number): SafetySeverity {
  if (value < 14 || value >= 60) return 'blocker';
  if (value < 16 || value >= 35) return 'warning';
  return 'info';
}

export function assessPhysiological(input: {
  weightKg?: number;
  heightM?: number;
  ageYears?: number;
}): SafetyReport {
  const flags: SafetyFlag[] = [];
  if (input.weightKg !== undefined && (input.weightKg < 25 || input.weightKg > 350)) {
    flags.push({ id: 'phys_weight', severity: 'blocker', ruleId: 'gsr-03', message: `Peso fuera de rango fisiologico: ${input.weightKg} kg` });
  }
  if (input.ageYears !== undefined && (input.ageYears < 2 || input.ageYears > 110)) {
    flags.push({ id: 'phys_age', severity: 'blocker', ruleId: 'gsr-03', message: `Edad fuera de rango de la regla: ${input.ageYears} anos` });
  }
  if (input.weightKg !== undefined && input.heightM !== undefined && input.heightM > 0) {
    const bmiResult = calculateBmi(input.weightKg, input.heightM);
    const severity = severityFor(bmiResult.value);
    if (severity !== 'info') {
      flags.push({ id: 'phys_bmi', severity, ruleId: 'gsr-03', message: `IMC ${bmiResult.value} (${bmiResult.category})` });
    }
  }
  return {
    flags,
    hasBlocker: flags.some((f) => f.severity === 'blocker'),
    requiresReferral: flags.some((f) => f.severity === 'blocker' || f.severity === 'warning'),
  };
}

export function assessContext(ctx: PatientContext): SafetyReport {
  const flags: SafetyFlag[] = [];
  const keyword = matchesReferralKeyword(ctx.conditions);
  if (keyword) {
    flags.push({ id: 'ctx_referral', severity: 'warning', ruleId: 'gsr-03', message: `Condicion del paciente asociada a revision profesional: ${keyword}` });
  }
  if (ctx.ageYears !== undefined && ctx.ageYears < 18) {
    flags.push({ id: 'ctx_minor', severity: 'warning', ruleId: 'gsr-03', message: 'Paciente menor de edad: el consejo requiere supervision profesional' });
  }
  return {
    flags,
    hasBlocker: flags.some((f) => f.severity === 'blocker'),
    requiresReferral: keyword !== undefined || ctx.ageYears !== undefined && ctx.ageYears < 18,
  };
}

export function checkOutputNumbers(content: string, allowedNumbers: number[]): SafetyReport {
  const allowed = new Set(allowedNumbers);
  const flags: SafetyFlag[] = [];
  const matches = content.match(/-?\d+(?:\.\d+)?/g) ?? [];
  for (const raw of matches) {
    const num = Number(raw);
    if (Number.isNaN(num)) continue;
    const significant = Math.abs(num) >= 50 || raw.includes('.');
    if (!significant || allowed.has(num)) continue;
    flags.push({ id: 'out_unverified_number', severity: 'blocker', ruleId: 'gsr-02', message: `Numero sin respaldo en la evidencia: ${raw}` });
  }
  return {
    flags,
    hasBlocker: flags.length > 0,
    requiresReferral: false,
  };
}

export function combineSafety(...reports: SafetyReport[]): SafetyReport {
  const flags = reports.flatMap((r) => r.flags);
  return {
    flags,
    hasBlocker: flags.some((f) => f.severity === 'blocker'),
    requiresReferral: reports.some((r) => r.requiresReferral),
  };
}

export function safetyRulesForPrompt(): string {
  return GOLDEN_RULES.filter((r) => r.category === 'safety')
    .map((r) => `- [${r.id}] ${r.rule}`)
    .join('\n');
}
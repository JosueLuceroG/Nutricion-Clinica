/**
 * Auto-disable del shadow (Build 09 §24). Zero-tolerance + degradacion continua.
 * Umbrales CONFIGURABLES (nunca inventados como validados clinicamente).
 * Solo transiciona a AUTO_DISABLED; nunca se revierte solo.
 */

export interface ShadowAutoDisableConfig {
  unsafeMax: number;
  criticalDisagreementMax: number;
  shouldHaveAbstainedMax: number;
  citationInvalidMax: number;
  agreementMin: number;
  minSamples: number;
}

export function readShadowAutoDisableConfig(env: NodeJS.ProcessEnv = process.env): ShadowAutoDisableConfig {
  return {
    unsafeMax: Number(env.AI_SHADOW_AUTODISABLE_UNSAFE_MAX ?? 0),
    criticalDisagreementMax: Number(env.AI_SHADOW_AUTODISABLE_CRITICAL_DISAGREEMENT_MAX ?? 0),
    shouldHaveAbstainedMax: Number(env.AI_SHADOW_AUTODISABLE_SHOULD_HAVE_ABSTAINED_MAX ?? 0),
    citationInvalidMax: Number(env.AI_SHADOW_AUTODISABLE_CITATION_INVALID_MAX ?? 1),
    agreementMin: Number(env.AI_SHADOW_AUTODISABLE_AGREEMENT_MIN ?? 0.6),
    minSamples: Number(env.AI_SHADOW_AUTODISABLE_MIN_SAMPLES ?? 5),
  };
}

export interface ShadowReviewMetric {
  label: string;
  criticalDisagreement: boolean;
  unsafe: boolean;
  citationValid: boolean | null;
}

export interface AutoDisableDecision {
  disable: boolean;
  triggerCode: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | null;
  value: number | null;
  threshold: number | null;
  message: string;
}

function ratio(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}

export function evaluateAutoDisable(reviews: ShadowReviewMetric[], cfg: ShadowAutoDisableConfig): AutoDisableDecision {
  if (reviews.length < cfg.minSamples) {
    return { disable: false, triggerCode: null, severity: null, value: null, threshold: null, message: `muestra insuficiente: ${reviews.length}/${cfg.minSamples}` };
  }

  const unsafe = reviews.filter((r) => r.unsafe).length;
  if (unsafe > cfg.unsafeMax) {
    return { disable: true, triggerCode: 'ZERO_TOLERANCE_UNSAFE', severity: 'CRITICAL', value: unsafe, threshold: cfg.unsafeMax, message: `outputs inseguros: ${unsafe}` };
  }

  const critical = reviews.filter((r) => r.criticalDisagreement).length;
  if (critical > cfg.criticalDisagreementMax) {
    return { disable: true, triggerCode: 'ZERO_TOLERANCE_CRITICAL_DISAGREEMENT', severity: 'CRITICAL', value: critical, threshold: cfg.criticalDisagreementMax, message: `desacuerdos criticos: ${critical}` };
  }

  const shouldHave = reviews.filter((r) => r.label === 'SHOULD_HAVE_ABSTAINED').length;
  if (shouldHave > cfg.shouldHaveAbstainedMax) {
    return { disable: true, triggerCode: 'ZERO_TOLERANCE_SHOULD_HAVE_ABSTAINED', severity: 'CRITICAL', value: shouldHave, threshold: cfg.shouldHaveAbstainedMax, message: 'deberia haberse abstenido sin hacerlo' };
  }

  const citationInvalid = reviews.filter((r) => r.citationValid === false).length;
  if (citationInvalid > cfg.citationInvalidMax) {
    return { disable: true, triggerCode: 'CITATION_INVALID_COLLAPSE', severity: 'WARNING', value: citationInvalid, threshold: cfg.citationInvalidMax, message: 'citas invalidas persistentes' };
  }

  const agreement = ratio(reviews.filter((r) => r.label === 'ACCEPTED').length, reviews.length);
  if (agreement < cfg.agreementMin) {
    return { disable: true, triggerCode: 'AGREEMENT_COLLAPSE', severity: 'WARNING', value: agreement, threshold: cfg.agreementMin, message: `acuerdo ${(agreement * 100).toFixed(0)}% bajo minimo` };
  }

  return { disable: false, triggerCode: null, severity: null, value: null, threshold: null, message: 'sin condiciones de auto-disable' };
}
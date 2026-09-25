/**
 * Gate de modelos del shadow (Build 09 §15).
 * - FALLO-CERRADO: sin modelo elegible -> BLOCKED; la ejecucion real NO ocurre.
 * - SHADOW_TEST_QUALIFIED_* es el modelo FALSO deterministico (GOLDEN) que
 *   demuestra el camino tecnico; no es un modelo clinico real.
 * - Cualquier modelo no calificado (p.ej. llama3.2 en test) -> DENIED
 *   MODEL_NOT_ELIGIBLE_FOR_SHADOW con 0 llamadas a provider.
 */

export interface ShadowModelGateResult {
  allowed: boolean;
  provider: string | null;
  model: string | null;
  reason: 'QUALIFIED' | 'DENIED_MODEL_NOT_ELIGIBLE_FOR_SHADOW' | 'DENIED_NO_ELIGIBLE_MODEL';
  engine: 'GOLDEN' | 'PROFESSIONAL';
}

export function resolveShadowModel(executionModel: string, env: NodeJS.ProcessEnv = process.env): ShadowModelGateResult {
  const qualifiedProvider = env.SHADOW_TEST_QUALIFIED_PROVIDER;
  const qualifiedModel = env.SHADOW_TEST_QUALIFIED_MODEL;

  if (!qualifiedProvider || !qualifiedModel) {
    return { allowed: false, provider: null, model: null, reason: 'DENIED_NO_ELIGIBLE_MODEL', engine: 'PROFESSIONAL' };
  }

  if (executionModel === qualifiedModel) {
    return { allowed: true, provider: qualifiedProvider, model: qualifiedModel, reason: 'QUALIFIED', engine: 'GOLDEN' };
  }

  return { allowed: false, provider: null, model: null, reason: 'DENIED_MODEL_NOT_ELIGIBLE_FOR_SHADOW', engine: 'PROFESSIONAL' };
}
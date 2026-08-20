/**
 * Muestreo deterministico (Build 09 §16). Sin fracciones inventadas: configurable
 * via AI_SHADOW_SAMPLE_RATE (0.0..1.0). El hash de la ejecucion mantiene la
 * misma decision de muestreo para la misma executionId (estable, trazable).
 */

export function readShadowSampleRate(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.AI_SHADOW_SAMPLE_RATE ?? 0.0);
  if (!Number.isFinite(raw)) return 0.0;
  return Math.min(1, Math.max(0, raw));
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function shouldSampleShadow(executionId: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const rate = readShadowSampleRate(env);
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  const bucket = fnv1a(`shadow:${executionId}`) / 0xffffffff;
  return bucket < rate;
}

export function sampleDecision(executionId: string, env: NodeJS.ProcessEnv = process.env): { sampled: boolean; rate: number; bucket: number } {
  const rate = readShadowSampleRate(env);
  const bucket = fnv1a(`shadow:${executionId}`) / 0xffffffff;
  return { sampled: bucket < rate, rate, bucket };
}
import { emitTelemetry } from '../observability/telemetryService.js';

/**
 * NUMERIC_CONTRADICTION (Build 09): detector determinista de contradicciones
 * numericas entre el dato fuente y el valor declarado. No es un motor de
 * razonamiento: solo compara numeros estructurados. Si el modelo declara un
 * valor que contradice el dato disponible, se emite telemetria y el flujo
 * superior decide abstencion/bloqueo.
 */

export interface NumericClaim {
  ref: string;
  declared: number | null;
}

export interface NumericSource {
  ref: string;
  value: number;
  unit?: string;
  observedAt?: string;
}

export interface NumericContradictionResult {
  contradictory: boolean;
  reason: string | null;
  ref: string | null;
  declared: number | null;
  source: number | null;
}

const EPSILON = 1e-9;

export function detectNumericContradiction(claims: NumericClaim[], sources: NumericSource[]): NumericContradictionResult {
  const byRef = new Map<string, NumericSource>();
  for (const s of sources) byRef.set(s.ref, s);

  for (const claim of claims) {
    if (claim.declared === null) continue;
    const source = byRef.get(claim.ref);
    if (!source) continue;
    if (Math.abs(claim.declared - source.value) > EPSILON) {
      return {
        contradictory: true,
        reason: `declarado ${claim.declared} contradice fuente ${claim.ref} (${source.value})`,
        ref: claim.ref,
        declared: claim.declared,
        source: source.value,
      };
    }
  }
  return { contradictory: false, reason: null, ref: null, declared: null, source: null };
}

export function detectAndReportNumericContradiction(
  claims: NumericClaim[],
  sources: NumericSource[],
  executionId: string,
): NumericContradictionResult {
  const result = detectNumericContradiction(claims, sources);
  if (result.contradictory) {
    emitTelemetry({
      eventType: 'ai.numeric_contradiction',
      executionId,
      status: 'contradiction',
      reasonCode: 'CONTRADICTORY_DATA',
      counts: { contradictions: 1 },
    });
  }
  return result;
}
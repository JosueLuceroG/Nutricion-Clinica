import { readSpecializationConfig, type SpecializationConfig } from './config.js';
import { buildEvidenceSnapshot } from './specializationEvidence.js';
import { evaluateCandidate } from './specializationPolicy.js';
import { selectSpecializationLedger } from './specializationLedger.js';
import { defaultSpecializationCandidates } from './specializationCandidates.js';
import type { EvaluationVerdict, EvidenceSnapshot, SpecializationCandidate, SpecializationLedger } from './specializationTypes.js';

export type SpecializationResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

export interface SpecializationServiceOptions {
  ledger?: SpecializationLedger;
  candidates?: SpecializationCandidate[];
  config?: (env?: NodeJS.ProcessEnv) => SpecializationConfig;
  now?: () => Date;
}

export interface CandidateSummary {
  candidate: SpecializationCandidate;
  latestDecision: EvaluationVerdict | undefined;
}

export class SpecializationService {
  private readonly ledger: SpecializationLedger;
  private readonly candidates: SpecializationCandidate[];
  private readonly config: (env?: NodeJS.ProcessEnv) => SpecializationConfig;
  private readonly now: () => Date;

  constructor(options: SpecializationServiceOptions = {}) {
    this.ledger = options.ledger ?? selectSpecializationLedger();
    this.candidates = options.candidates ?? defaultSpecializationCandidates();
    this.config = options.config ?? readSpecializationConfig;
    this.now = options.now ?? (() => new Date());
  }

  listCandidates(): SpecializationCandidate[] {
    return this.candidates;
  }

  async listSummaries(env: NodeJS.ProcessEnv = process.env): Promise<SpecializationResult<CandidateSummary[]>> {
    const config = this.config(env);
    if (!config.enabled) return this.fail(503, 'Especializacion deshabilitada');
    const summaries: CandidateSummary[] = [];
    for (const candidate of this.candidates) {
      let latest: EvaluationVerdict | undefined;
      try {
        latest = await this.ledger.latestDecision(candidate.id);
      } catch {
        return this.fail(503, 'Almacen de especializacion no disponible');
      }
      summaries.push({ candidate, latestDecision: latest });
    }
    return { ok: true, value: summaries };
  }

  async evaluate(candidateId: string, env: NodeJS.ProcessEnv = process.env): Promise<SpecializationResult<{ verdict: EvaluationVerdict; evidence: EvidenceSnapshot }>> {
    const config = this.config(env);
    if (!config.enabled) return this.fail(503, 'Especializacion deshabilitada');
    const candidate = this.candidates.find((c) => c.id === candidateId);
    if (!candidate) return this.fail(404, 'Candidato desconocido');
    const evidence = buildEvidenceSnapshot(config.passRates);
    const verdict = evaluateCandidate(candidate, evidence, this.now());
    try {
      await this.ledger.recordDecision(verdict);
    } catch {
      return this.fail(503, 'Almacen de especializacion no disponible');
    }
    return { ok: true, value: { verdict, evidence } };
  }

  private fail(status: number, error: string): SpecializationResult<never> {
    return { ok: false, status, error };
  }
}
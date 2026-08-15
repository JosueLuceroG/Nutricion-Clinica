import { randomUUID } from 'node:crypto';
import { nutritionExpertWorkflow, type NutritionAdviceInput, type NutritionAdviceResult, type NutritionWorkflow } from '../expert/nutritionWorkflow.js';
import type { ClinicalGateConfig } from './config.js';

export interface ShadowRun {
  id: string;
  requestId: string;
  pacienteId: string;
  sucursalId: string;
  actor: string;
  runAt: string;
  served: boolean;
  result: NutritionAdviceResult;
}

export interface ShadowModeOptions {
  workflow?: NutritionWorkflow;
  rand?: () => number;
  now?: () => Date;
  id?: () => string;
}

export class ShadowMode {
  constructor(private readonly options: ShadowModeOptions = {}) {}

  shouldShadow(config: ClinicalGateConfig): boolean {
    if (!config.shadowModeEnabled) return false;
    return (this.options.rand ?? Math.random)() < config.shadowSampleRate;
  }

  async run(input: NutritionAdviceInput, actor: { profesionalId: string; role: string }, opts: { served: boolean; force?: boolean }): Promise<ShadowRun | null> {
    const result = await (this.options.workflow ?? nutritionExpertWorkflow).run(input, actor);
    if (result.status === 'ai_unavailable') return null;
    const now = this.options.now ?? (() => new Date());
    const id = this.options.id ?? randomUUID;
    return {
      id: id(),
      requestId: id(),
      pacienteId: input.pacienteId,
      sucursalId: input.sucursalId,
      actor: actor.profesionalId,
      runAt: now().toISOString(),
      served: opts.served,
      result,
    };
  }
}

export const shadowMode = new ShadowMode();
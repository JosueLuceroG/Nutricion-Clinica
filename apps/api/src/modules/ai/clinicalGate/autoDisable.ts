import { readClinicalGateConfig, type ClinicalGateConfig } from './config.js';
import type { ClinicalReviewStore } from './reviewStore.js';

export class ClinicalAutoDisable {
  constructor(
    private readonly store: ClinicalReviewStore,
    private readonly config: (env: NodeJS.ProcessEnv) => ClinicalGateConfig = readClinicalGateConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async isAutoDisabled(sucursalId: string | null): Promise<boolean> {
    const cfg = this.config(process.env);
    try {
      const since = new Date(this.now().getTime() - cfg.windowDays * 24 * 60 * 60 * 1000);
      const count = await this.store.countCriticalDisagreements({ sucursalId, since });
      return count >= cfg.disagreementThreshold;
    } catch (err) {
      console.warn('[clinical] gate check failed, fail-closed:', err instanceof Error ? err.message : err);
      return true;
    }
  }
}

export function createClinicalAutoDisable(store: ClinicalReviewStore): ClinicalAutoDisable {
  return new ClinicalAutoDisable(store);
}
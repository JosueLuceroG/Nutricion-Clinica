/**
 * Ring buffer de eventos de selección de modelo (Build 07.5).
 * Solo metadata NO-PHI: proveedor/modelo/fingerprint/razones/gates.
 */

export interface ModelSelectionEvent {
  ts: string;
  mode: 'NUTRICLINICA_LOCAL_AUTO' | 'ORGANIZATION_PREFERRED' | 'EXPLICIT_APPROVED_MODEL';
  capabilityId: string;
  selectedProvider: string | null;
  selectedModel: string | null;
  deploymentFingerprint: string | null;
  reason: string;
  abstained: boolean;
  setupRequired: boolean;
  cloudFallbackAllowed: boolean;
  excludedSummary: Array<{ candidateId: string; reasons: string[] }>;
  hardwareClass: string;
  correlationId?: string;
}

export class ModelSelectionObservability {
  private readonly buffer: ModelSelectionEvent[] = [];
  constructor(private readonly maxEntries = 200) {}

  record(event: ModelSelectionEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.maxEntries) {
      this.buffer.splice(0, this.buffer.length - this.maxEntries);
    }
  }

  recent(limit = 20): ModelSelectionEvent[] {
    return this.buffer.slice(-limit);
  }

  all(): ModelSelectionEvent[] {
    return this.buffer.slice();
  }

  clear(): void {
    this.buffer.length = 0;
  }
}

export const modelSelectionEvents = new ModelSelectionObservability();
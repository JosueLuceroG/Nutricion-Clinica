export const EGRESS_POLICY_VERSION = 'egress.v1';

export interface EgressManifest {
  manifestId: string;
  executionId: string;
  userId: string | null;
  role: string | null;
  sucursalId: string | null;
  patientRef: string | null;
  capability: string;
  purpose: string;
  provider: string;
  model: string;
  providerLocationType: 'local' | 'external' | 'unknown';
  dataCategories: string[];
  fieldGroups: string[];
  redactionApplied: boolean;
  pseudonymizationApplied: boolean;
  consentReference: string | null;
  decision: 'ALLOW' | 'DENY';
  reasonCodes: string[];
  policyVersion: string;
  occurredAt: string;
}
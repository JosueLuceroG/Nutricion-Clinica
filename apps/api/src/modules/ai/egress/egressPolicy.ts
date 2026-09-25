import { randomUUID } from 'node:crypto';
import { getCapabilityContract } from './capabilityContracts.js';
import { isCategoryDefined } from './dataCategories.js';
import { collectAllowedFields, emptyFor, filterByAllowlist } from './filterByAllowlist.js';
import { EGRESS_POLICY_VERSION, type EgressManifest } from './egressManifest.js';
import { InMemoryEgressManifestStore, SqlEgressManifestStore, type EgressManifestStore } from './egressManifestStore.js';
import { compareResidency, getProviderDataPolicy, type ProviderLocationType } from './providerDataPolicy.js';
import { pseudonymizePatientRef } from './pseudonymizer.js';
import { redactFreeText } from './redactor.js';
import { evaluateEgress } from '../aiEgressPolicy.js';
import { getConsentStatus, getPatientNames, type ConsentStatusResult } from '../aiConsent.js';

export type EgressReasonCode =
  | 'kill_switch'
  | 'provider_denied'
  | 'model_denied'
  | 'unknown_capability'
  | 'provider_phi_not_allowed'
  | 'provider_not_approved_for_clinical_data'
  | 'missing_patient_scope'
  | 'consent_missing'
  | 'consent_revoked'
  | 'consent_unverifiable'
  | 'residency_mismatch'
  | 'residency_unknown';

export interface EgressEvaluationInput {
  capability: string;
  provider: string;
  model: string;
  patientId?: string;
  sucursalId?: string;
  actor?: { profesionalId?: string; role?: string };
  systemPrompt: string;
  userPrompt: string;
  structured?: Array<{ shape: string; value: unknown }>;
}

export type EgressEvaluationResult =
  | {
      decision: 'ALLOW';
      request: { systemPrompt: string; userPrompt: string };
      patientRef: string | null;
      consentReference: string | null;
      allowedFields: string[];
      removedFields: string[];
      dataCategories: string[];
      redactionApplied: boolean;
      pseudonymizationApplied: boolean;
      purpose: string;
      policyVersion: string;
    }
  | {
      decision: 'DENY';
      reasonCodes: string[];
      capability: string;
      purpose: string;
      provider: string;
      model: string;
      patientRef: string | null;
    };

export interface AIDataEgressPolicyOptions {
  manifestStore?: EgressManifestStore;
  consentStatusProvider?: (pacienteId: string, sucursalId: string, tipo: string) => Promise<ConsentStatusResult>;
  namesProvider?: (pacienteId: string, sucursalId: string) => Promise<string[]>;
  env?: () => NodeJS.ProcessEnv;
  now?: () => Date;
}

function denyResult(input: EgressEvaluationInput, reasonCodes: EgressReasonCode[]): EgressEvaluationResult {
  const contract = getCapabilityContract(input.capability);
  return {
    decision: 'DENY',
    reasonCodes,
    capability: input.capability,
    purpose: contract?.purpose ?? 'unknown',
    provider: input.provider,
    model: input.model,
    patientRef: null,
  };
}

export class AIDataEgressPolicy {
  private readonly manifestStore: EgressManifestStore;
  private readonly consentStatusProvider: (pacienteId: string, sucursalId: string, tipo: string) => Promise<ConsentStatusResult>;
  private readonly namesProvider: (pacienteId: string, sucursalId: string) => Promise<string[]>;
  private readonly env: () => NodeJS.ProcessEnv;
  private readonly now: () => Date;

  constructor(options: AIDataEgressPolicyOptions = {}) {
    this.manifestStore = options.manifestStore ?? new SqlEgressManifestStore();
    this.consentStatusProvider = options.consentStatusProvider ?? getConsentStatus;
    this.namesProvider = options.namesProvider ?? getPatientNames;
    this.env = options.env ?? (() => process.env);
    this.now = options.now ?? (() => new Date());
  }

  static withInMemoryStore(overrides: AIDataEgressPolicyOptions = {}): AIDataEgressPolicy {
    return new AIDataEgressPolicy({ manifestStore: new InMemoryEgressManifestStore(), ...overrides });
  }

  async evaluate(input: EgressEvaluationInput, executionId: string): Promise<EgressEvaluationResult> {
    const env = this.env();

    const base = evaluateEgress(input.provider, input.model, env);
    if (!base.allowed) {
      const code: EgressReasonCode =
        base.reason === 'kill_switch' ? 'kill_switch' : base.reason === 'provider' ? 'provider_denied' : 'model_denied';
      const denied = denyResult(input, [code]);
      if (base.reason !== 'kill_switch') {
        const contract = getCapabilityContract(input.capability);
        await this.persistManifest(input, executionId, denied, contract?.allowedDataCategories.filter(isCategoryDefined) ?? [], []);
      }
      return denied;
    }

    const contract = getCapabilityContract(input.capability);
    if (!contract) {
      const denied = denyResult(input, ['unknown_capability']);
      await this.persistManifest(input, executionId, denied, [], []);
      return denied;
    }

    const purpose = contract.purpose;
    const dataCategories = contract.allowedDataCategories.filter(isCategoryDefined);

    const providerPolicy = getProviderDataPolicy(input.provider, env);
    const hasPHI = contract.phiAllowed;

    if (hasPHI && !providerPolicy.phiAllowed) {
      const denied = denyResult(input, ['provider_phi_not_allowed']);
      await this.persistManifest(input, executionId, denied, dataCategories, []);
      return denied;
    }
    if (hasPHI && providerPolicy.locationType === 'external' && !providerPolicy.approvedForClinicalData) {
      const denied = denyResult(input, ['provider_not_approved_for_clinical_data']);
      await this.persistManifest(input, executionId, denied, dataCategories, []);
      return denied;
    }

    if (contract.patientScope === 'required' && !input.patientId) {
      const denied = denyResult(input, ['missing_patient_scope']);
      await this.persistManifest(input, executionId, denied, dataCategories, []);
      return denied;
    }

    let consentReference: string | null = null;
    if (contract.consentScope) {
      if (!input.patientId || !input.sucursalId) {
        const denied = denyResult(input, ['consent_unverifiable']);
        await this.persistManifest(input, executionId, denied, dataCategories, []);
        return denied;
      }
      const consent = await this.consentStatusProvider(input.patientId, input.sucursalId, contract.consentScope);
      if (consent.status === 'valid') {
        consentReference = consent.reference ?? null;
      } else {
        const code: EgressReasonCode =
          consent.status === 'missing' ? 'consent_missing' : consent.status === 'revoked' ? 'consent_revoked' : 'consent_unverifiable';
        const denied = denyResult(input, [code]);
        await this.persistManifest(input, executionId, denied, dataCategories, []);
        return denied;
      }
    }

    if (contract.requiredResidency && contract.requiredResidency !== 'any') {
      const match = compareResidency(contract.requiredResidency, providerPolicy.dataResidency);
      if (match === 'mismatch') {
        const denied = denyResult(input, ['residency_mismatch']);
        await this.persistManifest(input, executionId, denied, dataCategories, []);
        return denied;
      }
      if (match === 'unknown') {
        const denied = denyResult(input, ['residency_unknown']);
        await this.persistManifest(input, executionId, denied, dataCategories, []);
        return denied;
      }
    }

    const allowedFields: string[] = [];
    const removedFields: string[] = [];
    const filteredStructured: Array<{ shape: string; value: unknown }> = [];
    if (input.structured) {
      for (const item of input.structured) {
        const allowlist = contract.structuredAllowlists[item.shape as keyof typeof contract.structuredAllowlists];
        if (!allowlist || allowlist.length === 0) {
          removedFields.push(`${item.shape}.*`);
          filteredStructured.push({ shape: item.shape, value: emptyFor(item.value) });
          continue;
        }
        const { filtered, removed } = filterByAllowlist(item.value, allowlist);
        removedFields.push(...removed.map((path) => `${item.shape}.${path}`));
        allowedFields.push(...collectAllowedFields(allowlist).map((path) => `${item.shape}.${path}`));
        filteredStructured.push({ shape: item.shape, value: filtered });
      }
    }

    let systemPrompt = input.systemPrompt;
    let userPrompt = input.userPrompt;
    let redactionApplied = false;
    if (contract.redactFreeText && providerPolicy.locationType === 'external') {
      const names = input.patientId && input.sucursalId ? await this.namesProvider(input.patientId, input.sucursalId) : [];
      const redactedSystem = redactFreeText(systemPrompt, names);
      const redactedUser = redactFreeText(userPrompt, names);
      systemPrompt = redactedSystem.output;
      userPrompt = redactedUser.output;
      redactionApplied = redactedSystem.redacted.length > 0 || redactedUser.redacted.length > 0;
    }

    let patientRef: string | null = null;
    let pseudonymizationApplied = false;
    if (contract.pseudonymizePatientRef && input.patientId) {
      patientRef = pseudonymizePatientRef(input.patientId, executionId);
      pseudonymizationApplied = true;
    }

    const result: EgressEvaluationResult = {
      decision: 'ALLOW',
      request: { systemPrompt, userPrompt },
      patientRef,
      consentReference,
      allowedFields,
      removedFields,
      dataCategories,
      redactionApplied,
      pseudonymizationApplied,
      purpose,
      policyVersion: EGRESS_POLICY_VERSION,
    };

    await this.persistManifest(input, executionId, result, dataCategories, allowedFields);
    return result;
  }

  private async persistManifest(
    input: EgressEvaluationInput,
    executionId: string,
    result: EgressEvaluationResult,
    dataCategories: string[],
    fieldGroups: string[],
  ): Promise<void> {
    const providerPolicy = getProviderDataPolicy(input.provider, this.env());
    const manifest: EgressManifest = {
      manifestId: randomUUID(),
      executionId,
      userId: input.actor?.profesionalId ?? null,
      role: input.actor?.role ?? null,
      sucursalId: input.sucursalId ?? null,
      patientRef: result.decision === 'ALLOW' ? result.patientRef : null,
      capability: input.capability,
      purpose: result.decision === 'ALLOW' ? result.purpose : purposeOf(input.capability),
      provider: input.provider,
      model: input.model,
      providerLocationType: providerPolicy.locationType as ProviderLocationType,
      dataCategories,
      fieldGroups,
      redactionApplied: result.decision === 'ALLOW' ? result.redactionApplied : false,
      pseudonymizationApplied: result.decision === 'ALLOW' ? result.pseudonymizationApplied : false,
      consentReference: result.decision === 'ALLOW' ? result.consentReference : null,
      decision: result.decision,
      reasonCodes: result.decision === 'DENY' ? result.reasonCodes : [],
      policyVersion: EGRESS_POLICY_VERSION,
      occurredAt: this.now().toISOString(),
    };
    try {
      await this.manifestStore.save(manifest);
    } catch (err) {
      console.warn('[egress] manifest store failed:', err instanceof Error ? err.message : err);
    }
  }
}

function purposeOf(capability: string): string {
  const contract = getCapabilityContract(capability);
  return contract?.purpose ?? 'unknown';
}
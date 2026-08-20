import { describe, expect, it } from 'vitest';
import { ClinicalCertificationRegistry } from './clinicalCertification.js';
import { CURRENT_VERSIONS, computeToolsetVersion, ACTIVE_TOOLSET, GOLDEN_DATASET_VERSION } from './versions.js';
import { minCertificationForRisk, requiredCertificationFor, stateSatisfies } from './certificationStates.js';
import { buildModelCardView } from './modelCardView.js';
import type { ModelCard } from '../evaluation/modelCard.js';

const v = CURRENT_VERSIONS;

function registry(): ClinicalCertificationRegistry {
  return new ClinicalCertificationRegistry();
}

describe('clinicalCertification (Build 05, spec 63; Build 09.5A: torneo 07.5A)', () => {
  it('gpt-4o-mini tiene registro APPROVED_NUTRITION_SUPPORT pero REQUALIFICATION_REQUIRED (torneo 07.5A: 4/8 FAIL)', () => {
    const r = registry();
    const res = r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', { requiredState: 'APPROVED_NUTRITION_SUPPORT' });
    expect(res.eligible).toBe(false);
    expect(res.state).toBe('APPROVED_NUTRITION_SUPPORT');
    expect(res.certificationId).toBe('cert-openai-gpt-4o-mini-nutrition_reasoning-v1');
    expect(res.stale).toBe(false);
    expect(res.requalificationRequired).toBe(true);
    expect(res.reason).toContain('REQUALIFICATION_REQUIRED');
  });

  it('gpt-4o-mini NO satisface APPROVED_PATIENT (nunca APPROVED_GENERAL sirve para paciente)', () => {
    const r = registry();
    r.clearRequalificationRequired('openai', 'gpt-4o-mini', 'chat_general');
    const res = r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'chat_general', { requiredState: 'APPROVED_PATIENT' });
    expect(res.eligible).toBe(false);
    expect(res.state).toBe('APPROVED_GENERAL');
    expect(res.reason).toContain('no satisface el requisito');
  });

  it('llama3.2 (ollama) REQUALIFICATION_REQUIRED (torneo 07.5A: 6/8 FAIL) pese a registro APPROVED_NUTRITION_SUPPORT', () => {
    const r = registry();
    const res = r.resolve('ollama', 'llama3.2', '3.2', 'nutrition_reasoning', { requiredState: 'APPROVED_NUTRITION_SUPPORT' });
    expect(res.eligible).toBe(false);
    expect(res.state).toBe('APPROVED_NUTRITION_SUPPORT');
    expect(res.requalificationRequired).toBe(true);
    expect(res.reason).toContain('REQUALIFICATION_REQUIRED');
  });

  it('llama3.2 RESTRICTED con lista vacía: nunca aprobación genérica', () => {
    const r = registry();
    const res = r.resolve('ollama', 'llama3.2', '3.2', 'structured_json', { requiredState: 'APPROVED_ANALYTICS' });
    expect(res.eligible).toBe(false);
    expect(res.state).toBe('RESTRICTED');
    expect(res.reason).toContain('RESTRICTED no permite');
  });

  it('EXPERIMENTAL no es elegible en producción clínica sin allowExperimental', () => {
    const r = registry();
    const res = r.resolve('openai', 'gpt-4o', 'gpt-4o-2024-08-06', 'nutrition_reasoning', { requiredState: 'APPROVED_NUTRITION_SUPPORT' });
    expect(res.eligible).toBe(false);
    expect(res.state).toBe('EXPERIMENTAL');
    expect(res.reason).toContain('EXPERIMENTAL no es elegible');
  });

  it('con allowExperimental explícito EXPERIMENTAL sí satisface', () => {
    const r = registry();
    const res = r.resolve('openai', 'gpt-4o', 'gpt-4o-2024-08-06', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      allowExperimental: true,
    });
    expect(res.eligible).toBe(true);
    expect(res.state).toBe('EXPERIMENTAL');
  });

  it('BLOCKED nunca es elegible', () => {
    const r = registry();
    r.register({
      certificationId: 'cert-bloqueado',
      key: {
        providerId: 'openai',
        modelId: 'gpt-4o-bloqueado',
        modelVersion: 'v1',
        capabilityId: 'chat_general',
        promptVersion: v.promptVersion.chat_general,
        toolsetVersion: v.toolsetVersion,
        policyVersion: v.policyVersion,
        outputSchemaVersion: v.outputSchemaVersion.chat_general,
      },
      state: 'BLOCKED',
      evaluatedAt: '2026-08-17T00:00:00.000Z',
      datasetFingerprint: 'fp',
      reportRef: 'blocked.json',
    });
    const res = r.resolve('openai', 'gpt-4o-bloqueado', 'v1', 'chat_general', { requiredState: 'APPROVED_GENERAL' });
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('BLOCKED');
  });

  it('modelo sin certificación clínica exacta → no elegible + requalification', () => {
    const r = registry();
    const res = r.resolve('openai', 'modelo-desconocido', 'v9', 'chat_general', { requiredState: 'APPROVED_GENERAL' });
    expect(res.eligible).toBe(false);
    expect(res.stale).toBe(true);
    expect(res.requalificationRequired).toBe(true);
  });

  it('stateSatisfies: APPROVED_PATIENT satisface cualquier nivel menor; APPROVED_GENERAL jamás satisface clínico', () => {
    expect(stateSatisfies('APPROVED_PATIENT', 'APPROVED_CLINICAL_SUPPORT')).toBe(true);
    expect(stateSatisfies('APPROVED_NUTRITION_SUPPORT', 'APPROVED_CLINICAL_SUPPORT')).toBe(false);
    expect(stateSatisfies('APPROVED_GENERAL', 'APPROVED_NUTRITION_SUPPORT')).toBe(false);
    expect(stateSatisfies('APPROVED_GENERAL', 'APPROVED_ANALYTICS')).toBe(false);
    expect(stateSatisfies('BLOCKED', 'APPROVED_GENERAL')).toBe(false);
    expect(stateSatisfies('RESTRICTED', 'APPROVED_GENERAL')).toBe(false);
  });

  it('requiredCertificationFor combina piso por riesgo y mínimo de capability', () => {
    expect(requiredCertificationFor('RISK_1', 'APPROVED_GENERAL')).toBe('APPROVED_GENERAL');
    expect(requiredCertificationFor('RISK_3', 'APPROVED_GENERAL')).toBe('APPROVED_NUTRITION_SUPPORT');
    expect(requiredCertificationFor('RISK_3', 'APPROVED_PATIENT')).toBe('APPROVED_PATIENT');
    expect(requiredCertificationFor('RISK_4', 'APPROVED_NUTRITION_SUPPORT')).toBe('APPROVED_CLINICAL_SUPPORT');
    expect(minCertificationForRisk('RISK_5')).toBe('APPROVED_CLINICAL_SUPPORT');
  });
});

describe('version change → requalification (Build 05, spec 65)', () => {
  it('cambiar prompt_version invalida la certificación exacta (stale) y exige requalification', () => {
    const r = registry();
    const res = r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      versions: { ...v, promptVersion: { ...v.promptVersion, nutrition_reasoning: 'prompt.nutrition_reasoning.v3' } },
    });
    expect(res.eligible).toBe(false);
    expect(res.stale).toBe(true);
    expect(res.requalificationRequired).toBe(true);
    expect(res.reason).toContain('Sin certificación clínica exacta');
  });

  it('cambiar model_version (actualización del modelo) invalida la certificación', () => {
    const r = registry();
    const res = r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2025-01-01', 'nutrition_reasoning', { requiredState: 'APPROVED_NUTRITION_SUPPORT' });
    expect(res.eligible).toBe(false);
    expect(res.requalificationRequired).toBe(true);
  });

  it('cambiar toolsetVersion (nueva herramienta en el toolset) invalida la certificación', () => {
    const r = registry();
    const res = r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      versions: { ...v, toolsetVersion: 'toolset.00000000' },
    });
    expect(res.eligible).toBe(false);
    expect(res.requalificationRequired).toBe(true);
  });

  it('el historial nunca se borra: el registro stale sigue listado', () => {
    const r = registry();
    const before = r.list().length;
    r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      versions: { ...v, policyVersion: 'policy-bundle.v2' },
    });
    expect(r.list().length).toBe(before);
    expect(r.get('cert-openai-gpt-4o-mini-nutrition_reasoning-v1')).toBeDefined();
  });

  it('markRequalificationRequired bloquea incluso con clave exacta', () => {
    const r = registry();
    r.clearRequalificationRequired('openai', 'gpt-4o-mini', 'nutrition_reasoning');
    r.markRequalificationRequired('openai', 'gpt-4o-mini', 'nutrition_reasoning');
    const res = r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', { requiredState: 'APPROVED_NUTRITION_SUPPORT' });
    expect(res.eligible).toBe(false);
    expect(res.requalificationRequired).toBe(true);
    expect(res.reason).toContain('REQUALIFICATION_REQUIRED');
  });

  it('Build 06: una certificación exacta de Build 05 (toolset 7 herramientas, v1) queda STALE con CURRENT_VERSIONS', () => {
    const r = registry();
    const build05Versions: typeof v = {
      promptVersion: { ...v.promptVersion, nutrition_reasoning: 'prompt.nutrition_reasoning.v1' },
      toolsetVersion: 'toolset.3b1a4c2d', // Build 05: 7 herramientas
      policyVersion: v.policyVersion,
      outputSchemaVersion: { ...v.outputSchemaVersion, nutrition_reasoning: 'output.nutrition_reasoning.v1' },
      evaluationDatasetVersion: v.evaluationDatasetVersion,
      knowledgePolicyVersion: v.knowledgePolicyVersion,
      retrievalPolicyVersion: v.retrievalPolicyVersion,
      smaeCatalogVersion: 'smae-catalog-v0', // Build 05: catalogo previo al data-driven
    };
    const current = r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', { requiredState: 'APPROVED_NUTRITION_SUPPORT' });
    expect(current.eligible).toBe(false);
    expect(current.stale).toBe(false);
    expect(current.requalificationRequired).toBe(true);
    const build05 = r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      versions: build05Versions,
    });
    expect(build05.eligible).toBe(false);
    expect(build05.stale).toBe(true);
    expect(build05.requalificationRequired).toBe(true);
    expect(build05.reason).toContain('Sin certificación clínica exacta');
  });

  it('Build 07: una certificación con knowledge-policy.v1 queda STALE (retrieval-policy.v2 vigente)', () => {
    const r = registry();
    const build06Versions: typeof v = {
      ...v,
      knowledgePolicyVersion: 'knowledge-policy.v1',
      retrievalPolicyVersion: 'retrieval-policy.v1',
    };
    const current = r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', { requiredState: 'APPROVED_NUTRITION_SUPPORT' });
    expect(current.eligible).toBe(false);
    expect(current.stale).toBe(false);
    expect(current.requalificationRequired).toBe(true);
    const build06 = r.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      versions: build06Versions,
    });
    expect(build06.eligible).toBe(false);
    expect(build06.stale).toBe(true);
    expect(build06.requalificationRequired).toBe(true);
    expect(build06.reason).toContain('Sin certificación clínica exacta');
  });
});

describe('versions determinism (Build 05)', () => {
  it('computeToolsetVersion es determinista y sensible a cambios', () => {
    const a = computeToolsetVersion(ACTIVE_TOOLSET);
    const b = computeToolsetVersion(ACTIVE_TOOLSET);
    expect(a).toBe(b);
    expect(a).toMatch(/^toolset\.[0-9a-f]{8}$/);
    const changed = computeToolsetVersion([...ACTIVE_TOOLSET, { id: 'nueva_tool', riskLevel: 'high', schemaKeys: ['x'] }]);
    expect(changed).not.toBe(a);
  });

  it('CURRENT_VERSIONS usa el dataset golden y versiones estables', () => {
    expect(CURRENT_VERSIONS.evaluationDatasetVersion).toBe(GOLDEN_DATASET_VERSION);
    expect(CURRENT_VERSIONS.policyVersion).toBe('policy-bundle.v1');
    expect(CURRENT_VERSIONS.promptVersion.nutrition_reasoning).toBe('prompt.nutrition_reasoning.v2');
    expect(CURRENT_VERSIONS.outputSchemaVersion.nutrition_reasoning).toBe('output.nutrition_reasoning.v2');
  });
});

describe('modelCardView (Build 05)', () => {
  const card: ModelCard = {
    key: 'openai/gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    version: 'gpt-4o-mini-2024-07-18',
    developer: 'OpenAI',
    license: 'Propietaria',
    description: 'Modelo ligero',
    intendedUse: 'Asistencia general',
    limitations: 'sin labores clínicas autónomas; requiere revisión',
    risks: [],
    capabilities: ['chat_general', 'structured_json', 'nutrition_reasoning'],
    evaluationReport: 'r1.json',
  };

  it('deriva capacidades aprobadas desde la certificación granular (con flags 07.5A marcados)', () => {
    const view = buildModelCardView(card, { certifications: registry() });
    expect(view.approvedCapabilities.map((c) => c.capability)).toEqual(
      expect.arrayContaining(['chat_general', 'structured_json', 'nutrition_reasoning']),
    );
    const nutrition = view.approvedCapabilities.find((c) => c.capability === 'nutrition_reasoning');
    expect(nutrition?.state).toBe('APPROVED_NUTRITION_SUPPORT');
    expect(view.requalificationRequired).toBe(true);
  });

  it('sin data → UNKNOWN / NOT_EVALUATED, nunca inventa resultados', () => {
    const unknown: ModelCard = {
      key: 'otro/modelo-x',
      provider: 'ollama',
      model: 'modelo-x',
      version: 'v1',
      developer: 'otro',
      license: '',
      description: '',
      intendedUse: '',
      limitations: '',
      risks: [],
      capabilities: [],
      evaluationReport: '',
    };
    const view = buildModelCardView(unknown, { certifications: registry() });
    expect(view.approvedCapabilities).toEqual([]);
    expect(view.clinicalQualification).toBe('NOT_EVALUATED');
    expect(view.lastQualificationDate).toBe('UNKNOWN');
  });

  it('gpt-4o en nutrition_reasoning es experimental, no aprobado', () => {
    const card4o: ModelCard = {
      key: 'openai/gpt-4o',
      provider: 'openai',
      model: 'gpt-4o',
      version: 'gpt-4o-2024-08-06',
      developer: 'OpenAI',
      license: 'Propietaria',
      description: 'Modelo flagship',
      intendedUse: 'Asistencia general',
      limitations: '',
      risks: [],
      capabilities: ['chat_general', 'structured_json', 'nutrition_reasoning'],
      evaluationReport: '',
    };
    const view = buildModelCardView(card4o, { certifications: registry() });
    expect(view.clinicalQualification).toBe('experimental');
  });
});
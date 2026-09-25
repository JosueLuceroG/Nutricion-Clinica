import { describe, expect, it } from 'vitest';
import { InMemoryEgressManifestStore, type EgressManifestStore } from './egressManifestStore.js';
import { AIDataEgressPolicy, type EgressEvaluationInput } from './egressPolicy.js';
import { compareResidency } from './providerDataPolicy.js';

const BASE_ENV = (): NodeJS.ProcessEnv =>
  ({
    AI_EGRESS_ENABLED: 'true',
    AI_ALLOWED_PROVIDERS: 'openai,ollama',
    AI_ALLOWED_MODELS: '',
    AI_QUALIFICATION_ENFORCED: 'false',
  }) as NodeJS.ProcessEnv;

function input(overrides: Partial<EgressEvaluationInput> = {}): EgressEvaluationInput {
  return {
    capability: 'nutrition_reasoning',
    provider: 'ollama',
    model: 'llama3.2',
    patientId: '11111111-1111-1111-1111-111111111111',
    sucursalId: '22222222-2222-2222-2222-222222222222',
    actor: { profesionalId: '33333333-3333-3333-3333-333333333333', role: 'nutriologo' },
    systemPrompt: 'Eres un experto en nutricion.',
    userPrompt: 'Genera consejos para el paciente.',
    ...overrides,
  };
}

function makeStore(): { store: InMemoryEgressManifestStore; saveSpy: EgressManifestStore } {
  const store = new InMemoryEgressManifestStore();
  return { store, saveSpy: store };
}

describe('AIDataEgressPolicy — matriz de decisión', () => {
  it('ALLOW: ollama local + nutrition_reasoning + consentimiento válido', async () => {
    const { store } = makeStore();
    const policy = AIDataEgressPolicy.withInMemoryStore({
      env: BASE_ENV,
      manifestStore: store,
      consentStatusProvider: async () => ({ status: 'valid', reference: 'cons-1' }),
    });
    const result = await policy.evaluate(input(), 'exec-1');
    expect(result.decision).toBe('ALLOW');
    if (result.decision === 'ALLOW') {
      expect(result.consentReference).toBe('cons-1');
      expect(result.patientRef).toMatch(/^PATIENT_REF_[0-9a-f]{8}$/);
      expect(result.redactionApplied).toBe(false);
      expect(result.pseudonymizationApplied).toBe(true);
      expect(result.dataCategories).toContain('ANTHROPOMETRY');
    }
    expect(store.all().length).toBe(1);
  });

  it('ALLOW: openai + patient_support (sin PHI) con redacción de texto libre', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV });
    const result = await policy.evaluate(
      input({ capability: 'patient_support', provider: 'openai', model: 'gpt-4o-mini', systemPrompt: 'Eres el asistente del paciente. Email de contacto: jose@example.com' }),
      'exec-2',
    );
    expect(result.decision).toBe('ALLOW');
    if (result.decision === 'ALLOW') {
      expect(result.request.systemPrompt).not.toContain('jose@example.com');
      expect(result.request.systemPrompt).toContain('[REDACTADO]');
      expect(result.redactionApplied).toBe(true);
    }
  });

  it('ALLOW: openai + meal_plan_authoring (Chef) sin consentimiento ni paciente', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV });
    const result = await policy.evaluate(input({ capability: 'meal_plan_authoring', provider: 'openai', model: 'gpt-4o-mini', patientId: undefined, sucursalId: undefined }), 'exec-3');
    expect(result.decision).toBe('ALLOW');
  });

  it('ALLOW: openai + model_evaluation solo si el operador certifica PHI y datos clínicos', async () => {
    const env = BASE_ENV();
    env.AI_PROVIDER_PHI_ALLOWED_OPENAI = 'true';
    env.AI_PROVIDER_APPROVED_CLINICAL_OPENAI = 'true';
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: () => env });
    const result = await policy.evaluate(input({ capability: 'model_evaluation', provider: 'openai', model: 'gpt-4o-mini' }), 'exec-4');
    expect(result.decision).toBe('ALLOW');
  });

  it('DENY: kill switch apagado y NO persiste manifest', async () => {
    const { store } = makeStore();
    const env = BASE_ENV();
    delete env.AI_EGRESS_ENABLED;
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: () => env, manifestStore: store });
    const result = await policy.evaluate(input(), 'exec-5');
    expect(result.decision).toBe('DENY');
    if (result.decision === 'DENY') expect(result.reasonCodes).toContain('kill_switch');
    expect(store.all().length).toBe(0);
  });

  it('DENY: provider fuera de la allowlist persiste manifest', async () => {
    const { store } = makeStore();
    const env = BASE_ENV();
    env.AI_ALLOWED_PROVIDERS = 'ollama';
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: () => env, manifestStore: store });
    const result = await policy.evaluate(input({ provider: 'openai', model: 'gpt-4o-mini' }), 'exec-6');
    expect(result.decision).toBe('DENY');
    if (result.decision === 'DENY') expect(result.reasonCodes).toContain('provider_denied');
    expect(store.all().length).toBe(1);
  });

  it('DENY: modelo fuera de la allowlist', async () => {
    const env = BASE_ENV();
    env.AI_ALLOWED_MODELS = 'otro-modelo';
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: () => env });
    const result = await policy.evaluate(input(), 'exec-7');
    expect(result.decision).toBe('DENY');
    if (result.decision === 'DENY') expect(result.reasonCodes).toContain('model_denied');
  });

  it('DENY: capability desconocida (fail-closed)', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV });
    const result = await policy.evaluate(input({ capability: 'no_existe' }), 'exec-8');
    expect(result.decision).toBe('DENY');
    if (result.decision === 'DENY') expect(result.reasonCodes).toContain('unknown_capability');
  });

  it('DENY: openai + PHI sin aprobación del operador', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV });
    const result = await policy.evaluate(input({ provider: 'openai', model: 'gpt-4o-mini' }), 'exec-9');
    expect(result.decision).toBe('DENY');
    if (result.decision === 'DENY') expect(result.reasonCodes).toContain('provider_phi_not_allowed');
  });

  it('DENY: openai + PHI aprobada pero no aprobado para datos clínicos', async () => {
    const env = BASE_ENV();
    env.AI_PROVIDER_PHI_ALLOWED_OPENAI = 'true';
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: () => env });
    const result = await policy.evaluate(input({ provider: 'openai', model: 'gpt-4o-mini' }), 'exec-10');
    expect(result.decision).toBe('DENY');
    if (result.decision === 'DENY') expect(result.reasonCodes).toContain('provider_not_approved_for_clinical_data');
  });

  it('DENY: patientScope requerido sin paciente', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV });
    const result = await policy.evaluate(input({ patientId: undefined }), 'exec-11');
    expect(result.decision).toBe('DENY');
    if (result.decision === 'DENY') expect(result.reasonCodes).toContain('missing_patient_scope');
  });

  it('DENY: consentimiento inexistente', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV, consentStatusProvider: async () => ({ status: 'missing' }) });
    const result = await policy.evaluate(input(), 'exec-12');
    expect(result.decision).toBe('DENY');
    if (result.decision === 'DENY') expect(result.reasonCodes).toContain('consent_missing');
  });

  it('DENY: consentimiento revocado', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV, consentStatusProvider: async () => ({ status: 'revoked' }) });
    const result = await policy.evaluate(input(), 'exec-13');
    expect(result.decision).toBe('DENY');
    if (result.decision === 'DENY') expect(result.reasonCodes).toContain('consent_revoked');
  });

  it('DENY: consentimiento no verificable (error) o sin sucursal', async () => {
    const errored = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV, consentStatusProvider: async () => ({ status: 'error' }) });
    const r1 = await errored.evaluate(input(), 'exec-14');
    expect(r1.decision === 'DENY' && r1.reasonCodes).toContain('consent_unverifiable');

    const noSucursal = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV, consentStatusProvider: async () => ({ status: 'valid' }) });
    const r2 = await noSucursal.evaluate(input({ sucursalId: undefined }), 'exec-15');
    expect(r2.decision === 'DENY' && r2.reasonCodes).toContain('consent_unverifiable');
  });

  it('DENY: proveedor desconocido nunca permite PHI ni clínicos', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV });
    const result = await policy.evaluate(input({ provider: 'misterioso', model: 'x' }), 'exec-16');
    expect(result.decision).toBe('DENY');
    if (result.decision === 'DENY') expect(result.reasonCodes).toContain('provider_denied');
  });
});

describe('AIDataEgressPolicy — filtrado estructurado y adversarial', () => {
  it('corta campos PHI del contexto estructurado antes del provider', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({
      env: BASE_ENV,
      consentStatusProvider: async () => ({ status: 'valid' }),
    });
    const result = await policy.evaluate(
      input({
        structured: [
          {
            shape: 'expert_context',
            value: {
              genero: 'femenino',
              ageYears: 34,
              secret: 'nunca-debe-salir',
              anthropometry: { weightKg: 65, heightM: 1.65, measuredAt: '2026-01-01', oculto: 'sí' },
              recentLabs: [{ lab_name: 'Glucosa', results_json: '{"v":1}', oculto: true }],
            },
          },
        ],
      }),
      'exec-17',
    );
    expect(result.decision).toBe('ALLOW');
    if (result.decision === 'ALLOW') {
      expect(result.removedFields).toEqual(expect.arrayContaining(['expert_context.secret', 'expert_context.anthropometry.oculto', 'expert_context.recentLabs.oculto']));
      expect(result.allowedFields).toContain('expert_context.anthropometry.weightKg');
    }
  });

  it('redacta identificadores directos del texto libre hacia providers externos', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({
      env: BASE_ENV,
      namesProvider: async () => ['María López'],
    });
    const result = await policy.evaluate(
      input({
        capability: 'patient_support',
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'Paciente María López, tel 5512345678, email maria@test.com',
      }),
      'exec-18',
    );
    expect(result.decision).toBe('ALLOW');
    if (result.decision === 'ALLOW') {
      expect(result.request.systemPrompt).not.toContain('María');
      expect(result.request.systemPrompt).not.toContain('5512345678');
      expect(result.request.systemPrompt).not.toContain('maria@test.com');
      expect(result.redactionApplied).toBe(true);
    }
  });

  it('no redacta hacia providers locales (los datos ya fueron filtrados)', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({ env: BASE_ENV, consentStatusProvider: async () => ({ status: 'valid' }) });
    const result = await policy.evaluate(input({ systemPrompt: 'email jose@test.com' }), 'exec-19');
    expect(result.decision).toBe('ALLOW');
    if (result.decision === 'ALLOW') {
      expect(result.request.systemPrompt).toContain('jose@test.com');
      expect(result.redactionApplied).toBe(false);
    }
  });
});

describe('AIDataEgressPolicy — manifiesto', () => {
  it('el manifiesto ALLOW nunca contiene PHI crudo', async () => {
    const { store } = makeStore();
    const policy = AIDataEgressPolicy.withInMemoryStore({
      env: BASE_ENV,
      manifestStore: store,
      consentStatusProvider: async () => ({ status: 'valid', reference: 'cons-9' }),
    });
    await policy.evaluate(input(), 'exec-20');
    const manifest = store.all()[0]!;
    const serialized = JSON.stringify(manifest);
    expect(manifest.decision).toBe('ALLOW');
    expect(manifest.patientRef).toMatch(/^PATIENT_REF_[0-9a-f]{8}$/);
    expect(serialized).not.toContain('11111111-1111-1111-1111-111111111111');
    expect(serialized).not.toContain('Genera consejos');
    expect(manifest.consentReference).toBe('cons-9');
  });

  it('el manifiesto DENY guarda decisión, motivo y sin PHI', async () => {
    const { store } = makeStore();
    const policy = AIDataEgressPolicy.withInMemoryStore({
      env: BASE_ENV,
      manifestStore: store,
      consentStatusProvider: async () => ({ status: 'revoked' }),
    });
    await policy.evaluate(input(), 'exec-21');
    const manifest = store.all()[0]!;
    expect(manifest.decision).toBe('DENY');
    expect(manifest.reasonCodes).toContain('consent_revoked');
    expect(manifest.patientRef).toBeNull();
    expect(JSON.stringify(manifest)).not.toContain('11111111-1111-1111-1111-111111111111');
  });

  it('una ejecución con dos candidatos evalúa la política por candidato', async () => {
    const { store } = makeStore();
    const policy = AIDataEgressPolicy.withInMemoryStore({
      env: BASE_ENV,
      manifestStore: store,
      consentStatusProvider: async () => ({ status: 'valid' }),
    });
    await policy.evaluate(input({ provider: 'openai', model: 'gpt-4o-mini' }), 'exec-22');
    await policy.evaluate(input({ provider: 'ollama', model: 'llama3.2' }), 'exec-22');
    const manifests = store.all();
    expect(manifests.length).toBe(2);
    expect(manifests.map((m) => m.decision)).toEqual(['DENY', 'ALLOW']);
    expect(manifests.map((m) => m.executionId)).toEqual(['exec-22', 'exec-22']);
  });
});

describe('compareResidency', () => {
  it('clasifica match, mismatch y unknown', () => {
    expect(compareResidency('any', 'local')).toBe('match');
    expect(compareResidency('mx', 'mx')).toBe('match');
    expect(compareResidency('us', 'eu')).toBe('mismatch');
    expect(compareResidency('us', 'unknown')).toBe('unknown');
    expect(compareResidency(null, 'local')).toBe('match');
  });
});
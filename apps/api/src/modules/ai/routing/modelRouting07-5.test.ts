import { describe, expect, it } from 'vitest';
import { classifyHardware, isHardwareCompatible, type LocalHardwareProfile } from '../hardware/hardwareProfile.js';
import { buildDeploymentProfile, sameDeployment, DEFAULT_INFERENCE_SETTINGS } from '../models/deploymentProfile.js';
import { buildCandidateManifest, candidateAvailability } from '../models/candidateManifest.js';
import { credentialVault, generalProviderAuthStatus, scrapingIsSupported } from '../credentials/credentialMode.js';
import { resolveModelPolicy, RISK_MODEL_CLASS_POLICY } from './modelPolicy.js';

describe('hardware profile', () => {
  it('clasifica CPU_ONLY_HIGH con 16GB/12 cores', () => {
    expect(classifyHardware({ cpuCores: 12, systemRamBytes: 16 * 1024 ** 3, gpuVendor: 'none', vramBytes: null, platform: 'win32' })).toBe('CPU_ONLY_HIGH');
  });
  it('clasifica GPU por VRAM', () => {
    expect(classifyHardware({ cpuCores: 8, systemRamBytes: 32 * 1024 ** 3, gpuVendor: 'nvidia', vramBytes: 24 * 1024 ** 3, platform: 'win32' })).toBe('GPU_HIGH_VRAM');
    expect(classifyHardware({ cpuCores: 8, systemRamBytes: 32 * 1024 ** 3, gpuVendor: 'nvidia', vramBytes: 6 * 1024 ** 3, platform: 'win32' })).toBe('GPU_LOW_VRAM');
  });
  it('darwin -> APPLE_UNIFIED_MEMORY', () => {
    expect(classifyHardware({ cpuCores: 8, systemRamBytes: 16 * 1024 ** 3, gpuVendor: 'apple', vramBytes: null, platform: 'darwin' })).toBe('APPLE_UNIFIED_MEMORY');
  });
  it('UNKNOWN nunca es compatible', () => {
    const profile: LocalHardwareProfile = {
      detectedAt: 'x', cpuArchitecture: 'x64', cpuCores: 12, cpuModel: null, systemRamBytes: 16 * 1024 ** 3, freeRamBytes: 1, diskFreeBytes: null,
      gpuVendor: 'UNKNOWN', gpuModel: null, vramBytes: null, hardwareClass: 'UNKNOWN', inferenceRuntimes: [],
    };
    expect(isHardwareCompatible(profile, {})).toBe(false);
  });
});

describe('deployment profile', () => {
  it('digest distinto -> fingerprint distinto', () => {
    const base = { providerId: 'ollama', modelId: 'llama3.2', modelVersion: '3.2', runtime: 'ollama', inferenceSettings: DEFAULT_INFERENCE_SETTINGS };
    expect(buildDeploymentProfile({ ...base, weightsRevision: 'aaa' }).fingerprint).not.toBe(buildDeploymentProfile({ ...base, weightsRevision: 'bbb' }).fingerprint);
  });
  it('cuantizacion distinta -> deployment distinto (sin herencia de resultados)', () => {
    const base = { providerId: 'ollama', modelId: 'gemma3', modelVersion: '4b', runtime: 'ollama', inferenceSettings: DEFAULT_INFERENCE_SETTINGS };
    const q4 = buildDeploymentProfile({ ...base, quantization: 'Q4_K_M' });
    const q8 = buildDeploymentProfile({ ...base, quantization: 'Q8_0' });
    expect(q4.fingerprint).not.toBe(q8.fingerprint);
    expect(sameDeployment(q4, { ...base, quantization: 'Q4_K_M' })).toBe(true);
  });
  it('runtime version distinta -> deployment distinto', () => {
    const base = { providerId: 'ollama', modelId: 'llama3.2', modelVersion: '3.2', runtime: 'ollama', inferenceSettings: DEFAULT_INFERENCE_SETTINGS };
    expect(buildDeploymentProfile({ ...base, runtimeVersion: '0.32.14' }).fingerprint).not.toBe(buildDeploymentProfile({ ...base, runtimeVersion: '0.33.0' }).fingerprint);
  });
});

describe('candidate manifest', () => {
  it('sin descargas automaticas: no instalado -> BLOCKED_BY_DOWNLOAD', () => {
    const manifest = buildCandidateManifest({ runtimeModels: [], runtimeVersion: null });
    expect(manifest.length).toBeGreaterThanOrEqual(6);
    for (const entry of manifest) {
      expect(candidateAvailability(entry, { downloadPolicy: 'operator_config_required' })).toBe(entry.installed ? 'AVAILABLE' : 'BLOCKED_BY_DOWNLOAD');
    }
  });
  it('instalado con digest -> AVAILABLE con weightsRevision', () => {
    const manifest = buildCandidateManifest({
      runtimeModels: [{ modelId: 'llama3.2', runtime: 'ollama', digest: 'a80c4f17', quantization: null, installed: true }],
      runtimeVersion: '0.32.14',
    });
    const llama = manifest.find((m) => m.modelId === 'llama3.2');
    expect(llama?.installed).toBe(true);
    expect(llama?.weightsRevision).toBe('a80c4f17');
    expect(candidateAvailability(llama!, { downloadPolicy: 'operator_config_required' })).toBe('AVAILABLE');
  });
});

describe('credential modes', () => {
  it('ollama -> LOCAL_NO_CREDENTIAL disponible', () => {
    const resolution = credentialVault.resolve('ollama', {});
    expect(resolution.mode).toBe('LOCAL_NO_CREDENTIAL');
    expect(resolution.status).toBe('AVAILABLE');
  });
  it('openai sin key -> API_KEY MISSING_CREDENTIAL', () => {
    const resolution = credentialVault.resolve('openai', {});
    expect(resolution.mode).toBe('API_KEY');
    expect(resolution.status).toBe('MISSING_CREDENTIAL');
  });
  it('openai con key -> API_KEY server-side', () => {
    const resolution = credentialVault.resolve('openai', { OPENAI_API_KEY: 'sk-test' });
    expect(resolution.status).toBe('AVAILABLE');
    expect(credentialVault.getApiKey('openai', { OPENAI_API_KEY: 'sk-test' })).toBe('sk-test');
  });
  it('web auth no soportada oficialmente -> fail-closed', () => {
    expect(generalProviderAuthStatus('openai', 'OAUTH_USER_SESSION')).toBe('UNSUPPORTED_FOR_GENERAL_PROVIDER_AUTH');
    expect(generalProviderAuthStatus('openai', 'SUPPORTED_WEB_AUTH')).toBe('UNSUPPORTED_FOR_GENERAL_PROVIDER_AUTH');
  });
  it('no existe scraping de cookies/sesiones', () => {
    expect(scrapingIsSupported()).toBe(false);
  });
});

describe('model policy', () => {
  it('default nuevo sin AI_MODEL -> NUTRICLINICA_LOCAL_AUTO', () => {
    expect(resolveModelPolicy({}).mode).toBe('NUTRICLINICA_LOCAL_AUTO');
  });
  it('AI_MODEL legacy -> EXPLICIT_APPROVED_MODEL', () => {
    expect(resolveModelPolicy({ AI_MODEL: 'llama3.2' }).mode).toBe('EXPLICIT_APPROVED_MODEL');
  });
  it('fallback default LOCAL_ONLY; cloud solo con config explicita', () => {
    expect(resolveModelPolicy({}).fallbackPolicy).toBe('LOCAL_ONLY');
    expect(resolveModelPolicy({ AI_MODEL_FALLBACK_POLICY: 'LOCAL_PREFERRED_ALLOW_CLOUD' }).fallbackPolicy).toBe('LOCAL_PREFERRED_ALLOW_CLOUD');
  });
  it('RISK_5 no permite modelo autonomo', () => {
    expect(RISK_MODEL_CLASS_POLICY.RISK_5.allowModel).toBe(false);
    expect(RISK_MODEL_CLASS_POLICY.RISK_5.preferredClass).toBe('NONE');
  });
});
import { getAIProvider } from '../credentialProvider.js';
import { getAllowedProviders, getAllowedModels } from '../aiEgressPolicy.js';
import { getFallbackProviderOrder } from '../routing/fallbackPolicy.js';
import type { ModelRegistry } from '../models/modelRegistry.js';
import type { ProviderRegistry } from '../providers/providerRegistry.js';
import type { ModelQualificationRegistry } from '../evaluation/certification.js';

export interface ConfigIssue {
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Valida la consistencia de la configuración del runtime AI.
 * Errores = fail-fast al arranque (config mal formada). Advertencias = no bloquean.
 * Un proveedor opcional deshabilitado o sin credenciales NO bloquea el arranque.
 */
export function validateAiConfig(
  env: NodeJS.ProcessEnv,
  registry: ModelRegistry,
  providers: ProviderRegistry,
  qualifications: ModelQualificationRegistry,
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  const defaultProvider = getAIProvider(env);
  const allowedProviders = getAllowedProviders(env);
  if (!allowedProviders.includes(defaultProvider)) {
    issues.push({ severity: 'error', message: `El proveedor default '${defaultProvider}' no está en AI_ALLOWED_PROVIDERS` });
  }

  const defaultModel = registry.getDefaultModel(defaultProvider);
  if (!defaultModel) {
    issues.push({ severity: 'error', message: `No hay modelo default registrado para el proveedor '${defaultProvider}'` });
  } else {
    const info = registry.get(defaultModel);
    if (!info?.enabled) {
      issues.push({ severity: 'error', message: `El modelo default '${defaultModel}' está deshabilitado en el registry` });
    }
    if (!providers.get(defaultProvider)) {
      issues.push({ severity: 'error', message: `El proveedor '${defaultProvider}' no tiene adapter registrado` });
    }
  }

  const qualificationEnforced = (env.AI_QUALIFICATION_ENFORCED ?? 'true') === 'true';
  if (qualificationEnforced) {
    for (const model of registry.list().filter((m) => m.enabled)) {
      for (const capability of model.supportedCapabilities) {
        const certification = qualifications.getCertification(`${model.provider}/${model.id}`, capability);
        if (!certification) {
          issues.push({
            severity: 'error',
            message: `AI_QUALIFICATION_ENFORCED=true pero '${model.provider}/${model.id}' no tiene metadata de calificación para '${capability}'`,
          });
        }
      }
    }
  }

  const fallbackOrder = getFallbackProviderOrder(env);
  const allowed = [...allowedProviders];
  for (const provider of fallbackOrder) {
    if (!providers.get(provider)) {
      issues.push({ severity: 'warning', message: `El proveedor de fallback '${provider}' no tiene adapter registrado` });
    }
    if (!allowed.includes(provider)) {
      issues.push({ severity: 'warning', message: `El proveedor de fallback '${provider}' no está en AI_ALLOWED_PROVIDERS` });
    }
  }

  const allowedModels = getAllowedModels(env);
  for (const modelId of allowedModels) {
    const info = registry.get(modelId);
    if (!info) {
      issues.push({ severity: 'error', message: `El modelo permitido '${modelId}' no está registrado en el ModelRegistry` });
    } else if (info.enabled && !providers.get(info.provider)) {
      issues.push({ severity: 'error', message: `El modelo '${modelId}' está habilitado pero su proveedor '${info.provider}' no tiene adapter` });
    }
  }

  return issues;
}

export function assertAiConfigValid(env: NodeJS.ProcessEnv, registry: ModelRegistry, providers: ProviderRegistry, qualifications: ModelQualificationRegistry): void {
  const issues = validateAiConfig(env, registry, providers, qualifications);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(`Configuración AI inválida:\n${errors.map((issue) => `- ${issue.message}`).join('\n')}`);
  }
  for (const warning of issues.filter((issue) => issue.severity === 'warning')) {
    console.warn(`[ai-config] ${warning.message}`);
  }
}
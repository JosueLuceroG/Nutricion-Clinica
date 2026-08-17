import type { Role } from '@nutriclinica/shared';
import type { AICompletionRequest } from '../providers/aiProviderAdapter.js';
import { aiGateway, type GatewayResult } from '../aiGateway.js';
import { aiToolRegistry } from '../tools/toolRegistry.js';
import { toolExecutionService, type ToolExecutionService } from '../tools/toolExecutionService.js';
import type { ToolConsentCheck } from '../tools/toolAuthorization.js';
import { capabilityRiskRegistry } from '../contracts/capabilityRiskRegistry.js';
import { computeEffectiveRisk } from '../contracts/riskModel.js';
import { isProfessionalReviewRequired } from '../contracts/humanReviewPolicy.js';
import { checkOutputNumbers } from '../expert/safetyEngine.js';
import { selectKnowledgeDocStore, type KnowledgeDocStore } from '../rag/knowledgeGovernance.js';
import { retrieve, type RetrievedChunk } from '../rag/retrieval.js';
import { verifyCitations } from '../rag/citationVerifier.js';
import { getNutritionCapability, NUTRITION_CAPABILITY_CATALOG } from './nutritionCapabilityRegistry.js';
import { capabilityHandlers, type CapabilityFact } from './capabilityHandlers.js';
import type { RiskLevel } from '../contracts/riskModel.js';

export type CapabilityRunStatus = 'SUCCESS' | 'ABSTAINED' | 'BLOCKED' | 'AI_UNAVAILABLE' | 'FAILED';

export interface CapabilityRunRequest {
  capabilityId: string;
  pacienteId: string;
  sucursalId: string;
  actor: { profesionalId: string; role: Role };
  /** Input de capacidad (p. ej. { planItems: [...] , foodId: '...' }). */
  input?: Record<string, unknown>;
}

export interface CapabilityAuditEvent {
  capabilityId: string;
  pacienteId: string;
  sucursalId: string;
  actor: { profesionalId: string; role: string };
  status: CapabilityRunStatus;
  toolFailures: string[];
  reviewRequired: boolean;
  error?: string;
}

export interface CapabilityRunResult {
  capabilityId: string;
  name: string;
  status: CapabilityRunStatus;
  outputSchemaVersion: string;
  facts: CapabilityFact[];
  payload: Record<string, unknown>;
  aiContent?: string;
  aiEvidence?: { provider: string; model: string };
  reviewRequired: boolean;
  risk: { baseRisk: RiskLevel; effectiveRisk: RiskLevel };
  blockedReason?: string;
  abstentionReason?: string;
  toolFailures: string[];
  catalogVersion?: string;
}

export interface NutritionCapabilityOptions {
  env?: NodeJS.ProcessEnv;
  consent?: ToolConsentCheck;
  audit?: (event: CapabilityAuditEvent) => void | Promise<void>;
  toolService?: ToolExecutionService;
  completeAi?: (req: AICompletionRequest) => Promise<GatewayResult>;
  knowledgeStore?: KnowledgeDocStore;
  retrieveKnowledge?: (input: { store: KnowledgeDocStore; query: string; now: Date; actor: { role: Role; sucursalId: string } }) => Promise<RetrievedChunk[]>;
  now?: Date;
}

const CAPABILITY_STAGE_INSTRUCTIONS = [
  'Eres el asistente del Experto en Nutrición de Nutriclinica (borrador para revision profesional).',
  'Usa EXCLUSIVAMENTE los hechos deterministas provistos. No inventes cifras.',
  'Responde en espanol, breve y estructurado.',
  'Si los hechos son insuficientes, di que no puedes responder con certeza.',
].join('\n');

export class NutritionCapabilityService {
  constructor(private readonly options: NutritionCapabilityOptions = {}) {}

  private async ai(req: AICompletionRequest, egress: { patientId: string; sucursalId: string; actor: { profesionalId: string; role: string } }): Promise<GatewayResult> {
    return this.options.completeAi?.(req) ?? aiGateway.complete(req, {
      requiredCapability: 'nutrition_reasoning',
      egress: { capability: 'nutrition_reasoning', ...egress },
      correlationId: egress.patientId,
    });
  }

  private async retrieveKnowledge(input: { store: KnowledgeDocStore; query: string; now: Date; actor: { role: Role; sucursalId: string } }): Promise<RetrievedChunk[]> {
    return this.options.retrieveKnowledge?.(input) ?? retrieve(input);
  }

  async executeCapability(request: CapabilityRunRequest, options: NutritionCapabilityOptions = {}): Promise<CapabilityRunResult> {
    const env = options.env ?? this.options.env ?? process.env;
    const audit = options.audit ?? this.options.audit;
    const now = options.now ?? this.options.now ?? new Date();
    const consent = options.consent ?? this.options.consent;
    const toolService = options.toolService ?? this.options.toolService ?? toolExecutionService;

    const entry = getNutritionCapability(request.capabilityId);
    if (!entry) {
      const result: CapabilityRunResult = {
        capabilityId: request.capabilityId,
        name: 'Desconocida',
        status: 'FAILED',
        outputSchemaVersion: 'unknown',
        facts: [],
        payload: {},
        reviewRequired: true,
        risk: { baseRisk: 'RISK_3', effectiveRisk: 'RISK_3' },
        toolFailures: [],
        abstentionReason: 'Capacidad desconocida (fail-closed)',
      };
      await audit?.({ capabilityId: request.capabilityId, pacienteId: request.pacienteId, sucursalId: request.sucursalId, actor: request.actor, status: 'FAILED', toolFailures: [], reviewRequired: true, error: 'unknown capability' });
      return result;
    }

    if (entry.status === 'BLOCKED') {
      const result: CapabilityRunResult = {
        capabilityId: entry.capabilityId,
        name: entry.name,
        status: 'BLOCKED',
        outputSchemaVersion: entry.outputSchemaVersion,
        facts: [],
        payload: {},
        reviewRequired: true,
        risk: { baseRisk: 'RISK_3', effectiveRisk: 'RISK_3' },
        blockedReason: entry.blockedReason,
        toolFailures: [],
      };
      await audit?.({ capabilityId: entry.capabilityId, pacienteId: request.pacienteId, sucursalId: request.sucursalId, actor: request.actor, status: 'BLOCKED', toolFailures: [], reviewRequired: true });
      return result;
    }

    if (!aiToolRegistry.isToolsEnabled(env)) {
      const result: CapabilityRunResult = {
        capabilityId: entry.capabilityId,
        name: entry.name,
        status: 'FAILED',
        outputSchemaVersion: entry.outputSchemaVersion,
        facts: [],
        payload: {},
        reviewRequired: true,
        risk: { baseRisk: 'RISK_3', effectiveRisk: 'RISK_3' },
        abstentionReason: 'Herramientas IA deshabilitadas',
        toolFailures: [],
      };
      await audit?.({ capabilityId: entry.capabilityId, pacienteId: request.pacienteId, sucursalId: request.sucursalId, actor: request.actor, status: 'FAILED', toolFailures: [], reviewRequired: true, error: 'tools disabled' });
      return result;
    }

    const collected: Record<string, unknown> = {};
    const toolFailures: string[] = [];
    for (const toolId of entry.tools) {
      const invokeResult = await toolService.invoke(
        { toolId, args: { pacienteId: request.pacienteId }, actor: request.actor, sucursalId: request.sucursalId, pacienteId: request.pacienteId },
        { env, consent, audit: undefined },
      );
      if (invokeResult.ok) {
        collected[toolId] = invokeResult.data;
      } else {
        toolFailures.push(`${toolId}:${invokeResult.status}`);
        collected[toolId] = undefined;
      }
    }

    const handler = capabilityHandlers[entry.capabilityId];
    if (!handler) {
      const result: CapabilityRunResult = {
        capabilityId: entry.capabilityId,
        name: entry.name,
        status: 'FAILED',
        outputSchemaVersion: entry.outputSchemaVersion,
        facts: [],
        payload: {},
        reviewRequired: true,
        risk: { baseRisk: 'RISK_3', effectiveRisk: 'RISK_3' },
        abstentionReason: 'Sin handler determinista registrado',
        toolFailures,
      };
      await audit?.({ capabilityId: entry.capabilityId, pacienteId: request.pacienteId, sucursalId: request.sucursalId, actor: request.actor, status: 'FAILED', toolFailures, reviewRequired: true, error: 'missing handler' });
      return result;
    }

    const deterministic = await handler({
      request,
      tools: collected,
      toolFailures,
      now,
      retrieveKnowledge: async (query: string) => this.retrieveKnowledge({ store: this.options.knowledgeStore ?? selectKnowledgeDocStore(), query, now, actor: { role: request.actor.role, sucursalId: request.sucursalId } }),
    });

    const riskEntry = capabilityRiskRegistry.get(entry.riskCapability);
    const baseRisk: RiskLevel = riskEntry?.baseRisk ?? 'RISK_3';
    const hasBlocker = deterministic.flags.some((f) => f.severity === 'blocker');
    const effectiveRisk = computeEffectiveRisk(baseRisk, {
      redFlag: hasBlocker,
      majorUncertainty: deterministic.flags.some((f) => f.severity === 'warning'),
      criticalDataMissing: toolFailures.length > 0,
    });

    if (deterministic.abstain) {
      const result: CapabilityRunResult = {
        capabilityId: entry.capabilityId,
        name: entry.name,
        status: 'ABSTAINED',
        outputSchemaVersion: entry.outputSchemaVersion,
        facts: deterministic.facts,
        payload: deterministic.payload,
        reviewRequired: true,
        risk: { baseRisk, effectiveRisk },
        abstentionReason: deterministic.abstain.reason,
        toolFailures,
      };
      await audit?.({ capabilityId: entry.capabilityId, pacienteId: request.pacienteId, sucursalId: request.sucursalId, actor: request.actor, status: 'ABSTAINED', toolFailures, reviewRequired: true });
      return result;
    }

    let aiContent: string | undefined;
    let aiEvidence: { provider: string; model: string } | undefined;
    if (entry.llmStage) {
      const prompt = [CAPABILITY_STAGE_INSTRUCTIONS, `## Capacidad\n${entry.name}`, '## Hechos deterministas', deterministic.promptSections.join('\n\n')].join('\n\n');
      const gatewayResult = await this.ai({ model: '', systemPrompt: prompt, userPrompt: `Ejecuta la capacidad '${entry.capabilityId}' con los hechos provistos.` }, { patientId: request.pacienteId, sucursalId: request.sucursalId, actor: request.actor });
      if (!gatewayResult.ok) {
        const result: CapabilityRunResult = {
          capabilityId: entry.capabilityId,
          name: entry.name,
          status: 'AI_UNAVAILABLE',
          outputSchemaVersion: entry.outputSchemaVersion,
          facts: deterministic.facts,
          payload: deterministic.payload,
          reviewRequired: true,
          risk: { baseRisk, effectiveRisk },
          abstentionReason: gatewayResult.message,
          toolFailures,
        };
        await audit?.({ capabilityId: entry.capabilityId, pacienteId: request.pacienteId, sucursalId: request.sucursalId, actor: request.actor, status: 'AI_UNAVAILABLE', toolFailures, reviewRequired: true, error: gatewayResult.message });
        return result;
      }
      const citations = verifyCitations({ content: gatewayResult.result.content, retrievedDocIds: deterministic.knowledge?.map((k) => k.docId) ?? [] });
      if (!citations.ok) {
        const result: CapabilityRunResult = {
          capabilityId: entry.capabilityId,
          name: entry.name,
          status: 'ABSTAINED',
          outputSchemaVersion: entry.outputSchemaVersion,
          facts: deterministic.facts,
          payload: deterministic.payload,
          reviewRequired: true,
          risk: { baseRisk, effectiveRisk },
          abstentionReason: 'La salida cita fuentes sin respaldo',
          toolFailures,
        };
        await audit?.({ capabilityId: entry.capabilityId, pacienteId: request.pacienteId, sucursalId: request.sucursalId, actor: request.actor, status: 'ABSTAINED', toolFailures, reviewRequired: true });
        return result;
      }
      const outputSafety = checkOutputNumbers(gatewayResult.result.content, deterministic.allowedNumbers ?? []);
      if (outputSafety.hasBlocker) {
        const result: CapabilityRunResult = {
          capabilityId: entry.capabilityId,
          name: entry.name,
          status: 'ABSTAINED',
          outputSchemaVersion: entry.outputSchemaVersion,
          facts: deterministic.facts,
          payload: deterministic.payload,
          reviewRequired: true,
          risk: { baseRisk, effectiveRisk },
          abstentionReason: 'La salida contiene numeros sin respaldo en la evidencia',
          toolFailures,
        };
        await audit?.({ capabilityId: entry.capabilityId, pacienteId: request.pacienteId, sucursalId: request.sucursalId, actor: request.actor, status: 'ABSTAINED', toolFailures, reviewRequired: true });
        return result;
      }
      aiContent = gatewayResult.result.content;
      aiEvidence = { provider: gatewayResult.provider, model: gatewayResult.model };
    }

    const reviewRequired = isProfessionalReviewRequired(effectiveRisk, riskEntry?.humanReviewPolicy);
    const result: CapabilityRunResult = {
      capabilityId: entry.capabilityId,
      name: entry.name,
      status: 'SUCCESS',
      outputSchemaVersion: entry.outputSchemaVersion,
      facts: deterministic.facts,
      payload: deterministic.payload,
      aiContent,
      aiEvidence,
      reviewRequired,
      risk: { baseRisk, effectiveRisk },
      toolFailures,
      catalogVersion: 'catalogVersion' in deterministic.payload ? String(deterministic.payload.catalogVersion) : undefined,
    };
    await audit?.({ capabilityId: entry.capabilityId, pacienteId: request.pacienteId, sucursalId: request.sucursalId, actor: request.actor, status: 'SUCCESS', toolFailures, reviewRequired });
    return result;
  }
}

export const nutritionCapabilityService = new NutritionCapabilityService();

export function capabilityCatalogSummary(): { implemented: number; partial: number; blocked: number; total: number } {
  return {
    implemented: NUTRITION_CAPABILITY_CATALOG.filter((e) => e.status === 'IMPLEMENTED').length,
    partial: NUTRITION_CAPABILITY_CATALOG.filter((e) => e.status === 'PARTIAL').length,
    blocked: NUTRITION_CAPABILITY_CATALOG.filter((e) => e.status === 'BLOCKED').length,
    total: NUTRITION_CAPABILITY_CATALOG.length,
  };
}
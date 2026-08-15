import type { AICompletionRequest } from '../providers/aiProviderAdapter.js';
import { aiGateway, type GatewayResult } from '../aiGateway.js';
import { verifyCitations, CITATION_PATTERN, type CitationVerification } from '../rag/citationVerifier.js';
import { selectKnowledgeDocStore, type KnowledgeDocStore } from '../rag/knowledgeGovernance.js';
import { retrieve, type RetrievedChunk } from '../rag/retrieval.js';
import type { MemoryEntry } from '../memory/memoryTypes.js';
import type { Role } from '@nutriclinica/shared';
import { decideAbstention } from './abstentionPolicy.js';
import { runCalculators, type CalculatorResult } from './calculators.js';
import { buildContext, erpContextDataSources, hasValidAnthropometry, numericTokensFromContext, renderContextForPrompt, type ContextDataSources, type PatientContext } from './contextBuilder.js';
import { buildEnvelope, type EvidenceEnvelope } from './evidenceEnvelope.js';
import { renderGoldenRulesForPrompt } from './goldenRules.js';
import { assessContext, assessPhysiological, checkOutputNumbers, combineSafety, safetyRulesForPrompt, type SafetyReport } from './safetyEngine.js';

export type NutritionAdviceStatus = 'advice' | 'abstained' | 'referral' | 'ai_unavailable';

export interface NutritionAdviceInput {
  pacienteId: string;
  sucursalId: string;
  goal?: string;
  notes?: string;
}

export interface NutritionAdviceResult {
  status: NutritionAdviceStatus;
  envelope: EvidenceEnvelope;
  advice?: { content: string };
}

export interface NutritionAdviceAudit {
  status: NutritionAdviceStatus;
  pacienteId: string;
  sucursalId: string;
  actor: { profesionalId: string; role: string };
  envelope: EvidenceEnvelope;
  error?: string;
}

export interface NutritionWorkflowOptions {
  dataSources?: ContextDataSources;
  completeAi?: (req: AICompletionRequest) => Promise<GatewayResult>;
  audit?: (event: NutritionAdviceAudit) => Promise<void>;
  now?: () => Date;
  knowledgeStore?: KnowledgeDocStore;
  retrieveKnowledge?: (input: { store: KnowledgeDocStore; query: string; now: Date; actor: { role: Role; sucursalId: string } }) => Promise<RetrievedChunk[]>;
  memoryRetriever?: (input: { pacienteId: string; sucursalId: string; actor: { profesionalId: string; role: string } }) => Promise<MemoryEntry[]>;
}

const SYSTEM_INSTRUCTIONS = [
  'Eres un asistente nutricional educativo de Nutriclinica.',
  'Usa EXCLUSIVAMENTE los datos y calculadoras provistos en el contexto.',
  'Responde en espanol, de forma breve, estructurada y educativa.',
  'No inventes cifras: si una cifra aparece en tu respuesta debe estar respaldada por el contexto o las calculadoras.',
  'Si la evidencia es insuficiente, declara abstencion en lugar de improvisar.',
  'Cita las fuentes de conocimiento con [<docId>] cuando uses una recomendacion de esa fuente; nunca cites fuentes que no aparezcan en la seccion de conocimiento.',
  'La memoria del paciente es contexto auxiliar NO autoritativo: no la cites ni la uses como fuente clinica.',
  'El consejo es un borrador que una nutriologa debe revisar antes de entregarse al paciente.',
].join('\n');

export class NutritionWorkflow {
  constructor(private readonly options: NutritionWorkflowOptions = {}) {}

  private async ai(req: AICompletionRequest): Promise<GatewayResult> {
    return this.options.completeAi?.(req) ?? aiGateway.complete(req, { requiredCapability: 'nutrition_reasoning' });
  }

  private buildPrompt(ctx: PatientContext, calculators: CalculatorResult[], goal: string | undefined, notes: string | undefined, knowledge: RetrievedChunk[], memory: MemoryEntry[]): string {
    const calculatorLines = calculators.length > 0 ? calculators.map((c) => `- ${c.name}: ${c.value} ${c.unit} (${c.basis})`).join('\n') : '(sin calculadoras: faltan datos de peso/talla)';
    const knowledgeLines = knowledge.length > 0
      ? knowledge.map((chunk) => `- [${chunk.docId}] ${chunk.title} (${chunk.tier}): ${chunk.snippet}`).join('\n')
      : '(sin fuentes de conocimiento recuperadas: usa solo el contexto y las calculadoras)';
    const memoryLines = memory.length > 0
      ? memory.map((entry) => `- (${entry.source}) ${entry.content}`).join('\n')
      : '(sin memoria recuperada)';
    return [
      SYSTEM_INSTRUCTIONS,
      renderContextForPrompt(ctx),
      '## Calculos deterministas',
      calculatorLines,
      '## Reglas de oro',
      renderGoldenRulesForPrompt(),
      '## Conocimiento de respaldo',
      knowledgeLines,
      '## Memoria del paciente (NO autoritativa)',
      memoryLines,
      '## Banderas de seguridad',
      safetyRulesForPrompt(),
      goal ? `## Objetivo del paciente\n${goal}` : '',
      notes ? `## Notas adicionales del profesional\n${notes}` : '',
      '## Tarea\nGenera el consejo educativo (borrador para revision profesional).',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private async retrieveKnowledge(input: {
    store: KnowledgeDocStore;
    query: string;
    now: Date;
    actor: { role: Role; sucursalId: string };
  }): Promise<RetrievedChunk[]> {
    return this.options.retrieveKnowledge?.(input) ?? retrieve(input);
  }

  async run(input: NutritionAdviceInput, actor: { profesionalId: string; role: string }): Promise<NutritionAdviceResult> {
    const now = this.options.now?.() ?? new Date();
    const audit = this.options.audit;

    const ctx = await buildContext(this.options.dataSources ?? erpContextDataSources, {
      pacienteId: input.pacienteId,
      sucursalId: input.sucursalId,
    }, now);

    let knowledge: RetrievedChunk[];
    try {
      knowledge = await this.retrieveKnowledge({
        store: this.options.knowledgeStore ?? selectKnowledgeDocStore(),
        query: buildKnowledgeQuery(ctx, input.goal, input.notes),
        now,
        actor: { role: actor.role as Role, sucursalId: input.sucursalId },
      });
    } catch (err) {
      const envelope = buildEnvelope({
        ctx,
        calculators: [],
        safetyFlags: [],
        abstention: { kind: 'knowledge_unavailable', reason: 'El conocimiento de respaldo no esta disponible' },
        reviewRequired: true,
        generatedAt: now,
      });
      const result: NutritionAdviceResult = { status: 'abstained', envelope };
      await audit?.({ status: result.status, pacienteId: input.pacienteId, sucursalId: input.sucursalId, actor, envelope, error: err instanceof Error ? err.message : String(err) });
      return result;
    }

    let memory: MemoryEntry[] = [];
    if (this.options.memoryRetriever) {
      try {
        memory = await this.options.memoryRetriever({ pacienteId: input.pacienteId, sucursalId: input.sucursalId, actor });
      } catch (err) {
        console.warn('[expert] memory retrieval failed:', err instanceof Error ? err.message : err);
        memory = [];
      }
    }

    const physiological = assessPhysiological({
      weightKg: ctx.anthropometry?.weightKg,
      heightM: ctx.anthropometry?.heightM,
      ageYears: ctx.ageYears,
    });
    const contextual = assessContext(ctx);
    const safety: SafetyReport = combineSafety(physiological, contextual);

    const calculators = hasValidAnthropometry(ctx) ? runCalculators({
      weightKg: ctx.anthropometry!.weightKg,
      heightM: ctx.anthropometry!.heightM,
      sex: ctx.genero === 'femenino' || ctx.genero === 'masculino' ? ctx.genero : undefined,
      ageYears: ctx.ageYears,
      activity: 'moderado',
    }) : [];

    const abstention = decideAbstention({
      ctx,
      safety,
      hasCalculators: calculators.length > 0,
      hasPlanTargets: Boolean(ctx.activePlan && ctx.activePlan.kcalTarget !== undefined),
    });

    if (abstention.abstain) {
      const envelope = buildEnvelope({
        ctx,
        calculators,
        safetyFlags: safety.flags,
        abstention: {
          kind: abstention.kind ?? 'missing_data',
          reason: abstention.reason ?? 'Datos insuficientes',
        },
        reviewRequired: true,
        generatedAt: now,
      });
      const result: NutritionAdviceResult = {
        status: abstention.kind === 'safety' ? 'referral' : 'abstained',
        envelope,
      };
      await audit?.({ status: result.status, pacienteId: input.pacienteId, sucursalId: input.sucursalId, actor, envelope });
      return result;
    }

    const prompt = this.buildPrompt(ctx, calculators, input.goal, input.notes, knowledge, memory);
    const gatewayResult = await this.ai({ model: '', systemPrompt: prompt, userPrompt: input.goal ?? 'Genera el consejo educativo.' });
    if (!gatewayResult.ok) {
      const envelope = buildEnvelope({
        ctx,
        calculators,
        safetyFlags: safety.flags,
        reviewRequired: true,
        generatedAt: now,
      });
      const result: NutritionAdviceResult = { status: 'ai_unavailable', envelope };
      await audit?.({ status: result.status, pacienteId: input.pacienteId, sucursalId: input.sucursalId, actor, envelope, error: gatewayResult.message });
      return result;
    }

    const { result: completion } = gatewayResult;
    const citations: CitationVerification = verifyCitations({
      content: completion.content,
      retrievedDocIds: knowledge.map((chunk) => chunk.docId),
    });
    if (!citations.ok) {
      const envelope = buildEnvelope({
        ctx,
        calculators,
        safetyFlags: safety.flags,
        abstention: { kind: 'ungrounded', reason: 'La salida cita fuentes sin respaldo en la evidencia recuperada' },
        knowledge,
        memory,
        citations,
        reviewRequired: true,
        generatedAt: now,
      });
      const result: NutritionAdviceResult = { status: 'abstained', envelope };
      await audit?.({ status: result.status, pacienteId: input.pacienteId, sucursalId: input.sucursalId, actor, envelope });
      return result;
    }

    const contentWithoutCitations = completion.content.replace(CITATION_PATTERN, '');
    const allowedNumbers = numericTokensFromContext(ctx).concat(calculators.map((c) => c.value));
    const outputSafety = checkOutputNumbers(contentWithoutCitations, allowedNumbers);
    if (outputSafety.hasBlocker) {
      const envelope = buildEnvelope({
        ctx,
        calculators,
        safetyFlags: [...safety.flags, ...outputSafety.flags],
        abstention: { kind: 'unverifiable', reason: 'La salida contiene numeros sin respaldo en la evidencia' },
        knowledge,
        memory,
        citations,
        reviewRequired: true,
        generatedAt: now,
      });
      const result: NutritionAdviceResult = { status: 'abstained', envelope };
      await audit?.({ status: result.status, pacienteId: input.pacienteId, sucursalId: input.sucursalId, actor, envelope });
      return result;
    }

    const envelope = buildEnvelope({
      ctx,
      calculators,
      safetyFlags: safety.flags,
      ai: {
        provider: gatewayResult.provider,
        model: gatewayResult.model,
        usage: completion.usage,
        finishReason: completion.finishReason,
      },
      knowledge,
      memory,
      citations,
      reviewRequired: true,
      generatedAt: now,
    });
    const result: NutritionAdviceResult = { status: 'advice', envelope, advice: { content: completion.content } };
    await audit?.({ status: result.status, pacienteId: input.pacienteId, sucursalId: input.sucursalId, actor, envelope });
    return result;
  }
}

export const nutritionExpertWorkflow = new NutritionWorkflow();

export function buildKnowledgeQuery(ctx: PatientContext, goal: string | undefined, notes: string | undefined): string {
  return [
    goal,
    notes,
    ctx.genero === 'femenino' || ctx.genero === 'masculino' ? ctx.genero : '',
    ctx.ageYears !== undefined ? 'adulto' : '',
    'recomendacion nutricional',
  ]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join(' ');
}
import type { AICompletionRequest } from '../providers/aiProviderAdapter.js';
import { aiGateway, type GatewayResult } from '../aiGateway.js';
import { filterStructuredShape } from '../egress/capabilityContracts.js';
import { verifyCitations, CITATION_PATTERN, type CitationVerification } from '../rag/citationVerifier.js';
import { selectKnowledgeDocStore, type KnowledgeDocStore } from '../rag/knowledgeGovernance.js';
import { retrieve, type RetrievedChunk } from '../rag/retrieval.js';
import type { MemoryEntry } from '../memory/memoryTypes.js';
import type { Role } from '@nutriclinica/shared';
import { decideAbstention } from './abstentionPolicy.js';
import { runCalculators, type CalculatorResult } from './calculators.js';
import { buildContext, erpContextDataSources, hasValidAnthropometry, numericTokensFromContext, renderContextForPrompt, type ContextDataSources, type PatientContext } from './contextBuilder.js';
import { buildEnvelope, type EvidenceEnvelope, type EvidenceEnvelopeClinical } from './evidenceEnvelope.js';
import { renderGoldenRulesForPrompt } from './goldenRules.js';
import { assessContext, assessPhysiological, checkOutputNumbers, combineSafety, safetyRulesForPrompt, type SafetyReport } from './safetyEngine.js';
import { capabilityRiskRegistry } from '../contracts/capabilityRiskRegistry.js';
import { computeEffectiveRisk } from '../contracts/riskModel.js';
import { isProfessionalReviewRequired } from '../contracts/humanReviewPolicy.js';
import { computeConfidence } from '../contracts/confidenceEngine.js';
import { detectContradictions } from '../contracts/contradictionDetection.js';
import { deriveMissingInformation } from '../contracts/missingInformation.js';
import { abstained, abstentionFromLegacyKind, type AbstentionResult } from '../contracts/abstentionContract.js';
import type { ClinicalClaim } from '../contracts/evidenceEnvelope.js';

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

  private async ai(req: AICompletionRequest, egress: { patientId: string; sucursalId: string; actor: { profesionalId: string; role: string } }): Promise<GatewayResult> {
    return this.options.completeAi?.(req) ?? aiGateway.complete(req, {
      requiredCapability: 'nutrition_reasoning',
      egress: { capability: 'nutrition_reasoning', ...egress },
      correlationId: egress.patientId,
    });
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

  /** Contrato clínico determinista del consejo: riesgo, claims con procedencia real, confianza, abstención formal. */
  private clinicalContract(input: {
    ctx: PatientContext;
    calculators: CalculatorResult[];
    safety: SafetyReport;
    knowledge: RetrievedChunk[];
    citations?: CitationVerification;
    abstentionKind?: string;
    ai?: { provider: string; model: string };
    status: NutritionAdviceStatus;
  }): EvidenceEnvelopeClinical {
    const riskEntry = capabilityRiskRegistry.get('nutrition_reasoning');
    const baseRisk = riskEntry?.baseRisk ?? 'RISK_3';
    const effectiveRisk = computeEffectiveRisk(baseRisk, {
      redFlag: input.safety.hasBlocker,
      majorUncertainty: input.safety.flags.some((f) => f.severity === 'warning') || (input.citations ? !input.citations.ok : false),
      criticalDataMissing: input.ctx.profileMissing,
    });

    const claims: ClinicalClaim[] = [];
    for (const calc of input.calculators) {
      claims.push({
        id: `claim-calc-${calc.id}`,
        text: `${calc.name}: ${calc.value} ${calc.unit}`,
        claimType: 'CALCULATED_VALUE',
        evidence: [{
          source: calc.id,
          sourceType: 'CALCULATOR',
          calculationId: calc.id,
          calculationVersion: 'v1',
          supports: ['valor calculado determinista'],
        }],
        confidence: 'HIGH',
        missingInformation: [],
        contradictions: [],
      });
    }
    for (const flag of input.safety.flags.filter((f) => f.severity === 'blocker' || f.severity === 'warning')) {
      claims.push({
        id: `claim-rule-${flag.id}`,
        text: flag.message,
        claimType: 'RULE_RESULT',
        evidence: [{
          source: 'safety_validator',
          sourceType: 'RULE_ENGINE',
          ruleId: flag.ruleId,
          ruleVersion: 'v1',
          supports: ['resultado de validador determinista'],
        }],
        confidence: 'HIGH',
        missingInformation: [],
        contradictions: [],
      });
    }
    if (input.citations?.ok && input.knowledge.length > 0) {
      const withVersion = input.knowledge.filter((chunk) => Boolean((chunk as unknown as { version?: string }).version));
      for (const chunk of withVersion) {
        claims.push({
          id: `claim-doc-${chunk.docId}`,
          text: chunk.title,
          claimType: 'DOCUMENTED_GUIDANCE',
          evidence: [{
            source: chunk.docId,
            sourceType: 'RAG',
            documentId: chunk.docId,
            documentVersion: (chunk as unknown as { version: string }).version,
            supports: ['contenido documental aprobado con cita válida'],
          }],
          confidence: 'MEDIUM',
          missingInformation: [],
          contradictions: [],
        });
      }
    }
    if (input.ai) {
      claims.push({
        id: 'claim-ai-output',
        text: 'Respuesta generada por el modelo',
        claimType: input.status === 'advice' ? 'AI_RECOMMENDATION' : 'AI_INTERPRETATION',
        evidence: [{
          source: `${input.ai.provider}/${input.ai.model}`,
          sourceType: 'MODEL_INFERENCE',
          supports: ['inferencia del modelo'],
        }],
        confidence: 'LOW',
        missingInformation: [],
        contradictions: [],
      });
    }

    const citationValid = input.citations?.ok ?? true;
    const groundingRequired = input.knowledge.length > 0;
    const missingInformation = deriveMissingInformation({
      requiredCapabilityFields: ['anthropometry', 'sex', 'age'],
      presentCapabilityFields: [
        ...(input.ctx.anthropometry ? ['anthropometry'] : []),
        ...(input.ctx.genero ? ['sex'] : []),
        ...(input.ctx.ageYears !== undefined ? ['age'] : []),
      ],
      toolFailures: [],
      missingEvidence: input.calculators.length === 0 ? ['calculadoras deterministas'] : [],
      staleData: [],
      documentSupportMissing: input.citations && !input.citations.ok ? input.citations.missing : [],
      groundingFailed: groundingRequired && !citationValid,
    });

    const contradictions = detectContradictions({
      explicitClaims: input.safety.flags.filter((f) => f.id === 'out_unverified_number').map((f) => ({
        ref: 'ai-output',
        contradictsRef: 'contexto',
        detail: f.message,
      })),
    });

    const confidence = computeConfidence({
      requiredEvidenceCount: 3,
      evidenceCount: input.calculators.length + input.knowledge.filter((c) => (input.citations?.ok ? input.citations.cited.includes(c.docId) : false)).length,
      authoritativeSources: input.calculators.length + (input.citations?.ok ? input.citations.cited.length : 0),
      contradictions: contradictions.length,
      missingRequired: input.ctx.profileMissing || input.calculators.length === 0 ? 1 : 0,
      staleSources: 0,
      validatorFailures: input.safety.flags.filter((f) => f.severity === 'blocker').length,
      groundingValid: citationValid,
      groundingRequired,
      toolSuccess: true,
      sourceTier: 'authoritative',
      citationValid,
    });

    let abstentionResult: AbstentionResult | undefined;
    if (input.abstentionKind) {
      const code = abstentionFromLegacyKind(input.abstentionKind);
      abstentionResult = abstained(code ? [code] : ['INSUFFICIENT_EVIDENCE'], {
        missingInformation,
        contradictions,
        riskLevel: effectiveRisk,
      });
    }

    return {
      capability: 'nutrition_reasoning',
      baseRisk,
      effectiveRisk,
      claims,
      confidence,
      missingInformation,
      contradictions,
      requiresProfessionalReview: isProfessionalReviewRequired(effectiveRisk, riskEntry?.humanReviewPolicy),
      abstention: abstentionResult,
    };
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
        clinical: this.clinicalContract({
          ctx,
          calculators: [],
          safety: { flags: [], hasBlocker: false, requiresReferral: false },
          knowledge: [],
          abstentionKind: 'knowledge_unavailable',
          status: 'abstained',
        }),
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
        clinical: this.clinicalContract({
          ctx,
          calculators,
          safety,
          knowledge,
          abstentionKind: abstention.kind ?? 'missing_data',
          status: 'abstained',
        }),
      });
      const result: NutritionAdviceResult = {
        status: abstention.kind === 'safety' ? 'referral' : 'abstained',
        envelope,
      };
      await audit?.({ status: result.status, pacienteId: input.pacienteId, sucursalId: input.sucursalId, actor, envelope });
      return result;
    }

    const egressFilteredCtx = filterStructuredShape('expert_context', ctx, 'nutrition_reasoning');
    const ctxForPrompt = (egressFilteredCtx.filtered ?? ctx) as PatientContext;

    const prompt = this.buildPrompt(ctxForPrompt, calculators, input.goal, input.notes, knowledge, memory);
    const gatewayResult = await this.ai(
      { model: '', systemPrompt: prompt, userPrompt: input.goal ?? 'Genera el consejo educativo.' },
      { patientId: input.pacienteId, sucursalId: input.sucursalId, actor },
    );
    if (!gatewayResult.ok) {
      const envelope = buildEnvelope({
        ctx,
        calculators,
        safetyFlags: safety.flags,
        reviewRequired: true,
        generatedAt: now,
        clinical: this.clinicalContract({
          ctx,
          calculators,
          safety,
          knowledge,
          status: 'ai_unavailable',
        }),
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
        clinical: this.clinicalContract({
          ctx,
          calculators,
          safety,
          knowledge,
          citations,
          abstentionKind: 'ungrounded',
          status: 'abstained',
        }),
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
        clinical: this.clinicalContract({
          ctx,
          calculators,
          safety: combineSafety(safety, outputSafety),
          knowledge,
          citations,
          abstentionKind: 'unverifiable',
          status: 'abstained',
        }),
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
      clinical: this.clinicalContract({
        ctx,
        calculators,
        safety,
        knowledge,
        citations,
        ai: { provider: gatewayResult.provider, model: gatewayResult.model },
        status: 'advice',
      }),
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
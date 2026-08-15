import type { AICompletionRequest } from '../providers/aiProviderAdapter.js';
import { aiGateway, type GatewayResult } from '../aiGateway.js';
import { verifyCitations, CITATION_PATTERN, type CitationVerification } from '../rag/citationVerifier.js';
import { selectKnowledgeDocStore, isDocUsable, type KnowledgeDocStore } from '../rag/knowledgeGovernance.js';
import { retrieveFromDocs, type RetrievedChunk } from '../rag/retrieval.js';
import type { SafetyFlag } from '../expert/safetyEngine.js';
import { checkOutputNumbers } from '../expert/safetyEngine.js';
import { classifyEscalation, safeLanguageCheck } from './patientGuardrails.js';

export type PatientSupportStatus = 'advice' | 'escalated' | 'abstained' | 'ai_unavailable';

export interface PatientSupportEnvelope {
  kind: 'patient_support';
  version: '1.0';
  generatedAt: string;
  sources: Array<{ type: 'knowledge'; docId: string; title: string; tier: string }>;
  safetyFlags: SafetyFlag[];
  citations?: CitationVerification;
  abstention?: { kind: string; reason: string };
  escalated?: { matchedTerms: string[] };
  ai?: { provider: string; model: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; finishReason?: 'stop' | 'length' | 'error' };
}

export interface PatientSupportResult {
  status: PatientSupportStatus;
  envelope: PatientSupportEnvelope;
  response?: { content: string };
}

export interface PatientWorkflowOptions {
  completeAi?: (req: AICompletionRequest) => Promise<GatewayResult>;
  knowledgeStore?: KnowledgeDocStore;
  now?: () => Date;
}

const PATIENT_SYSTEM_INSTRUCTIONS = [
  'Eres un asistente de apoyo nutricional educativo para pacientes de Nutriclinica.',
  'Responde en espanol, de forma breve, amable y estrictamente educativa.',
  'Usa EXCLUSIVAMENTE las fuentes educativas provistas en la seccion de conocimiento.',
  'Cita cada fuente con [<docId>] cuando uses una recomendacion de esa fuente; nunca cites fuentes que no aparezcan en la seccion.',
  'No inventes cifras: si una cifra aparece en tu respuesta debe estar respaldada por las fuentes.',
  'No diagnostiques, no recomiendes medicamentos ni cambios de tratamiento, y no uses lenguaje alarmista.',
  'Si el paciente menciona sintomas, medicamentos o situaciones de urgencia, no respondas: pide que contacte a su nutriologa.',
  'Cuando no tengas evidencia suficiente, declara que no puedes responder con certeza y sugiere consultar a su nutriologa.',
].join('\n');

const ESCALATED_RESPONSE =
  'Tu mensaje incluye un tema que requiere atencion de tu nutriologa y no puedo responderlo. ' +
  'Envia un mensaje desde el portal para que te contacte lo antes posible.';

const PATIENT_SCOPED_ROLE = 'nutriologa';

export class PatientWorkflow {
  constructor(private readonly options: PatientWorkflowOptions = {}) {}

  private async ai(req: AICompletionRequest): Promise<GatewayResult> {
    return this.options.completeAi?.(req) ?? aiGateway.complete(req, { requiredCapability: 'patient_support' });
  }

  private async retrieveEducational(input: { store: KnowledgeDocStore; query: string; now: Date; sucursalId: string }): Promise<RetrievedChunk[]> {
    const docs = await input.store.list({ sucursalId: input.sucursalId });
    const usable = docs.filter((doc) => doc.tier === 'educational' && isDocUsable(doc, { now: input.now, role: PATIENT_SCOPED_ROLE, sucursalId: input.sucursalId }));
    return retrieveFromDocs({ query: input.query, docs: usable });
  }

  private buildPrompt(query: string, knowledge: RetrievedChunk[]): string {
    const knowledgeLines = knowledge.length > 0
      ? knowledge.map((chunk) => `- [${chunk.docId}] ${chunk.title}: ${chunk.snippet}`).join('\n')
      : '(sin fuentes educativas)';
    return [
      PATIENT_SYSTEM_INSTRUCTIONS,
      '## Conocimiento educativo de respaldo',
      knowledgeLines,
      '## Pregunta del paciente',
      query,
      '## Tarea\nResponde de forma educativa y segura, citando las fuentes que uses.',
    ].join('\n\n');
  }

  async run(input: { query: string }, ctx: { sucursalId: string }): Promise<PatientSupportResult> {
    const now = this.options.now?.() ?? new Date();

    const escalation = classifyEscalation(input.query);
    if (escalation.escalate) {
      return {
        status: 'escalated',
        response: { content: ESCALATED_RESPONSE },
        envelope: {
          kind: 'patient_support',
          version: '1.0',
          generatedAt: now.toISOString(),
          sources: [],
          safetyFlags: [],
          escalated: { matchedTerms: escalation.matchedTerms },
        },
      };
    }

    let knowledge: RetrievedChunk[];
    try {
      knowledge = await this.retrieveEducational({
        store: this.options.knowledgeStore ?? selectKnowledgeDocStore(),
        query: input.query,
        now,
        sucursalId: ctx.sucursalId,
      });
    } catch {
      return {
        status: 'abstained',
        envelope: {
          kind: 'patient_support',
          version: '1.0',
          generatedAt: now.toISOString(),
          sources: [],
          safetyFlags: [],
          abstention: { kind: 'knowledge_unavailable', reason: 'El conocimiento educativo de respaldo no esta disponible' },
        },
      };
    }

    if (knowledge.length === 0) {
      return {
        status: 'abstained',
        envelope: {
          kind: 'patient_support',
          version: '1.0',
          generatedAt: now.toISOString(),
          sources: [],
          safetyFlags: [],
          abstention: { kind: 'ungrounded', reason: 'No hay fuentes educativas suficientes para responder con seguridad' },
        },
      };
    }

    const prompt = this.buildPrompt(input.query, knowledge);
    const gatewayResult = await this.ai({ model: '', systemPrompt: prompt, userPrompt: input.query });
    if (!gatewayResult.ok) {
      return {
        status: 'ai_unavailable',
        envelope: {
          kind: 'patient_support',
          version: '1.0',
          generatedAt: now.toISOString(),
          sources: knowledge.map((chunk) => ({ type: 'knowledge' as const, docId: chunk.docId, title: chunk.title, tier: chunk.tier })),
          safetyFlags: [],
        },
      };
    }

    const { result: completion } = gatewayResult;
    const citations: CitationVerification = verifyCitations({
      content: completion.content,
      retrievedDocIds: knowledge.map((chunk) => chunk.docId),
    });
    if (!citations.ok) {
      return {
        status: 'abstained',
        envelope: {
          kind: 'patient_support',
          version: '1.0',
          generatedAt: now.toISOString(),
          sources: knowledge.map((chunk) => ({ type: 'knowledge' as const, docId: chunk.docId, title: chunk.title, tier: chunk.tier })),
          safetyFlags: [],
          citations,
          abstention: { kind: 'ungrounded', reason: 'La salida cita fuentes sin respaldo en la evidencia educativa' },
        },
      };
    }

    const contentWithoutCitations = completion.content.replace(CITATION_PATTERN, '');
    const allowedNumbers = Array.from(
      new Set(knowledge.flatMap((chunk) => (chunk.snippet.match(/\d+(?:\.\d+)?/g) ?? []).map(Number))),
    );
    const outputSafety = checkOutputNumbers(contentWithoutCitations, allowedNumbers);
    if (outputSafety.hasBlocker) {
      return {
        status: 'abstained',
        envelope: {
          kind: 'patient_support',
          version: '1.0',
          generatedAt: now.toISOString(),
          sources: knowledge.map((chunk) => ({ type: 'knowledge' as const, docId: chunk.docId, title: chunk.title, tier: chunk.tier })),
          safetyFlags: outputSafety.flags,
          citations,
          abstention: { kind: 'unverifiable', reason: 'La salida contiene numeros sin respaldo en la evidencia educativa' },
        },
      };
    }

    const language = safeLanguageCheck(completion.content);
    if (language.unsafe) {
      return {
        status: 'abstained',
        envelope: {
          kind: 'patient_support',
          version: '1.0',
          generatedAt: now.toISOString(),
          sources: knowledge.map((chunk) => ({ type: 'knowledge' as const, docId: chunk.docId, title: chunk.title, tier: chunk.tier })),
          safetyFlags: outputSafety.flags,
          citations,
          abstention: { kind: 'unsafe_language', reason: 'La salida contiene lenguaje no seguro para pacientes' },
        },
      };
    }

    return {
      status: 'advice',
      response: { content: completion.content },
      envelope: {
        kind: 'patient_support',
        version: '1.0',
        generatedAt: now.toISOString(),
        sources: knowledge.map((chunk) => ({ type: 'knowledge' as const, docId: chunk.docId, title: chunk.title, tier: chunk.tier })),
        safetyFlags: outputSafety.flags,
        citations,
        ai: {
          provider: gatewayResult.provider,
          model: gatewayResult.model,
          usage: completion.usage,
          finishReason: completion.finishReason,
        },
      },
    };
  }
}

export const patientSupportWorkflow = new PatientWorkflow();
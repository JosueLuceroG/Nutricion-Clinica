import { z } from 'zod';
import { isClinicalCriticalActionId } from '../actions/actionRegistry.js';
import type { AIToolRegistry } from '../tools/toolRegistry.js';
import { aiToolRegistry } from '../tools/toolRegistry.js';
import type { AIModelCapability } from '../evaluation/capabilities.js';
import type { AgentRiskLevel, BoundedAgentDefinition } from './agentTypes.js';

const SUPPORTED_RISK_LEVELS: readonly AgentRiskLevel[] = ['low', 'medium'];

export class AgentRegistry {
  private readonly agents = new Map<string, BoundedAgentDefinition>();

  constructor(private readonly toolRegistry: AIToolRegistry = aiToolRegistry) {}

  register(definition: BoundedAgentDefinition): void {
    if (!SUPPORTED_RISK_LEVELS.includes(definition.riskLevel)) {
      throw new Error(`Agente '${definition.id}' rechazado: riesgo alto no es bounded`);
    }
    if (isClinicalCriticalActionId(definition.id)) {
      throw new Error(`Agente '${definition.id}' rechazado: agentes clinicos criticos no se automatizan`);
    }
    if (this.agents.has(definition.id)) {
      throw new Error(`Agente '${definition.id}' ya registrado`);
    }
    for (const toolId of definition.allowedToolIds) {
      if (!this.toolRegistry.get(toolId)) {
        throw new Error(`Agente '${definition.id}' rechazado: herramienta '${toolId}' desconocida`);
      }
    }
    this.agents.set(definition.id, definition);
  }

  get(agentId: string): BoundedAgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  list(): BoundedAgentDefinition[] {
    return Array.from(this.agents.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
}

const AgentTaskSchema = z.object({
  task: z.string().min(1).max(500),
});

const NUTRITION_SYSTEM_PROMPT = [
  'Eres un agente de soporte nutricional con alcance limitado.',
  'Puedes consultar SOLO las herramientas autorizadas para leer datos del paciente (nunca los modificas).',
  'Usa UNA herramienta por paso y espera su resultado antes de continuar.',
  'Nunca inventes datos: si una herramienta no devuelve informacion, dilo.',
  'Responde en espanol. Cuando tengas la respuesta final, devuelve JSON con la clave "answer".',
].join('\n');

const OVERVIEW_SYSTEM_PROMPT = [
  'Eres un agente de resumen del paciente con alcance limitado.',
  'Cada uso de herramienta requiere confirmacion del profesional antes de ejecutarse.',
  'Propone UNA herramienta por paso y espera la confirmacion.',
  'Responde en espanol. Cuando tengas la respuesta final, devuelve JSON con la clave "answer".',
].join('\n');

export function createDefaultAgentRegistry(deps: { toolRegistry?: AIToolRegistry } = {}): AgentRegistry {
  const registry = new AgentRegistry(deps.toolRegistry);
  registry.register({
    id: 'nutrition_support_agent',
    name: 'Agente de soporte nutricional',
    description: 'Lee datos del paciente (perfil, plan, adherencia, antropometria) para responder tareas de soporte.',
    riskLevel: 'medium',
    requiredRole: 'nutriologa',
    requiredConsents: ['ai_opt_in'],
    requiresPaciente: true,
    allowedToolIds: ['patient_profile', 'meal_plan', 'adherence_summary', 'anthropometry_tool'],
    capability: 'nutrition_reasoning',
    systemPrompt: NUTRITION_SYSTEM_PROMPT,
    budget: { maxSteps: 4, maxToolCalls: 3, maxTokens: 2048, maxCost: 0.5, timeoutMs: 45000 },
    confirmationPolicy: 'none',
    inputSchema: AgentTaskSchema,
  });
  registry.register({
    id: 'patient_overview_agent',
    name: 'Agente de resumen del paciente',
    description: 'Consulta perfil, consultas y laboratorios del paciente; cada herramienta requiere confirmacion del profesional.',
    riskLevel: 'low',
    requiredRole: 'nutriologa',
    requiredConsents: ['ai_opt_in'],
    requiresPaciente: true,
    allowedToolIds: ['patient_profile', 'recent_consultations', 'lab_results'],
    capability: 'nutrition_reasoning',
    systemPrompt: OVERVIEW_SYSTEM_PROMPT,
    budget: { maxSteps: 3, maxToolCalls: 2, maxTokens: 1536, maxCost: 0.3, timeoutMs: 30000 },
    confirmationPolicy: 'step_confirm',
    inputSchema: AgentTaskSchema,
  });
  return registry;
}

export const defaultAgentRegistry = createDefaultAgentRegistry();

export type { AIModelCapability };
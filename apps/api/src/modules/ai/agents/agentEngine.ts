import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Role } from '@nutriclinica/shared';
import { isConsentAccepted, type ConsentChecker } from '../aiConsent.js';
import { egressCapabilityForAgent, filterToolResultByCapability } from '../egress/capabilityContracts.js';
import { roleSatisfies } from '../tools/toolAuthorization.js';
import type { AIGateway } from '../aiGateway.js';
import { aiGateway } from '../aiGateway.js';
import type { ToolExecutionService } from '../tools/toolExecutionService.js';
import { toolExecutionService, type ToolAuditEvent } from '../tools/toolExecutionService.js';
import type { AIToolRegistry } from '../tools/toolRegistry.js';
import { aiToolRegistry } from '../tools/toolRegistry.js';
import { readAgentsConfig, type AgentsConfig } from './config.js';
import { AgentBudgetTracker, effectiveBudget, estimateCost } from './agentBudget.js';
import { selectAgentLedger } from './agentLedger.js';
import { emptyBudgetUsed, type AgentLedger, type AgentPendingConfirmation, type AgentRun, type BoundedAgentDefinition } from './agentTypes.js';

export type AgentRunResult =
  | { ok: true; value: { run: AgentRun; pending?: AgentPendingConfirmation } }
  | { ok: false; status: number; error: string };

export interface AgentAuditEvent extends ToolAuditEvent {
  agentId: string;
  runId: string;
}

export interface BoundedAgentEngineOptions {
  ledger?: AgentLedger;
  toolService?: ToolExecutionService;
  toolRegistry?: AIToolRegistry;
  gateway?: AIGateway;
  consentChecker?: ConsentChecker;
  config?: (env?: NodeJS.ProcessEnv) => AgentsConfig;
  now?: () => Date;
  audit?: (event: AgentAuditEvent) => void | Promise<void>;
}

export interface AgentRunOptions {
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  pacienteId?: string;
}

interface LoopContext {
  tracker: AgentBudgetTracker;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

type ParsedAgentOutput = { answer: string } | { tool: string; args: Record<string, unknown> };

function parseAgentOutput(content: string): { ok: true; value: ParsedAgentOutput } | { ok: false; error: string } {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: 'El modelo no produjo JSON valido' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'El modelo no produjo JSON valido' };
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.answer === 'string' && obj.answer.trim().length > 0) {
    return { ok: true, value: { answer: obj.answer } };
  }
  if (typeof obj.tool === 'string' && obj.tool.trim().length > 0) {
    const args = obj.args ?? {};
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      return { ok: false, error: 'Argumentos de herramienta invalidos' };
    }
    return { ok: true, value: { tool: obj.tool, args: args as Record<string, unknown> } };
  }
  return { ok: false, error: 'El modelo no produjo una respuesta accionable' };
}

function zodFieldLabel(field: z.ZodTypeAny): string {
  if (field instanceof z.ZodString) return 'string';
  if (field instanceof z.ZodNumber) return 'number';
  if (field instanceof z.ZodBoolean) return 'boolean';
  if (field instanceof z.ZodOptional) return `${zodFieldLabel(field._def.innerType)} (opcional)`;
  if (field instanceof z.ZodArray) return `${zodFieldLabel(field._def.type)}[]`;
  if (field instanceof z.ZodEnum) return field._def.values.join(' | ');
  return 'any';
}

export class BoundedAgentEngine {
  private readonly ledger: AgentLedger;
  private readonly toolService: ToolExecutionService;
  private readonly toolRegistry: AIToolRegistry;
  private readonly gateway: AIGateway;
  private readonly consentChecker: ConsentChecker;
  private readonly config: (env?: NodeJS.ProcessEnv) => AgentsConfig;
  private readonly now: () => Date;
  private readonly audit?: (event: AgentAuditEvent) => void | Promise<void>;

  constructor(options: BoundedAgentEngineOptions = {}) {
    this.ledger = options.ledger ?? selectAgentLedger();
    this.toolService = options.toolService ?? toolExecutionService;
    this.toolRegistry = options.toolRegistry ?? aiToolRegistry;
    this.gateway = options.gateway ?? aiGateway;
    this.consentChecker = options.consentChecker ?? isConsentAccepted;
    this.config = options.config ?? readAgentsConfig;
    this.now = options.now ?? (() => new Date());
    this.audit = options.audit;
  }

  async run(
    definition: BoundedAgentDefinition,
    input: Record<string, unknown>,
    actor: { profesionalId: string; role: Role },
    sucursalId: string,
    opts: AgentRunOptions = {},
  ): Promise<AgentRunResult> {
    const env = opts.env ?? process.env;
    const config = this.config(env);
    if (!config.enabled) return this.fail(503, 'Agentes deshabilitados');
    if (!roleSatisfies(actor.role, definition.requiredRole)) return this.fail(403, 'Rol insuficiente');
    const precheck = await this.precheck(definition, opts, sucursalId);
    if (!precheck.ok) return precheck.result;
    const parsed = definition.inputSchema.safeParse(input);
    if (!parsed.success) return this.fail(400, 'Input del agente invalido');
    let activeRuns: number;
    try {
      activeRuns = await this.ledger.countActiveRuns(actor.profesionalId, sucursalId);
    } catch {
      return this.fail(503, 'Almacen de agentes no disponible');
    }
    if (activeRuns >= config.maxActiveRunsPerActor) return this.fail(429, 'Limite de ejecuciones activas alcanzado');
    const budget = effectiveBudget(definition.budget, config.defaultBudget);
    const startedAt = this.now();
    const run: AgentRun = {
      id: randomUUID(),
      agentId: definition.id,
      actor,
      sucursalId,
      pacienteId: opts.pacienteId,
      status: 'running',
      steps: [],
      budgetUsed: emptyBudgetUsed(),
      input: parsed.data,
      startedAt: startedAt.toISOString(),
      expiresAt: new Date(startedAt.getTime() + budget.timeoutMs).toISOString(),
    };
    try {
      await this.ledger.createRun(run);
    } catch {
      return this.fail(503, 'Almacen de agentes no disponible');
    }
    const tracker = new AgentBudgetTracker(budget, this.now, startedAt);
    return this.continueLoop(run, definition, { tracker, env, signal: opts.signal });
  }

  async confirmStep(
    definition: BoundedAgentDefinition,
    runId: string,
    stepIndex: number,
    actor: { profesionalId: string; role: Role },
    sucursalId: string,
    opts: AgentRunOptions = {},
  ): Promise<AgentRunResult> {
    const env = opts.env ?? process.env;
    const config = this.config(env);
    if (!config.enabled) return this.fail(503, 'Agentes deshabilitados');
    let run: AgentRun | null;
    try {
      run = await this.ledger.getRun(runId);
    } catch {
      return this.fail(503, 'Almacen de agentes no disponible');
    }
    if (!run || run.agentId !== definition.id) return this.fail(404, 'Ejecucion no encontrada');
    if (run.actor.profesionalId !== actor.profesionalId || run.sucursalId !== sucursalId) {
      return this.fail(403, 'No autorizado para esta ejecucion');
    }
    if (run.status === 'expired') return this.fail(410, 'La ejecucion expiro');
    if (run.status !== 'awaiting_confirmation') return this.fail(409, 'La ejecucion no espera confirmacion');
    if (run.pendingStepIndex !== stepIndex) return this.fail(409, 'El paso pendiente no coincide');
    if (this.now().getTime() > new Date(run.expiresAt).getTime()) {
      run.status = 'expired';
      run.stopReason = 'budget';
      const saved = await this.persist(run);
      if (!saved.ok) return saved.result;
      return this.fail(410, 'La ejecucion expiro');
    }
    if (!roleSatisfies(actor.role, definition.requiredRole)) return this.fail(403, 'Rol insuficiente');
    const precheck = await this.precheck(definition, { pacienteId: run.pacienteId }, sucursalId);
    if (!precheck.ok) return precheck.result;
    const pendingTool = run.pendingTool;
    if (!pendingTool) {
      run.status = 'failed';
      run.stopReason = 'error';
      run.error = 'La ejecucion no tiene herramienta pendiente';
      const saved = await this.persist(run);
      if (!saved.ok) return saved.result;
      return this.fail(502, run.error);
    }
    const budget = effectiveBudget(definition.budget, config.defaultBudget);
    const tracker = new AgentBudgetTracker(budget, this.now, new Date(run.startedAt));
    const check = tracker.check(run.budgetUsed);
    if (!check.ok) {
      run.status = 'completed';
      run.stopReason = 'budget';
      run.completedAt = this.now().toISOString();
      const saved = await this.persist(run);
      if (!saved.ok) return saved.result;
      return { ok: true, value: { run } };
    }
    run.status = 'running';
    run.pendingStepIndex = undefined;
    run.pendingTool = undefined;
    const saved = await this.persist(run);
    if (!saved.ok) return saved.result;
    const executed = await this.executeTool(run, pendingTool.toolId, pendingTool.args, { tracker, env, signal: opts.signal });
    if (executed.abort) return executed.result;
    return this.continueLoop(run, definition, { tracker, env, signal: opts.signal });
  }

  async fetchRun(
    definition: BoundedAgentDefinition,
    runId: string,
    actor: { profesionalId: string; role: Role },
    sucursalId: string,
  ): Promise<AgentRunResult> {
    let run: AgentRun | null;
    try {
      run = await this.ledger.getRun(runId);
    } catch {
      return this.fail(503, 'Almacen de agentes no disponible');
    }
    if (!run || run.agentId !== definition.id) return this.fail(404, 'Ejecucion no encontrada');
    if (run.actor.profesionalId !== actor.profesionalId || run.sucursalId !== sucursalId) {
      return this.fail(403, 'No autorizado para esta ejecucion');
    }
    return { ok: true, value: { run } };
  }

  private async continueLoop(
    run: AgentRun,
    definition: BoundedAgentDefinition,
    ctx: LoopContext,
  ): Promise<AgentRunResult> {
    for (;;) {
      const check = ctx.tracker.check(run.budgetUsed);
      if (!check.ok) {
        run.status = 'completed';
        run.stopReason = 'budget';
        run.completedAt = this.now().toISOString();
        const saved = await this.persist(run);
        if (!saved.ok) return saved.result;
        return { ok: true, value: { run } };
      }

      const remainingTokens = Math.max(128, ctx.tracker.remainingTokens(run.budgetUsed));
      const egressCapability = egressCapabilityForAgent(definition.id);
      const gatewayResult = await this.gateway.complete(
        {
          model: '',
          systemPrompt: this.buildSystemPrompt(definition),
          userPrompt: this.buildUserPrompt(run, egressCapability),
          temperature: 0.2,
          maxTokens: remainingTokens,
          responseFormat: 'json',
        },
        {
          requiredCapability: definition.capability,
          signal: ctx.signal,
          egress: {
            capability: egressCapability,
            patientId: run.pacienteId,
            sucursalId: run.sucursalId,
            actor: run.actor,
          },
          correlationId: run.id,
        },
      );
      if (!gatewayResult.ok) {
        run.status = 'failed';
        run.stopReason = 'error';
        run.error = gatewayResult.message;
        run.steps.push({ index: run.steps.length, kind: 'llm', summary: `Error de modelo: ${gatewayResult.message}`, error: gatewayResult.message });
        const saved = await this.persist(run);
        if (!saved.ok) return saved.result;
        return this.fail(502, 'El modelo no esta disponible');
      }

      const usage = gatewayResult.result.usage;
      run.budgetUsed.tokens += usage.totalTokens;
      run.budgetUsed.cost += estimateCost(gatewayResult.model, usage);
      run.budgetUsed.steps += 1;
      const llmStepIndex = run.steps.length;
      run.steps.push({ index: llmStepIndex, kind: 'llm', summary: gatewayResult.result.content.slice(0, 200), tokens: usage.totalTokens });
      const saved = await this.persist(run);
      if (!saved.ok) return saved.result;

      const parsed = parseAgentOutput(gatewayResult.result.content);
      if (!parsed.ok) {
        run.status = 'failed';
        run.stopReason = 'error';
        run.error = parsed.error;
        run.steps[llmStepIndex].error = parsed.error;
        const failed = await this.persist(run);
        if (!failed.ok) return failed.result;
        return this.fail(502, parsed.error);
      }

      const output = parsed.value;
      if ('answer' in output) {
        run.status = 'completed';
        run.stopReason = 'answer';
        run.answer = output.answer;
        run.completedAt = this.now().toISOString();
        const finished = await this.persist(run);
        if (!finished.ok) return finished.result;
        return { ok: true, value: { run } };
      }

      if (!definition.allowedToolIds.includes(output.tool)) {
        run.status = 'failed';
        run.stopReason = 'error';
        run.error = `Herramienta '${output.tool}' no permitida para este agente`;
        run.steps[llmStepIndex].error = run.error;
        const denied = await this.persist(run);
        if (!denied.ok) return denied.result;
        return this.fail(502, run.error);
      }

      if (definition.confirmationPolicy === 'step_confirm') {
        run.status = 'awaiting_confirmation';
        run.pendingStepIndex = run.steps.length;
        run.pendingTool = { toolId: output.tool, args: output.args, summary: `Usar herramienta ${output.tool}` };
        const awaiting = await this.persist(run);
        if (!awaiting.ok) return awaiting.result;
        return {
          ok: true,
          value: {
            run,
            pending: { runId: run.id, stepIndex: run.pendingStepIndex, toolId: output.tool, args: output.args, summary: run.pendingTool.summary },
          },
        };
      }

      const executed = await this.executeTool(run, output.tool, output.args, ctx);
      if (executed.abort) return executed.result;
    }
  }

  private async executeTool(
    run: AgentRun,
    toolId: string,
    args: Record<string, unknown>,
    ctx: LoopContext,
  ): Promise<{ abort: true; result: AgentRunResult } | { abort: false }> {
    const invoke = await this.toolService.invoke(
      { toolId, args, actor: run.actor, sucursalId: run.sucursalId, pacienteId: run.pacienteId },
      {
        env: ctx.env,
        consent: run.pacienteId ? { pacienteId: run.pacienteId, checker: this.consentChecker } : undefined,
        audit: (event: ToolAuditEvent) => this.audit?.({ ...event, agentId: run.agentId, runId: run.id }),
      },
    );
    const stepIndex = run.steps.length;
    if (!invoke.ok) {
      run.status = 'failed';
      run.stopReason = 'error';
      run.error = invoke.error;
      run.steps.push({ index: stepIndex, kind: 'tool', summary: `Fallo de herramienta ${toolId}`, toolId, toolArgs: args, error: invoke.error });
      const saved = await this.persist(run);
      if (!saved.ok) return { abort: true, result: saved.result };
      return { abort: true, result: this.fail(invoke.status, invoke.error) };
    }
    run.budgetUsed.toolCalls += 1;
    run.steps.push({ index: stepIndex, kind: 'tool', summary: `Resultado de ${toolId}`, toolId, toolArgs: args, toolResult: invoke.data });
    const saved = await this.persist(run);
    if (!saved.ok) return { abort: true, result: saved.result };
    return { abort: false };
  }

  private async precheck(
    definition: BoundedAgentDefinition,
    opts: AgentRunOptions,
    sucursalId: string,
  ): Promise<{ ok: true } | { ok: false; result: AgentRunResult }> {
    if (definition.requiresPaciente && !opts.pacienteId) {
      return { ok: false, result: this.fail(400, 'Se requiere paciente') };
    }
    if (definition.requiredConsents.length === 0) return { ok: true };
    if (!opts.pacienteId) return { ok: false, result: this.fail(400, 'Se requiere paciente') };
    for (const tipo of definition.requiredConsents) {
      let accepted: boolean;
      try {
        accepted = await this.consentChecker(opts.pacienteId, sucursalId, tipo);
      } catch {
        return { ok: false, result: this.fail(503, 'Verificacion de consentimiento no disponible') };
      }
      if (!accepted) return { ok: false, result: this.fail(403, `Consentimiento '${tipo}' no aceptado`) };
    }
    return { ok: true };
  }

  private buildSystemPrompt(definition: BoundedAgentDefinition): string {
    const catalog = definition.allowedToolIds.map((toolId) => {
      const tool = this.toolRegistry.get(toolId);
      if (!tool) return `- ${toolId}: (desconocida)`;
      return `- ${tool.id}: ${tool.description} | args: ${JSON.stringify(this.zodShapeSummary(tool.schema))}`;
    });
    return `${definition.systemPrompt}\n\nHerramientas autorizadas:\n${catalog.join('\n')}\n\nSiempre responde con JSON valido.`;
  }

  private buildUserPrompt(run: AgentRun, egressCapability: string): string {
    const steps = run.steps
      .map((step) => {
        if (step.kind === 'tool') {
          const toolId = step.toolId ?? 'desconocida';
          const filtered = filterToolResultByCapability(toolId, step.toolResult, egressCapability);
          const result = typeof filtered.filtered === 'string' ? filtered.filtered : JSON.stringify(filtered.filtered ?? null);
          return `- paso ${step.index} (herramienta ${toolId}): ${String(result).slice(0, 800)}`;
        }
        return `- paso ${step.index} (modelo): ${step.summary}`;
      })
      .join('\n');
    return `Tarea: ${JSON.stringify(run.input)}\n\nPasos previos:\n${steps || '(ninguno)'}`;
  }

  private zodShapeSummary(schema: z.ZodType): Record<string, unknown> {
    if (schema instanceof z.ZodObject) {
      const summary: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(schema.shape)) {
        summary[key] = zodFieldLabel(field as z.ZodTypeAny);
      }
      return summary;
    }
    return {};
  }

  private async persist(run: AgentRun): Promise<{ ok: true } | { ok: false; result: AgentRunResult }> {
    try {
      await this.ledger.saveRun(run);
      return { ok: true };
    } catch {
      return { ok: false, result: this.fail(503, 'Almacen de agentes no disponible') };
    }
  }

  private fail(status: number, error: string): AgentRunResult {
    return { ok: false, status, error };
  }
}
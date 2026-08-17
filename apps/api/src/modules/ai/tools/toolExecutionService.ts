import type { Role } from '@nutriclinica/shared';
import { authorizeTool, type ToolConsentCheck } from './toolAuthorization.js';
import type { AIToolDefinition } from './toolDefinition.js';
import { aiToolRegistry, type AIToolRegistry } from './toolRegistry.js';

export interface ToolInvokeRequest {
  toolId: string;
  args: Record<string, unknown>;
  actor: { profesionalId: string; role: Role };
  sucursalId: string;
  pacienteId?: string;
}

export interface ToolInvokeOptions {
  env?: NodeJS.ProcessEnv;
  consent?: ToolConsentCheck;
  audit?: (event: ToolAuditEvent) => void | Promise<void>;
  now?: Date;
}

export interface ToolAuditEvent {
  toolId: string;
  profesionalId: string;
  role: Role;
  sucursalId: string;
  pacienteId?: string;
  ok: boolean;
  status: number;
  reason?: string;
  riskLevel: AIToolDefinition['riskLevel'];
  dataCategories: AIToolDefinition['dataCategories'];
  retrievedAt: string;
}

export interface ToolResultEnvelope {
  toolId: string;
  ok: true;
  data: unknown;
  riskLevel: AIToolDefinition['riskLevel'];
  dataCategories: AIToolDefinition['dataCategories'];
  provenance: { source: 'erp'; query: string; retrievedAt: string };
  freshness: { maxAgeMs: number; ageMs: number; isFresh: boolean };
  toolVersion: string;
  patientScoped: boolean;
  freshnessStatus: 'CURRENT' | 'SLIGHTLY_STALE' | 'STALE' | 'UNKNOWN';
}

export type ToolInvokeFailure =
  | { ok: false; status: 400 | 403 | 404 | 502 | 503; error: string; details?: unknown }
  | { ok: false; status: 503; error: string };

export class ToolExecutionService {
  constructor(
    private readonly registry: AIToolRegistry = aiToolRegistry,
    private readonly defaultOptions: ToolInvokeOptions = {},
  ) {}

  async invoke(req: ToolInvokeRequest, options: ToolInvokeOptions = {}): Promise<ToolResultEnvelope | ToolInvokeFailure> {
    const env = options.env ?? this.defaultOptions.env ?? process.env;
    const audit = options.audit ?? this.defaultOptions.audit;
    const now = options.now ?? this.defaultOptions.now ?? new Date();
    const consent = options.consent ?? this.defaultOptions.consent;

    if (!this.registry.isToolsEnabled(env)) {
      return { ok: false, status: 503, error: 'Herramientas IA deshabilitadas' };
    }

    const tool = this.registry.get(req.toolId);
    if (!tool) {
      return { ok: false, status: 404, error: 'Herramienta desconocida' };
    }
    if (!this.registry.allowedToolIds(env).has(tool.id)) {
      return { ok: false, status: 403, error: 'Herramienta no permitida' };
    }

    const parsed = tool.schema.safeParse(req.args);
    if (!parsed.success) {
      return { ok: false, status: 400, error: 'Argumentos invalidos', details: parsed.error.flatten() };
    }

    const authorization = await authorizeTool(
      tool,
      { role: req.actor.role, sucursalId: req.sucursalId },
      consent && tool.requiredConsent
        ? { pacienteId: req.pacienteId ?? '', checker: consent.checker }
        : undefined,
    );
    if (!authorization.allowed) {
      await audit?.({
        toolId: tool.id,
        profesionalId: req.actor.profesionalId,
        role: req.actor.role,
        sucursalId: req.sucursalId,
        pacienteId: req.pacienteId,
        ok: false,
        status: authorization.status,
        reason: authorization.reason,
        riskLevel: tool.riskLevel,
        dataCategories: tool.dataCategories,
        retrievedAt: now.toISOString(),
      });
      return { ok: false, status: authorization.status as 400 | 403, error: authorization.reason };
    }

    try {
      const data = await tool.execute({ args: parsed.data, ctx: { sucursalId: req.sucursalId, profesionalId: req.actor.profesionalId, role: req.actor.role } });
      if (tool.outputSchema) {
        const outputCheck = tool.outputSchema.safeParse(data);
        if (!outputCheck.success) {
          await audit?.({
            toolId: tool.id,
            profesionalId: req.actor.profesionalId,
            role: req.actor.role,
            sucursalId: req.sucursalId,
            pacienteId: req.pacienteId,
            ok: false,
            status: 502,
            reason: `Salida de la herramienta no valida: ${outputCheck.error.message}`,
            riskLevel: tool.riskLevel,
            dataCategories: tool.dataCategories,
            retrievedAt: now.toISOString(),
          });
          return { ok: false, status: 502, error: 'La herramienta devolvio una salida no valida' };
        }
      }
      const retrievedAt = now.toISOString();
      await audit?.({
        toolId: tool.id,
        profesionalId: req.actor.profesionalId,
        role: req.actor.role,
        sucursalId: req.sucursalId,
        pacienteId: req.pacienteId,
        ok: true,
        status: 200,
        riskLevel: tool.riskLevel,
        dataCategories: tool.dataCategories,
        retrievedAt,
      });
      return {
        toolId: tool.id,
        ok: true,
        data,
        riskLevel: tool.riskLevel,
        dataCategories: tool.dataCategories,
        provenance: { source: 'erp', query: tool.id, retrievedAt },
        freshness: { maxAgeMs: tool.maxAgeMs, ageMs: 0, isFresh: true },
        toolVersion: tool.toolVersion ?? '1.0.0',
        patientScoped: tool.patientScoped ?? true,
        freshnessStatus: 'CURRENT',
      };
    } catch (err) {
      await audit?.({
        toolId: tool.id,
        profesionalId: req.actor.profesionalId,
        role: req.actor.role,
        sucursalId: req.sucursalId,
        pacienteId: req.pacienteId,
        ok: false,
        status: 502,
        reason: err instanceof Error ? err.message : String(err),
        riskLevel: tool.riskLevel,
        dataCategories: tool.dataCategories,
        retrievedAt: now.toISOString(),
      });
      return { ok: false, status: 502, error: 'Fallo la ejecucion de la herramienta' };
    }
  }
}

export const toolExecutionService = new ToolExecutionService();
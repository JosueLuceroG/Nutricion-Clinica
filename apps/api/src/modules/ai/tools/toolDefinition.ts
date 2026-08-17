import { z } from 'zod';
import type { Role } from '@nutriclinica/shared';

export type ToolRiskLevel = 'low' | 'medium' | 'high';
export type ToolDataCategory = 'pii' | 'clinical' | 'financial' | 'operational';

export interface ToolExecutionContext {
  sucursalId: string;
  profesionalId: string;
  role: Role;
}

export interface AIToolDefinition<S extends z.ZodRawShape = z.ZodRawShape> {
  id: string;
  name: string;
  description: string;
  readOnly: true;
  riskLevel: ToolRiskLevel;
  dataCategories: ToolDataCategory[];
  requiredConsent?: string;
  minRole: Role;
  maxAgeMs: number;
  /** Versión reproducible de la implementación de la herramienta (provenance + toolset fingerprint). */
  toolVersion?: string;
  /** Indica que la herramienta opera sobre un paciente específico (aislamiento por paciente). */
  patientScoped?: boolean;
  /** Schema opcional del resultado: si se define, la salida del ejecutor se valida antes de entregarse. */
  outputSchema?: z.ZodType;
  schema: z.ZodObject<S>;
  execute(input: { args: z.output<z.ZodObject<S>>; ctx: ToolExecutionContext }): Promise<unknown>;
}

export type AIToolShape<S extends z.ZodRawShape = z.ZodRawShape> = Omit<AIToolDefinition<S>, 'schema'> & {
  schema: S;
};

/** Ensures every tool is read-only and enforces a strict (no extra keys) parameter schema. */
export function defineTool<S extends z.ZodRawShape>(def: AIToolShape<S>): AIToolDefinition<S> {
  if (def.readOnly !== true) {
    throw new Error(`Herramienta '${def.id}' no es read-only`);
  }
  return {
    ...def,
    toolVersion: def.toolVersion ?? '1.0.0',
    patientScoped: def.patientScoped ?? true,
    schema: z.object(def.schema).strict(),
  } as AIToolDefinition<S>;
}

export function uuidField(description: string): z.ZodString {
  return z.string().uuid({ message: description });
}

export type FreshnessStatus = 'CURRENT' | 'SLIGHTLY_STALE' | 'STALE' | 'UNKNOWN';

/**
 * Freshness determinista: compara la antigüedad de un dato contra la política
 * de frescura de la herramienta. UNKNOWN nunca se reporta como CURRENT.
 */
export function computeFreshness(input: {
  measuredAt?: string;
  now: Date;
  maxAgeMs: number;
}): { status: FreshnessStatus; ageMs: number | null; isFresh: boolean } {
  const measured = input.measuredAt ? new Date(input.measuredAt).getTime() : null;
  if (measured === null || Number.isNaN(measured)) {
    return { status: 'UNKNOWN', ageMs: null, isFresh: false };
  }
  const ageMs = Math.max(0, input.now.getTime() - measured);
  const half = input.maxAgeMs / 2;
  if (ageMs <= half) return { status: 'CURRENT', ageMs, isFresh: true };
  if (ageMs <= input.maxAgeMs) return { status: 'SLIGHTLY_STALE', ageMs, isFresh: true };
  return { status: 'STALE', ageMs, isFresh: false };
}
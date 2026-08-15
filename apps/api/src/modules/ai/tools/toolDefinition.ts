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
  return { ...def, schema: z.object(def.schema).strict() } as AIToolDefinition<S>;
}

export function uuidField(description: string): z.ZodString {
  return z.string().uuid({ message: description });
}
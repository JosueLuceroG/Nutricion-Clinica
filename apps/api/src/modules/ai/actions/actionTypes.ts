import type { Role } from '@nutriclinica/shared';
import type { z } from 'zod';

export type ActionRiskLevel = 'low' | 'medium';

export type ActionExecutionStatus = 'confirmed' | 'executed' | 'failed' | 'rolled_back' | 'expired';

export interface ActionActor {
  profesionalId: string;
  role: string;
}

export interface ActionContext {
  actor: ActionActor;
  sucursalId: string;
  pacienteId?: string;
  now: Date;
}

export interface ActionPreview {
  summary: string;
  details: Record<string, unknown>;
}

export interface ActionConfirmation {
  id: string;
  actionId: string;
  actor: ActionActor;
  sucursalId: string;
  pacienteId?: string;
  input: Record<string, unknown>;
  idempotencyKey: string | null;
  previewSummary: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface ActionExecution {
  id: string;
  actionId: string;
  confirmationId: string;
  idempotencyKey: string | null;
  actor: ActionActor;
  sucursalId: string;
  pacienteId?: string;
  input: Record<string, unknown>;
  status: ActionExecutionStatus;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  confirmedAt: string;
  executedAt?: string;
  rolledBackAt?: string;
  rollbackReason?: string;
}

export interface ConfirmableActionDefinition {
  id: string;
  name: string;
  description: string;
  riskLevel: ActionRiskLevel;
  requiredRole: Role;
  requiredConsents: string[];
  inputSchema: z.ZodType<Record<string, unknown>>;
  preview(input: Record<string, unknown>, ctx: ActionContext): Promise<ActionPreview>;
  execute(input: Record<string, unknown>, ctx: ActionContext): Promise<Record<string, unknown>>;
  compensate?(execution: ActionExecution, ctx: ActionContext): Promise<Record<string, unknown>>;
}

export interface ActionLedger {
  createConfirmation(confirmation: ActionConfirmation): Promise<void>;
  getConfirmation(id: string): Promise<ActionConfirmation | undefined>;
  markUsed(id: string): Promise<boolean>;
  countPendingConfirmations(actorProfesionalId: string): Promise<number>;
  findExecutionByIdempotencyKey(key: string, actionId: string, sucursalId: string): Promise<ActionExecution | undefined>;
  recordExecution(execution: ActionExecution): Promise<void>;
  getExecution(id: string): Promise<ActionExecution | undefined>;
  markRolledBack(id: string, reason: string, rolledBackAt: string): Promise<boolean>;
}
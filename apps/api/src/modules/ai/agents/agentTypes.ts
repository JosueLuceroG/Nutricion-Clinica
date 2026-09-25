import type { Role } from '@nutriclinica/shared';
import type { z } from 'zod';
import type { AIModelCapability } from '../evaluation/capabilities.js';

export type AgentRiskLevel = 'low' | 'medium';
export type AgentConfirmationPolicy = 'none' | 'step_confirm';
export type AgentRunStatus = 'running' | 'awaiting_confirmation' | 'completed' | 'failed' | 'expired';
export type AgentStopReason = 'answer' | 'budget' | 'error';

export interface AgentBudget {
  maxSteps: number;
  maxToolCalls: number;
  maxTokens: number;
  maxCost: number;
  timeoutMs: number;
}

export interface AgentBudgetUsed {
  steps: number;
  toolCalls: number;
  tokens: number;
  cost: number;
}

export interface AgentActor {
  profesionalId: string;
  role: Role;
}

export interface AgentStep {
  index: number;
  kind: 'llm' | 'tool';
  summary: string;
  toolId?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  tokens?: number;
  error?: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  actor: AgentActor;
  sucursalId: string;
  pacienteId?: string;
  status: AgentRunStatus;
  stopReason?: AgentStopReason;
  steps: AgentStep[];
  budgetUsed: AgentBudgetUsed;
  input: Record<string, unknown>;
  pendingStepIndex?: number;
  pendingTool?: { toolId: string; args: Record<string, unknown>; summary: string };
  answer?: string;
  error?: string;
  startedAt: string;
  expiresAt: string;
  completedAt?: string;
}

export interface AgentPendingConfirmation {
  runId: string;
  stepIndex: number;
  toolId: string;
  args: Record<string, unknown>;
  summary: string;
}

export interface BoundedAgentDefinition {
  id: string;
  name: string;
  description: string;
  riskLevel: AgentRiskLevel;
  requiredRole: Role;
  requiredConsents: string[];
  requiresPaciente: boolean;
  allowedToolIds: string[];
  capability: AIModelCapability;
  systemPrompt: string;
  budget: AgentBudget;
  confirmationPolicy: AgentConfirmationPolicy;
  inputSchema: z.ZodType<Record<string, unknown>>;
}

export interface AgentLedger {
  createRun(run: AgentRun): Promise<void>;
  getRun(runId: string): Promise<AgentRun | null>;
  saveRun(run: AgentRun): Promise<void>;
  countActiveRuns(actorProfesionalId: string, sucursalId: string): Promise<number>;
}

export function emptyBudgetUsed(): AgentBudgetUsed {
  return { steps: 0, toolCalls: 0, tokens: 0, cost: 0 };
}
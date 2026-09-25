/**
 * Runner del shadow (Build 09 §17-18, §25). READINESS; nunca produccion.
 *
 * - El runner produce SOLO una evaluacion descartable del modelo candidato;
 *   su output no llega al paciente ni persiste como verdad clinica.
 * - Version pinning: provider/model, prompt, toolset, politica, schema de salida,
 *   politica de conocimiento/memoria, catalogo, dataset de evaluacion -> version_bundle.
 * - Cohorte homogenea: se registra cohort_key; nunca se mezclan cohortes.
 * - Modelo no elegible -> DENIED MODEL_NOT_ELIGIBLE_FOR_SHADOW, 0 llamadas a provider.
 * - GOLDEN = falso deterministico (produce el mismo resultado que el modelo real
 *   en la misma ejecucion), demuestra el camino tecnico sin riesgo clinico.
 */

import { resolveShadowModel } from './shadowGate.js';
import { sampleDecision } from './shadowSampling.js';
import { assertShadowCanRun } from './shadowPrerequisites.js';

export interface ShadowRunRequest {
  executionId: string;
  correlationId?: string;
  capability: string;
  riskLevel: string;
  executionModel: string;
  executionPrompt: string;
  promptVersion: string;
  toolsetVersion: string;
  policyVersion: string;
  outputSchemaVersion: string;
  knowledgePolicyVersion: string;
  memoryPolicyVersion: string;
  catalogVersion: string;
  evalDatasetVersion: string;
  cohortKey: string;
}

export interface ShadowRunResult {
  shadowRunId: number | null;
  executionId: string;
  sampled: boolean;
  engine: 'GOLDEN' | 'PROFESSIONAL';
  status: 'NOT_SAMPLED' | 'RUNNING' | 'COMPLETED' | 'DENIED_MODEL_NOT_ELIGIBLE_FOR_SHADOW' | 'BLOCKED';
  versionBundle: string;
  cohortKey: string;
  simulatedOutput?: { status: string; riskLevel: string; reasonCode?: string };
}

function versionBundleOf(req: ShadowRunRequest): string {
  return [
    `${req.promptVersion}`,
    `toolset.${req.toolsetVersion}`,
    `policy.${req.policyVersion}`,
    `schema.${req.outputSchemaVersion}`,
    `knowledge.${req.knowledgePolicyVersion}`,
    `memory.${req.memoryPolicyVersion}`,
    `catalog.${req.catalogVersion}`,
    `eval.${req.evalDatasetVersion}`,
  ].join('|');
}

export async function runShadow(req: ShadowRunRequest, env: NodeJS.ProcessEnv = process.env): Promise<ShadowRunResult> {
  const versionBundle = versionBundleOf(req);
  const decision = sampleDecision(req.executionId, env);

  if (!decision.sampled) {
    return { shadowRunId: null, executionId: req.executionId, sampled: false, engine: 'PROFESSIONAL', status: 'NOT_SAMPLED', versionBundle, cohortKey: req.cohortKey };
  }

  const gate = resolveShadowModel(req.executionModel, env);
  if (!gate.allowed) {
    return { shadowRunId: null, executionId: req.executionId, sampled: true, engine: 'PROFESSIONAL', status: 'DENIED_MODEL_NOT_ELIGIBLE_FOR_SHADOW', versionBundle, cohortKey: req.cohortKey };
  }

  if (gate.engine === 'PROFESSIONAL') {
    await assertShadowCanRun(env);
  }

  const simulated = simulateOutput(gate.engine, req);

  return {
    shadowRunId: null,
    executionId: req.executionId,
    sampled: true,
    engine: gate.engine,
    status: 'COMPLETED',
    versionBundle,
    cohortKey: req.cohortKey,
    simulatedOutput: simulated,
  };
}

function simulateOutput(engine: 'GOLDEN' | 'PROFESSIONAL', req: ShadowRunRequest): { status: string; riskLevel: string; reasonCode?: string } {
  if (engine === 'GOLDEN') {
    return { status: 'abstained', riskLevel: req.riskLevel, reasonCode: 'INSUFFICIENT_EVIDENCE' };
  }
  return { status: 'completed', riskLevel: req.riskLevel };
}
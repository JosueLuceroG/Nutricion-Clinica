import { randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { getPool } from '../../db/connection.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { aiGateway, type GatewayResult } from './aiGateway.js';
import { DEFAULT_EGRESS_CAPABILITY } from './egress/capabilityContracts.js';
import { modelQualificationRegistry } from './evaluation/certification.js';
import { modelRegistry } from './models/modelRegistry.js';
import { createOllamaAdapter, createOpenAiAdapter } from './providers/openAiCompatibleAdapter.js';
import { providerRegistry } from './providers/providerRegistry.js';
import { assertAiConfigValid } from './runtime/aiConfigValidation.js';

modelRegistry.syncFromEnv(process.env);
providerRegistry.register(createOpenAiAdapter(), { capabilities: ['chat_general', 'structured_json', 'nutrition_reasoning'] });
providerRegistry.register(createOllamaAdapter(), { capabilities: ['chat_general', 'nutrition_reasoning'] });
assertAiConfigValid(process.env, modelRegistry, providerRegistry, modelQualificationRegistry);

export { resolveOpenAiApiKey } from './credentialProvider.js';
export { mapOpenAiResponse } from './providers/openAiCompatibleAdapter.js';

type FinishReason = 'stop' | 'length' | 'error';

export interface AICompleteResponse {
  content: string;
  model: string;
  provider: string;
  finishReason: FinishReason;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

const CompleteSchema = z
  .object({
    model: z.string().trim().min(1).max(100).optional(),
    systemPrompt: z.string().min(1).max(12_000),
    userPrompt: z.string().min(1).max(20_000),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(4_000).optional(),
    provider: z.enum(['ollama', 'openai']).optional(),
    responseFormat: z.literal('json').optional(),
    capability: z.string().trim().min(1).max(100).optional(),
    patientId: z.string().uuid().optional(),
  })
  .strict();

export type AICompleteRequest = z.infer<typeof CompleteSchema>;

interface AuditResult {
  status: 'success' | 'error' | 'denied';
  provider?: string;
  model?: string;
  reason?: string;
  usage?: AICompleteResponse['usage'];
  attempts?: unknown;
  executionId?: string;
  correlationId?: string;
  code?: string;
  capability?: string;
  baseRisk?: string;
  effectiveRisk?: string;
  modelVersion?: string;
  certificationState?: string;
  certificationId?: string;
  promptVersion?: string;
  toolsetVersion?: string;
  policyVersion?: string;
  outputSchemaVersion?: string;
  evidenceConfidence?: string;
  abstained?: boolean;
  requiresProfessionalReview?: boolean;
}

function auditClinical(result: AuditResult, clinical: GatewayResult['clinical']): AuditResult {
  if (!clinical) return result;
  return {
    ...result,
    capability: clinical.capability,
    baseRisk: clinical.baseRisk,
    effectiveRisk: clinical.effectiveRisk,
    modelVersion: clinical.modelVersion,
    certificationState: clinical.certificationState,
    certificationId: clinical.certificationId,
    promptVersion: clinical.promptVersion,
    toolsetVersion: clinical.toolsetVersion,
    policyVersion: clinical.policyVersion,
    outputSchemaVersion: clinical.outputSchemaVersion,
    evidenceConfidence: clinical.confidence,
    abstained: clinical.abstained,
    requiresProfessionalReview: clinical.requiresProfessionalReview,
  };
}

async function auditAiRequest(req: Request, result: AuditResult): Promise<void> {
  if (!req.user) return;
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), randomUUID())
      .input('sucursal_id', sql.UniqueIdentifier(), req.sucursalId ?? null)
      .input('profesional_id', sql.UniqueIdentifier(), req.user.sub)
      .input('entity_type', sql.NVarChar(60), 'ai')
      .input('operacion', sql.NVarChar(20), 'read')
      .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify(result))
      .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
      .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
      .query(
        `INSERT INTO audit_log (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
         VALUES (@id, @sucursal_id, @profesional_id, @entity_type, NULL, @operacion, @detalles, @ip_address, @user_agent)`,
      );
  } catch (err) {
    console.warn('[audit] ai audit failed:', err instanceof Error ? err.message : err);
  }
}

const router: Router = ExpressRouter();
const aiRateLimit = rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'ai' });

router.use(requireAuth, requireSucursalAccess, aiRateLimit);

router.post('/complete', async (req: Request, res: Response) => {
  const parsed = CompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Solicitud IA invalida', details: parsed.error.flatten() });
    return;
  }

  const correlationId = (req.header?.('x-request-id') as string | undefined) ?? randomUUID();

  const gatewayResult = await aiGateway.complete(
    {
      model: parsed.data.model ?? '',
      systemPrompt: parsed.data.systemPrompt,
      userPrompt: parsed.data.userPrompt,
      temperature: parsed.data.temperature,
      maxTokens: parsed.data.maxTokens,
      responseFormat: parsed.data.responseFormat,
    },
    {
      preferredProvider: parsed.data.provider,
      requiredCapability: parsed.data.responseFormat === 'json' ? 'structured_json' : 'chat_general',
      egress: {
        capability: parsed.data.capability ?? DEFAULT_EGRESS_CAPABILITY,
        patientId: parsed.data.patientId,
        sucursalId: req.sucursalId ?? undefined,
        actor: { profesionalId: req.user?.sub },
      },
      correlationId,
    },
  );

  if (!gatewayResult.ok) {
    await auditAiRequest(req, auditClinical({
      status: 'denied',
      provider: gatewayResult.attempts[0]?.provider,
      model: gatewayResult.attempts[0]?.model,
      reason: gatewayResult.message,
      attempts: gatewayResult.attempts,
      executionId: gatewayResult.executionId,
      correlationId: gatewayResult.correlationId,
      code: gatewayResult.code,
    }, gatewayResult.clinical));
    res.status(gatewayResult.status).json({ error: gatewayResult.message });
    return;
  }

  await auditAiRequest(req, auditClinical({
    status: 'success',
    provider: gatewayResult.provider,
    model: gatewayResult.model,
    usage: gatewayResult.result.usage,
    attempts: gatewayResult.attempts,
    executionId: gatewayResult.executionId,
    correlationId: gatewayResult.correlationId,
  }, gatewayResult.clinical));
  res.json({
    content: gatewayResult.result.content,
    model: gatewayResult.result.model,
    provider: gatewayResult.provider,
    finishReason: gatewayResult.result.finishReason,
    usage: gatewayResult.result.usage,
  } satisfies AICompleteResponse);
});

export default router;
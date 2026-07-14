import { randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type NextFunction, type Request, type Response, type Router } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { getPool } from '../../db/connection.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';

type FinishReason = 'stop' | 'length' | 'error';

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

const CompleteSchema = z.object({
  model: z.string().trim().min(1).max(100).optional(),
  systemPrompt: z.string().min(1).max(12_000),
  userPrompt: z.string().min(1).max(20_000),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(4_000).optional(),
  provider: z.enum(["ollama", "openai"]).optional(),
  apiKey: z.string().max(500).optional(),
  responseFormat: z.literal("json").optional(),
});

export type AICompleteRequest = z.infer<typeof CompleteSchema>;

export interface AICompleteResponse {
  content: string;
  model: string;
  provider: 'openai' | 'ollama';
  finishReason: FinishReason;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export function resolveOpenAiApiKey(env: NodeJS.ProcessEnv = process.env): string {
  return env.OPENAI_API_KEY ?? env.AI_API_KEY ?? '';
}

function getAIProvider(env: NodeJS.ProcessEnv = process.env): 'openai' | 'ollama' {
  return (env.AI_PROVIDER ?? env.VITE_AI_PROVIDER ?? 'openai') as 'openai' | 'ollama';
}

function getModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.AI_MODEL ?? 'llama3.2';
}

export function mapOpenAiResponse(data: OpenAiResponse, fallbackModel: string, provider: 'openai' | 'ollama' = 'openai'): AICompleteResponse {
  const choice = data.choices?.[0];
  const finishReason: FinishReason = choice?.finish_reason === 'stop'
    ? 'stop'
    : choice?.finish_reason === 'length'
      ? 'length'
      : 'error';

  return {
    content: choice?.message?.content ?? '',
    model: data.model ?? fallbackModel,
    provider,
    finishReason,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

async function callAIProvider(req: AICompleteRequest, signal?: AbortSignal): Promise<AICompleteResponse> {
  const provider = req.provider ?? getAIProvider();
  const model = provider === 'ollama' ? getModel() : (req.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini');
  const baseUrl = (process.env.OPENAI_BASE_URL ?? (provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1')).replace(/\/$/, '');
  const apiKey = provider !== 'ollama' ? (req.apiKey || resolveOpenAiApiKey()) : null;

  if (provider !== 'ollama' && !apiKey) {
    throw new HttpError(503, 'IA no configurada en el servidor');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? 0.3,
      max_tokens: req.maxTokens ?? 1024,
      ...(req.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      stream: false,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.warn(`[ai] provider error ${response.status}: ${body.slice(0, 500)}`);
    throw new HttpError(502, 'Proveedor de IA no disponible');
  }

  return mapOpenAiResponse(await response.json() as OpenAiResponse, model, provider);
}

async function auditAiRequest(req: Request, result: { status: 'success' | 'error'; model?: string; usage?: AICompleteResponse['usage'] }): Promise<void> {
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

router.post('/complete', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = CompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Solicitud IA invalida', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await callAIProvider(parsed.data);
    await auditAiRequest(req, { status: 'success', model: result.model, usage: result.usage });
    res.json(result);
  } catch (err) {
    await auditAiRequest(req, { status: 'error' });
    next(err);
  }
});

export default router;

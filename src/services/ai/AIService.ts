import { aiClient } from "./AIClient";
import { buildSystemPrompt, buildUserPrompt, type CapabilityId, type PromptContext } from "./AIPrompts";
import { parseResponse, type ParsedResponse } from "./AIResponseParser";
import { getCapabilityDef } from "./AICapabilities";
import { auditService } from "@services/audit/auditService";
import { useAuthStore } from "@store/authStore";

export interface AIExecuteOptions {
  signal?: AbortSignal;
  skipCache?: boolean;
}

interface CacheEntry {
  data: ParsedResponse;
  expiresAt: number;
}

interface UsageEntry {
  capability: CapabilityId;
  promptTokens: number;
  completionTokens: number;
  model: string;
  timestamp: Date;
}

class AIService {
  private cache = new Map<string, CacheEntry>();
  private usageLog: UsageEntry[] = [];

  isEnabled(): boolean {
    return import.meta.env.VITE_AI_ENABLED === "true";
  }

  getMonthlyUsage(): { capability: CapabilityId; totalCalls: number; totalTokens: number }[] {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEntries = this.usageLog.filter((e) => e.timestamp >= monthStart);

    const stats = new Map<CapabilityId, { totalCalls: number; totalTokens: number }>();
    for (const entry of monthEntries) {
      const existing = stats.get(entry.capability) ?? { totalCalls: 0, totalTokens: 0 };
      existing.totalCalls += 1;
      existing.totalTokens += entry.promptTokens + entry.completionTokens;
      stats.set(entry.capability, existing);
    }

    return Array.from(stats.entries()).map(([capability, data]) => ({
      capability,
      ...data,
    }));
  }

  async execute<T = unknown>(
    capability: CapabilityId,
    context: PromptContext & Record<string, unknown>,
    options?: AIExecuteOptions,
  ): Promise<ParsedResponse<T>> {
    const def = getCapabilityDef(capability);
    if (!def) {
      return { success: false, data: null, raw: "", confidence: 0, error: `Unknown capability: ${capability}` };
    }

    const cacheKey = `${capability}::${JSON.stringify(context)}`;

    if (!options?.skipCache && def.cacheable) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data as ParsedResponse<T>;
      }
    }

    const systemPrompt = buildSystemPrompt(capability, context.language ?? "es-MX");
    const userPrompt = buildUserPrompt(capability, context);

    try {
      const response = await aiClient.complete(
        {
          model: def.model,
          systemPrompt,
          userPrompt,
          temperature: def.temperature,
          maxTokens: def.maxTokens,
        },
        { signal: options?.signal },
      );

      const parsed = parseResponse<T>(capability, response.content);

      if (def.cacheable) {
        this.cache.set(cacheKey, {
          data: parsed,
          expiresAt: Date.now() + def.cacheTtlMinutes * 60 * 1000,
        });
      }

      const promptTokens = response.usage?.promptTokens ?? 0;
      const completionTokens = response.usage?.completionTokens ?? 0;

      this.usageLog.push({
        capability,
        promptTokens,
        completionTokens,
        model: response.model,
        timestamp: new Date(),
      });

      const patientId = (context as Record<string, unknown>).patientId as string | undefined;

      await auditService.record({
        module: "ai",
        action: "read",
        resourceType: "patient",
        resourceId: capability,
        patientId,
        userId: useAuthStore.getState().user?.id ?? "unknown",
        justification: JSON.stringify({ capability, promptTokens, completionTokens, model: response.model }),
      });

      return parsed;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.usageLog.push({
        capability,
        promptTokens: 0,
        completionTokens: 0,
        model: def.model,
        timestamp: new Date(),
      });

      const patientId = (context as Record<string, unknown>).patientId as string | undefined;

      await auditService.record({
        module: "ai",
        action: "read",
        resourceType: "patient",
        resourceId: capability,
        patientId,
        userId: useAuthStore.getState().user?.id ?? "unknown",
        justification: JSON.stringify({ capability, promptTokens: 0, completionTokens: 0, model: def.model }),
      });

      return { success: false, data: null, raw: "", confidence: 0, error: errorMessage };
    }
  }
}

export const aiService = new AIService();
export type AIServiceType = typeof aiService;

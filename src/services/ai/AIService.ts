import { aiClient, isAIEnvironmentEnabled } from "./AIClient";
import { buildSystemPrompt, buildUserPrompt, type CapabilityId, type PromptContext } from "./AIPrompts";
import { parseResponse, type ParsedResponse } from "./AIResponseParser";
import { getCapabilityDef } from "./AICapabilities";
import { auditService } from "@services/audit/auditService";
import { useAuthStore } from "@store/authStore";
import { usePreferencesStore } from "@store/preferencesStore";
import { ConsentService } from "@modules/auth/PatientConsentService";
import { db } from "@services/db/dexieSchema";

function getPatientId(context: Record<string, unknown>): string | undefined {
  return context.patientId as string | undefined;
}

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

  isEnvironmentEnabled(): boolean {
    return isAIEnvironmentEnabled();
  }

  isUserEnabled(): boolean {
    return usePreferencesStore.getState().aiEnabled;
  }

  isEnabled(context?: Record<string, unknown>): boolean {
    if (!this.isEnvironmentEnabled()) return false;
    if (!this.isUserEnabled()) return false;
    if (context) {
      const patientId = getPatientId(context);
      if (patientId) {
        const active = ConsentService.isConsentActive(patientId, "ai_opt_in");
        if (!active) return false;
      }
    }
    return true;
  }

  getDisabledReason(context?: Record<string, unknown>): "environment" | "user" | "consent" | null {
    if (!this.isEnvironmentEnabled()) return "environment";
    if (!this.isUserEnabled()) return "user";
    if (context) {
      const patientId = getPatientId(context);
      if (patientId) {
        const active = ConsentService.isConsentActive(patientId, "ai_opt_in");
        if (!active) return "consent";
      }
    }
    return null;
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

    const disabledReason = this.getDisabledReason(context);
    if (disabledReason) {
      return {
        success: false,
        data: null,
        raw: "",
        confidence: 0,
        error: disabledReason === "environment"
          ? "AI is disabled for this environment. Set VITE_AI_ENABLED=true and configure the AI provider (OpenAI or Ollama)."
          : disabledReason === "user"
            ? "AI is disabled in user settings."
            : "Patient has not granted AI consent.",
      };
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

    const store = usePreferencesStore.getState();
    const provider = store.aiProvider;
    const apiKey = provider === "openai" ? store.openAiApiKey : undefined;

    try {
      const response = await aiClient.complete(
        {
          model: def.model,
          systemPrompt,
          userPrompt,
          temperature: def.temperature,
          maxTokens: def.maxTokens,
          provider,
          apiKey,
          responseFormat: capability === "generateDashboardKpi" ? "json" : undefined,
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

      const patientId = getPatientId(context);

      await db.ai_usage_logs.add({
        id: crypto.randomUUID(),
        capability,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        model: response.model,
        success: true,
        created_at: new Date().toISOString(),
      });

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

      const patientId = getPatientId(context);

      await db.ai_usage_logs.add({
        id: crypto.randomUUID(),
        capability,
        prompt_tokens: 0,
        completion_tokens: 0,
        model: def.model,
        success: false,
        created_at: new Date().toISOString(),
      });

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

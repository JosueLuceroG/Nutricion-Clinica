import * as React from "react";
import { useTranslation } from "react-i18next";
import { aiService } from "./AIService";
import type { CapabilityId } from "./AIPrompts";
import type { AIExecuteOptions } from "./AIService";
import type { ParsedResponse } from "./AIResponseParser";

export function useAI() {
  const { i18n } = useTranslation();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const execute = React.useCallback(
    async <T = unknown>(
      capability: CapabilityId,
      context: Record<string, unknown>,
      options?: AIExecuteOptions,
    ): Promise<ParsedResponse<T> | null> => {
      setBusy(true);
      setError(null);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const ctx = { ...context, language: i18n.language };

      try {
        const result = await aiService.execute<T>(capability, ctx, {
          ...options,
          signal: options?.signal ?? abortRef.current.signal,
        });

        if (!result.success) {
          setError(result.error ?? "Unknown error");
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
  }, []);

  return { execute, busy, error, cancel };
}

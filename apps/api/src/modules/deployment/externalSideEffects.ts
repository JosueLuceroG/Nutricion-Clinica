export const EXTERNAL_SIDE_EFFECT_MODES = [
  "DISABLED",
  "SANDBOX",
  "PRODUCTION",
] as const;

export type ExternalSideEffectMode =
  (typeof EXTERNAL_SIDE_EFFECT_MODES)[number];

export function readExternalSideEffectMode(
  env: NodeJS.ProcessEnv = process.env,
): ExternalSideEffectMode | "UNKNOWN" {
  const raw = (env.EXTERNAL_SIDE_EFFECTS_MODE ?? "DISABLED")
    .trim()
    .toUpperCase();
  return (EXTERNAL_SIDE_EFFECT_MODES as readonly string[]).includes(raw)
    ? (raw as ExternalSideEffectMode)
    : "UNKNOWN";
}

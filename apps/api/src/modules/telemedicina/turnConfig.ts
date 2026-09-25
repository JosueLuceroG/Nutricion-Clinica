import { z } from "zod";
import { createHmac } from "node:crypto";
import { readExternalSideEffectMode } from "../deployment/externalSideEffects.js";
import { readEnvironmentClass } from "../deployment/environmentIdentity.js";
import {
  TURN_CONNECTIVITY_POLICY,
  type TurnConfigDTO,
  type TurnIceServerDTO,
} from "@nutriclinica/shared";

const TurnCredentialsSchema = z.object({
  STUN_URLS: z.string().optional(),
  TURN_URLS: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),
  TURN_SHARED_SECRET: z.string().optional(),
  TURN_CREDENTIAL_TTL_SECONDS: z.string().optional(),
});

function csv(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((v) => v.trim())
      .filter(Boolean) ?? []
  );
}

export function validIceUrls(
  value: string | undefined,
  kind: "stun" | "turn",
): boolean {
  const urls = csv(value);
  const pattern =
    kind === "stun" ? /^stuns?:[^/\s,][^\s,]*$/i : /^turns?:[^/\s,][^\s,]*$/i;
  return urls.length > 0 && urls.every((url) => pattern.test(url));
}

function credentialTtlSeconds(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 3600;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 60 || parsed > 86_400) {
    throw new Error(
      "TURN_CREDENTIAL_TTL_SECONDS debe ser entero entre 60 y 86400",
    );
  }
  return parsed;
}

export function buildTurnConfig(
  env: Record<string, string | undefined>,
  subject = "authenticated-user",
): TurnConfigDTO {
  const mode = readExternalSideEffectMode(env as NodeJS.ProcessEnv);
  const environmentClass = readEnvironmentClass(env as NodeJS.ProcessEnv);
  if (
    mode === "DISABLED" ||
    mode === "UNKNOWN" ||
    (mode === "PRODUCTION" && environmentClass !== "PRODUCTION")
  ) {
    return {
      policy: TURN_CONNECTIVITY_POLICY,
      iceServers: [],
      configured: false,
    };
  }
  const parsed = TurnCredentialsSchema.safeParse(env);
  if (!parsed.success) {
    return {
      policy: TURN_CONNECTIVITY_POLICY,
      iceServers: [],
      configured: false,
    };
  }

  const {
    STUN_URLS,
    TURN_URLS,
    TURN_USERNAME,
    TURN_CREDENTIAL,
    TURN_SHARED_SECRET,
    TURN_CREDENTIAL_TTL_SECONDS,
  } = parsed.data;
  const stunUrls = validIceUrls(STUN_URLS, "stun") ? csv(STUN_URLS) : [];
  const turnUrls = validIceUrls(TURN_URLS, "turn") ? csv(TURN_URLS) : [];
  const iceServers: TurnIceServerDTO[] =
    stunUrls.length > 0 ? [{ urls: stunUrls }] : [];
  const staticConfigured =
    turnUrls.length > 0 &&
    Boolean(TURN_USERNAME?.trim()) &&
    Boolean(TURN_CREDENTIAL?.trim());
  const ephemeralConfigured =
    turnUrls.length > 0 && Boolean(TURN_SHARED_SECRET?.trim());
  const configured =
    ephemeralConfigured || (mode === "SANDBOX" && staticConfigured);

  if (configured) {
    const ttl = credentialTtlSeconds(TURN_CREDENTIAL_TTL_SECONDS);
    const username = ephemeralConfigured
      ? `${Math.floor(Date.now() / 1000) + ttl}:${subject}`
      : TURN_USERNAME!.trim();
    const credential = ephemeralConfigured
      ? createHmac("sha1", TURN_SHARED_SECRET!.trim())
          .update(username)
          .digest("base64")
      : TURN_CREDENTIAL!.trim();
    iceServers.push({
      urls: turnUrls,
      username,
      credential,
    });
  }

  return { policy: TURN_CONNECTIVITY_POLICY, iceServers, configured };
}

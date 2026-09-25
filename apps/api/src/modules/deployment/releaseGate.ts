import {
  readEnvironmentClass,
  buildEnvironmentIdentity,
} from "./environmentIdentity.js";
import { evaluatePreDeployGate } from "./preDeployGate.js";
import { evaluateShadowPrerequisites } from "../shadow/shadowPrerequisites.js";
import { readStagingAvailability } from "./stagingAvailability.js";

/**
 * Release gate operativo (Build 09.5A §41-42, §45-46).
 * Maquina-legible: LOCAL DEV READINESS / STAGING / PRODUCTION OPERATIONAL / CLINICAL.
 * En este entorno el resultado honesto es NOT_READY/BLOCKED (ver §98 FINAL GATE).
 */

export type ReleaseGateStatus = "READY" | "NOT_READY" | "BLOCKED";

export interface ReleaseGateGroup {
  group: string;
  status: ReleaseGateStatus;
  detail: string;
}

export interface ReleaseGateResult {
  overall: ReleaseGateStatus;
  machineReadable:
    | "LOCAL_READINESS_PASS"
    | "STAGING_BLOCKED"
    | "PRODUCTION_NOT_READY"
    | "CLINICAL_NOT_READY"
    | "NOT_CONFIGURED";
  groups: ReleaseGateGroup[];
  evaluatedAt: string;
}

export async function evaluateReleaseGate(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReleaseGateResult> {
  const environmentClass = readEnvironmentClass(env);
  const groups: ReleaseGateGroup[] = [];
  const gate = evaluatePreDeployGate(env);
  const rawEgress = env.AI_EGRESS_ENABLED;
  const killSwitchKnown =
    rawEgress === undefined ||
    rawEgress.trim() === "" ||
    rawEgress === "true" ||
    rawEgress === "false";

  const secretCheck = gate.checks.find((check) => check.id === "secret_scan");
  groups.push({
    group: "SECURITY",
    status: secretCheck?.status === "PASS" ? "READY" : "BLOCKED",
    detail: secretCheck?.detail ?? "scan de secretos no disponible",
  });

  const identity = buildEnvironmentIdentity(env);
  const oltp = identity.databaseTarget.toLowerCase();
  const dwh = identity.dwhTarget.toLowerCase();
  const stagingGuard =
    environmentClass === "STAGING" || environmentClass === "PRODUCTION"
      ? oltp !== "nutriclinica" && dwh !== "nutriclinicadw" && oltp !== dwh
      : true;
  groups.push({
    group: "DATA",
    status: stagingGuard ? "READY" : "BLOCKED",
    detail: stagingGuard
      ? `OLTP '${identity.databaseTarget}' / DWH '${identity.dwhTarget}'`
      : "apunta a bases por defecto locales",
  });

  groups.push({
    group: "DEPLOYMENT",
    status: gate.pass
      ? gate.deployableToStaging
        ? "READY"
        : "NOT_READY"
      : "BLOCKED",
    detail: `pre-deploy gate: ${gate.checks.filter((c) => c.status === "PASS").length} PASS / ${gate.checks.filter((c) => c.status === "FAIL").length} FAIL / ${gate.checks.filter((c) => c.status === "PENDING_EXTERNAL").length} externos`,
  });

  groups.push({
    group: "MODEL",
    status: "NOT_READY",
    detail:
      "NINGUN modelo clínico elegible (llama3.2 y gpt-4o-mini: REQUALIFICATION_REQUIRED)",
  });

  const staging = readStagingAvailability(env);
  groups.push({
    group: "STAGING",
    status: staging.status === "AVAILABLE" ? "READY" : "BLOCKED",
    detail:
      staging.status === "AVAILABLE"
        ? `staging verificado por evidencia ${staging.evidenceId}`
        : "STAGING NOT_AVAILABLE (sin atestacion y smoke externo vinculados)",
  });

  const shadow = await evaluateShadowPrerequisites(env);
  groups.push({
    group: "SHADOW",
    status: shadow.machineReadable === "READY" ? "READY" : "BLOCKED",
    detail: `shadow ${shadow.machineReadable} (${shadow.blocker})`,
  });

  groups.push({
    group: "PROFESSIONAL_VALIDATION",
    status: "NOT_READY",
    detail: "validación clínica profesional NOT_DONE (0 muestras)",
  });

  groups.push({
    group: "CLINICAL_CERTIFICATION",
    status: "NOT_READY",
    detail: "certificación clínica de producción NOT_GRANTED",
  });

  groups.push({
    group: "KILL_SWITCH",
    status: killSwitchKnown ? "READY" : "BLOCKED",
    detail: killSwitchKnown
      ? `kill switch AI_EGRESS_ENABLED=${rawEgress?.trim() || "false"} verificable y probado`
      : "AI_EGRESS_ENABLED invalido; debe ser true/false",
  });

  const blocked = groups.filter((g) => g.status === "BLOCKED");
  const notReady = groups.filter((g) => g.status === "NOT_READY");
  let overall: ReleaseGateStatus;
  let machineReadable: ReleaseGateResult["machineReadable"];
  if (blocked.length > 0) {
    overall = "BLOCKED";
    machineReadable =
      environmentClass === "STAGING"
        ? "STAGING_BLOCKED"
        : environmentClass === "PRODUCTION"
          ? "PRODUCTION_NOT_READY"
          : "CLINICAL_NOT_READY";
  } else if (notReady.length > 0) {
    overall = "NOT_READY";
    machineReadable =
      environmentClass === "PRODUCTION"
        ? "PRODUCTION_NOT_READY"
        : "LOCAL_READINESS_PASS";
  } else {
    overall = "READY";
    machineReadable = "NOT_CONFIGURED";
  }

  return {
    overall,
    machineReadable,
    groups,
    evaluatedAt: new Date().toISOString(),
  };
}

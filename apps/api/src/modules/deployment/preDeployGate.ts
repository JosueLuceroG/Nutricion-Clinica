import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, isAbsolute, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { buildEnvironmentIdentity } from "./environmentIdentity.js";
import { validateStartupConfig } from "./startupValidation.js";
import { effectiveFeatureFlags } from "./featureFlags.js";
import { buildDeploymentManifest } from "./deploymentManifest.js";
import { safeEvidenceReference } from "./deploymentEvidence.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function findRepoRoot(start: string): string | null {
  let current = start;
  const root = parse(start).root;
  while (current !== root) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    current = dirname(current);
  }
  return null;
}

const REPO_ROOT =
  process.env.NUTRICLINICA_REPO_ROOT?.trim() || findRepoRoot(__dirname);

/**
 * Pre-deploy gate (Build 09.5A §23-25, §42).
 * - Tier A (verificable en código): working tree limpio, artefacto trazable,
 *   config válida, flags seguros, scan de secretos, manifiesto completo.
 * - Tier B (infra/externo): migraciones pendientes, backup disponible,
 *   artefacto de rollback, smoke en staging — reportado como PENDING_EXTERNAL
 *   (nunca se finge que se verificó contra un staging real).
 */

export type PreDeployCheckStatus = "PASS" | "FAIL" | "PENDING_EXTERNAL";

export interface PreDeployCheck {
  id: string;
  label: string;
  status: PreDeployCheckStatus;
  detail: string;
}

export interface PreDeployGateResult {
  pass: boolean;
  deployableToStaging: boolean;
  checks: PreDeployCheck[];
  evaluatedAt: string;
}

function isTextFile(file: string): boolean {
  const name = file.toLowerCase();
  return (
    (name.endsWith("dockerfile") ||
      /\.(?:ts|tsx|js|jsx|cjs|mjs|sql|json|md|env|example|ps1|sh|ya?ml|conf|toml|html|css)$/.test(
        name,
      )) &&
    !/\.test\.(?:ts|tsx|js|jsx|cjs|mjs)$/.test(name)
  );
}

const PLACEHOLDER_VALUE =
  /^(change[-_]?me|reemplaza(?:[_ -].*)?|your[-_ ]?|xxx+|example|injected[-_ ].*|<[^>]+>|""|''|)$/i;
const SENSITIVE_KEY =
  /(?:^|_)(?:password|passwd|pwd|secret|token|api_key|apikey|credential|private_key)$/i;
const ENV_LINE = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/;
const PS_ENV_LINE = /^\$env:([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/;
const SK_TOKEN = /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{8,}/;

export function containsSecretTokenPattern(content: string): boolean {
  return SK_TOKEN.test(content);
}

/** Escaneo de secretos en archivos versionados (excluye tests/fixtures). */
export function scanTrackedSecrets(): { found: string[]; scanned: number } {
  const found: string[] = [];
  let scanned = 0;

  if (!REPO_ROOT) return { found, scanned };

  let files: string[] = [];
  try {
    const out = execSync("git ls-files -z", {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    files = out.split("\0").filter(Boolean);
  } catch {
    files = [];
  }
  if (files.length === 0) {
    const visit = (dir: string): void => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (
          entry === "node_modules" ||
          entry === ".git" ||
          entry === "dist" ||
          entry === "scripts-tmp"
        )
          continue;
        const full = join(dir, entry);
        let isDir: boolean;
        try {
          isDir = statSync(full).isDirectory();
        } catch {
          continue;
        }
        if (isDir) {
          visit(full);
        } else if (isTextFile(full)) {
          files.push(full);
        }
      }
    };
    visit(REPO_ROOT);
  }

  for (const file of files) {
    const full = isAbsolute(file) ? file : join(REPO_ROOT, file);
    if (!isTextFile(full)) continue;
    scanned += 1;
    let content: string;
    try {
      content = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    if (containsSecretTokenPattern(content)) {
      found.push(`sk-token pattern en ${file}`);
      continue;
    }
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (
        trimmed === "" ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("--") ||
        trimmed.startsWith(";")
      )
        continue;
      const m = PS_ENV_LINE.exec(trimmed) ?? ENV_LINE.exec(trimmed);
      if (!m || !SENSITIVE_KEY.test(m[1]!)) continue;
      const value = m[2]!.trim();
      if (
        value === "" ||
        PLACEHOLDER_VALUE.test(value) ||
        value.startsWith("$") ||
        value.includes("${")
      )
        continue;
      found.push(`posible secreto '${m[1]}' en ${file}`);
      break;
    }
  }
  return { found, scanned };
}

export function worktreeIsClean(): boolean {
  return readWorktreeState() === "clean";
}

function readWorktreeState(): "clean" | "dirty" | "unavailable" {
  if (!REPO_ROOT) return "unavailable";
  try {
    const out = execSync("git status --porcelain", {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out.length === 0 ? "clean" : "dirty";
  } catch {
    return "unavailable";
  }
}

export function evaluatePreDeployGate(
  env: NodeJS.ProcessEnv = process.env,
): PreDeployGateResult {
  const checks: PreDeployCheck[] = [];

  const identity = buildEnvironmentIdentity(env);
  const worktreeState = readWorktreeState();
  const immutableArtifact =
    /^[0-9a-f]{40}$/i.test(identity.gitCommit) &&
    /^sha256:[0-9a-f]{64}$/i.test(env.API_ARTIFACT_DIGEST?.trim() ?? "");
  const sourceTraceable =
    worktreeState === "clean" ||
    (worktreeState === "unavailable" && immutableArtifact);
  checks.push({
    id: "worktree_clean",
    label: "Fuente limpia o artefacto OCI inmutable",
    status: sourceTraceable ? "PASS" : "FAIL",
    detail:
      worktreeState === "clean"
        ? "sin cambios sin commitear"
        : worktreeState === "dirty"
          ? "hay cambios sin commitear"
          : immutableArtifact
            ? "runtime sin Git; commit y digest OCI inmutables presentes"
            : "runtime sin Git y sin identidad OCI inmutable completa",
  });

  const commit = identity.gitCommit;
  const releaseTraceable =
    /^[0-9a-f]{40}$/i.test(commit) &&
    (worktreeState !== "unavailable" || immutableArtifact);
  checks.push({
    id: "release_traceable",
    label: "Artefacto de release trazable",
    status: releaseTraceable ? "PASS" : "FAIL",
    detail: releaseTraceable
      ? `commit ${commit.slice(0, 12)}`
      : "commit completo o digest OCI ausente",
  });

  const configIssues = validateStartupConfig(env);
  const configErrors = configIssues.filter(
    (issue) => issue.severity === "error",
  );
  checks.push({
    id: "config_valid",
    label: "Configuración de arranque válida",
    status: configErrors.length === 0 ? "PASS" : "FAIL",
    detail:
      configErrors.length === 0
        ? "sin errores"
        : `${configErrors.length} errores (${configErrors[0]!.message})`,
  });

  const flags = effectiveFeatureFlags(env);
  const unsafeFlags = flags.filter(
    (flag) => flag.enabled && flag.environmentConstraint,
  );
  checks.push({
    id: "feature_flags_safe",
    label: "Feature flags con defaults seguros",
    status: unsafeFlags.length === 0 ? "PASS" : "FAIL",
    detail:
      unsafeFlags.length === 0
        ? "sin flags riesgosos"
        : `${unsafeFlags.map((f) => f.id).join(", ")} activos pese a restricción`,
  });

  const secretScan = scanTrackedSecrets();
  const secretScanEvidenceId = safeEvidenceReference(
    env.SECRET_SCAN_EVIDENCE_ID,
  );
  const secretScanAttested =
    env.SECRET_SCAN_STATUS?.trim().toUpperCase() === "PASS" &&
    env.SECRET_SCAN_COMMIT?.trim() === identity.gitCommit &&
    secretScanEvidenceId !== null &&
    /^[0-9a-f]{40}$/i.test(identity.gitCommit);
  const secretScanAvailable = secretScan.scanned > 0 || secretScanAttested;
  checks.push({
    id: "secret_scan",
    label: "Scan de secretos en repositorio",
    status:
      secretScan.found.length === 0 && secretScanAvailable ? "PASS" : "FAIL",
    detail:
      secretScan.found.length === 0 && secretScanAvailable
        ? secretScan.scanned > 0
          ? `sin secretos (${secretScan.scanned} archivos)`
          : `scan de CI ${secretScanEvidenceId} atestado para commit ${identity.gitCommit.slice(0, 12)}`
        : secretScan.scanned === 0
          ? "scan no disponible y sin atestación de CI"
          : secretScan.found[0]!,
  });

  let manifestDetail: string;
  try {
    const manifest = buildDeploymentManifest(env);
    if (
      identity.environmentClass === "STAGING" ||
      identity.environmentClass === "PRODUCTION"
    ) {
      for (const channel of ["api", "web"] as const) {
        if (
          manifest.artifacts[channel].id === "UNSET" ||
          !/^sha256:[0-9a-f]{64}$/i.test(manifest.artifacts[channel].digest) ||
          !manifest.artifacts[channel].id.endsWith(
            `@${manifest.artifacts[channel].digest}`,
          )
        ) {
          throw new Error(
            `${channel} artifact requires immutable id and sha256 digest`,
          );
        }
      }
    }
    manifestDetail = `release ${manifest.releaseVersion} / esquema OLTP ${manifest.oltpSchemaVersion} / DWH ${manifest.dwhSchemaVersion}`;
  } catch (err) {
    manifestDetail = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  checks.push({
    id: "manifest_complete",
    label: "Manifiesto de despliegue completo",
    status: manifestDetail.startsWith("release") ? "PASS" : "FAIL",
    detail: manifestDetail,
  });

  const aiKillSwitchKnown =
    (env.AI_EGRESS_ENABLED ?? "false") === "true" ||
    (env.AI_EGRESS_ENABLED ?? "false") === "false";
  checks.push({
    id: "kill_switch_known",
    label: "Kill switches conocidos por config",
    status: aiKillSwitchKnown ? "PASS" : "FAIL",
    detail: `AI_EGRESS_ENABLED=${env.AI_EGRESS_ENABLED ?? "false"} en ${identity.environmentClass}`,
  });

  // Tier B: infraestructura/externa. Nunca se afirma verificado sin verificación real.
  checks.push({
    id: "pending_migrations",
    label: "Migraciones pendientes (verificación real en runbook)",
    status: "PENDING_EXTERNAL",
    detail:
      "requiere ejecución de 001-039 contra BD real (verify-deployment-b09-5a.ps1)",
  });
  checks.push({
    id: "backup_available",
    label: "Backup disponible y restaurable",
    status: "PENDING_EXTERNAL",
    detail:
      "requiere verificación real de BACKUP/RESTORE (runbook, no se asume)",
  });
  checks.push({
    id: "rollback_artifact",
    label: "Artefacto de rollback",
    status: "PENDING_EXTERNAL",
    detail:
      "requiere verificación real (revert de release anterior en staging)",
  });
  checks.push({
    id: "staging_smoke",
    label: "Smoke test en staging real",
    status: "PENDING_EXTERNAL",
    detail: "STAGING NOT_AVAILABLE en este entorno",
  });

  const tierAFailed = checks.filter((c) => c.status === "FAIL");
  const pass = tierAFailed.length === 0;
  const deployableToStaging = pass && checks.every((c) => c.status === "PASS");

  return {
    pass,
    deployableToStaging,
    checks,
    evaluatedAt: new Date().toISOString(),
  };
}

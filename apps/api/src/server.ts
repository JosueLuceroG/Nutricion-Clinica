import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { createHealthRouter } from "./routes/health.js";
import authRouter from "./modules/auth/authRoutes.js";
import twoFactorRouter from "./modules/auth/twoFactorRoutes.js";
import telemedicinaRouter, {
  turnRouter,
} from "./modules/telemedicina/telemedicinaRoutes.js";
import sucursalRouter from "./modules/sucursales/sucursalRoutes.js";
import pacienteRouter from "./modules/pacientes/pacienteRoutes.js";
import consultaRouter from "./modules/consultas/consultaRoutes.js";
import antropometriaRouter from "./modules/antropometrias/antropometriaRoutes.js";
import labPanelRouter from "./modules/lab/labPanelRoutes.js";
import planRouter from "./modules/planes/planRoutes.js";
import adherenceRouter from "./modules/adherence/adherenceRoutes.js";
import patientPortalRouter from "./modules/patientPortal/patientPortalRoutes.js";
import syncRouter from "./modules/sync/syncRoutes.js";
import dashboardRouter from "./modules/dashboard/dashboardRoutes.js";
import aiRouter from "./modules/ai/aiRoutes.js";
import aiToolsRouter from "./modules/ai/tools/toolRoutes.js";
import aiExpertRouter from "./modules/ai/expert/expertRoutes.js";
import aiMemoryRouter from "./modules/ai/memory/memoryRoutes.js";
import aiRagRouter from "./modules/ai/rag/ragRoutes.js";
import copilotRouter from "./modules/ai/copilots/copilotRoutes.js";
import patientAiRouter from "./modules/ai/patientAi/patientRoutes.js";
import actionRouter from "./modules/ai/actions/actionRoutes.js";
import agentRouter from "./modules/ai/agents/agentRoutes.js";
import specializationRouter from "./modules/ai/specialization/specializationRoutes.js";
import analyticsRouter from "./modules/dwh/analyticsRoutes.js";
import dwhAnalyticsRouter from "./modules/dwh/analytics/analyticsRoutes.js";
import telemetryRouter from "./modules/observability/telemetryRoutes.js";
import shadowRouter from "./modules/shadow/shadowRoutes.js";
import { registerTelemedicinaChannel } from "./modules/telemedicina/signalingServer.js";
import { registerChatChannel } from "./modules/patientPortal/chatServer.js";
import { setupWebsocketGateway } from "./modules/ws/websocketGateway.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { assertStartupConfigValid } from "./modules/deployment/startupValidation.js";
import { initializeCertificationPersistence } from "./modules/ai/certification/certificationPersistence.js";
import { readEnvironmentClass } from "./modules/deployment/environmentIdentity.js";
import deploymentRouter from "./modules/deployment/deploymentRoutes.js";
import { validateAiConfig } from "./modules/ai/runtime/aiConfigValidation.js";
import { modelRegistry } from "./modules/ai/models/modelRegistry.js";
import { providerRegistry } from "./modules/ai/providers/providerRegistry.js";
import { modelQualificationRegistry } from "./modules/ai/evaluation/certification.js";
import { readServerRuntimeConfig } from "./modules/deployment/runtimeConfig.js";
import {
  startRuntimeJobs,
  type RuntimeJobsHandle,
} from "./services/jobs/runtimeJobs.js";
import { closePool } from "./db/connection.js";
import { closeDwhPool } from "./modules/dwh/dwhConnection.js";
import {
  runStandalonePreflight,
  formatStandalonePreflightReport,
} from "./modules/standalone/preflight.js";
import {
  installStandaloneApiPrefix,
  mountStandaloneWeb,
} from "./modules/standalone/webHosting.js";

const corsOrigins = (
  process.env.CORS_ORIGIN ??
  "http://localhost:1420,http://127.0.0.1:1420,tauri://localhost"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const environmentClass = readEnvironmentClass(process.env);

const app = express();
let runtime: ReturnType<typeof readServerRuntimeConfig> | null = null;
let shuttingDown = false;

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origen no permitido por CORS"));
    },
  }),
);
app.use(express.json({ limit: "10mb" }));
if (process.env.STANDALONE_MODE === "true") {
  installStandaloneApiPrefix(app);
}

app.use("/health", createHealthRouter({ isShuttingDown: () => shuttingDown }));
app.use("/auth", authRouter);
app.use("/auth", twoFactorRouter);
app.use("/telemedicina", turnRouter);
app.use("/telemedicina", telemedicinaRouter);
app.use("/sucursales", sucursalRouter);
app.use("/pacientes", pacienteRouter);
app.use("/consultas", consultaRouter);
app.use("/antropometrias", antropometriaRouter);
app.use("/lab-panels", labPanelRouter);
app.use("/planes", planRouter);
app.use("/adherence", adherenceRouter);
app.use("/patient-portal", patientPortalRouter);
app.use("/sync", syncRouter);
app.use("/dashboard", dashboardRouter);
app.use("/ai", aiRouter);
app.use("/ai/tools", aiToolsRouter);
app.use("/ai/expert", aiExpertRouter);
app.use("/ai/memory", aiMemoryRouter);
app.use("/ai/rag", aiRagRouter);
app.use("/ai/copilots", copilotRouter);
app.use("/ai/patient", patientAiRouter);
app.use("/ai/actions", actionRouter);
app.use("/ai/agents", agentRouter);
app.use("/ai/specialization", specializationRouter);
app.use("/dwh", analyticsRouter);
app.use("/dwh/analytics", dwhAnalyticsRouter);
app.use("/observability", telemetryRouter);
app.use("/shadow", shadowRouter);
app.use("/deployment", deploymentRouter);
if (process.env.STANDALONE_MODE === "true") {
  mountStandaloneWeb(app, process.env.NUTRICLINICA_WEB_ROOT);
}

app.use(errorHandler);

const httpServer = createServer(app);

const websocketServer = setupWebsocketGateway(httpServer, {
  telemedicina: registerTelemedicinaChannel,
  chat: registerChatChannel,
});

let runtimeJobs: RuntimeJobsHandle | null = null;

async function bootstrap(): Promise<void> {
  if (process.env.STANDALONE_MODE === "true") {
    const preflight = await runStandalonePreflight(process.env, "runtime");
    if (!preflight.ok) {
      const failed = preflight.checks
        .filter((check) => check.status === "fail")
        .map((check) => check.id)
        .join(",");
      throw new Error(`standalone preflight failed: ${failed || "unknown"}`);
    }
    console.log(formatStandalonePreflightReport(preflight));
  }
  try {
    assertStartupConfigValid(process.env, {
      role: "api",
      ai: {
        validate: (env) =>
          validateAiConfig(
            env,
            modelRegistry,
            providerRegistry,
            modelQualificationRegistry,
          ).map((issue) => ({
            severity: issue.severity,
            message: issue.message,
          })),
      },
    });
  } catch (error) {
    if (environmentClass === "LOCAL" || environmentClass === "TEST") {
      throw error;
    }
    const sanitized = new Error("startup configuration rejected (fail-fast)");
    sanitized.name = "StartupConfigError";
    throw sanitized;
  }

  const configuredRuntime = readServerRuntimeConfig(process.env);
  runtime = configuredRuntime;
  app.set("trust proxy", configuredRuntime.trustProxy);

  // Certificación clínica desde BD (fail-closed): sin persistencia cargada
  // ningún modelo aparece elegible tras un reinicio (Build 09.5A §56-57).
  await initializeCertificationPersistence(process.env);
  if (shuttingDown) return;
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    httpServer.once("error", onError);
    httpServer.listen(
      configuredRuntime.port,
      configuredRuntime.bindHost,
      () => {
        httpServer.off("error", onError);
        resolve();
      },
    );
  });
  if (shuttingDown) {
    await closeHttpServer();
    return;
  }
  if (configuredRuntime.backgroundJobsEnabled) {
    runtimeJobs = startRuntimeJobs();
  } else {
    console.log("[nutriclinica-api] background jobs disabled for API process");
  }
  console.log(
    `[nutriclinica-api] listening on ${configuredRuntime.bindHost}:${configuredRuntime.port} (${environmentClass})`,
  );
}

async function closeHttpServer(): Promise<void> {
  if (!httpServer.listening) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      httpServer.closeAllConnections();
      resolve();
    }, runtime?.shutdownTimeoutMs ?? 15_000);
    timeout.unref();
    httpServer.close(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function closeWebsocketServer(): Promise<void> {
  if (!httpServer.listening && websocketServer.clients.size === 0) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      for (const client of websocketServer.clients) client.terminate();
      finish();
    }, runtime?.shutdownTimeoutMs ?? 15_000);
    timeout.unref();
    websocketServer.close(finish);
  });
}

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[nutriclinica-api] shutdown ${signal}`);
  for (const client of websocketServer.clients) {
    client.close(1001, "server shutdown");
  }
  await Promise.allSettled([
    closeHttpServer(),
    closeWebsocketServer(),
    runtimeJobs?.stop() ?? Promise.resolve(),
  ]);
  await Promise.allSettled([closePool(), closeDwhPool()]);
  process.exitCode = exitCode;
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

void bootstrap().catch((error: unknown) => {
  const detail =
    error instanceof Error
      ? environmentClass === "LOCAL" || environmentClass === "TEST"
        ? error.message
        : error.name
      : "UnknownStartupError";
  console.error("[nutriclinica-api] startup failed (fail-fast):", detail);
  void shutdown("STARTUP_FAILURE", 1);
});

import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import cron from "node-cron";
import { healthRouter } from "./routes/health.js";
import authRouter from "./modules/auth/authRoutes.js";
import twoFactorRouter from "./modules/auth/twoFactorRoutes.js";
import telemedicinaRouter, { turnRouter } from "./modules/telemedicina/telemedicinaRoutes.js";
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
import { createSignalingServer } from "./modules/telemedicina/signalingServer.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { runRetentionCleanup, RETENTION_CONFIG } from "./services/retention/index.js";

const app = express();

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:1420,http://127.0.0.1:1420,tauri://localhost")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origen no permitido por CORS"));
  },
}));
app.use(express.json({ limit: "5mb" }));

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/auth", twoFactorRouter);
app.use("/telemedicina", telemedicinaRouter);
app.use("/telemedicina", turnRouter);
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

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
const httpServer = createServer(app);

createSignalingServer(httpServer);

httpServer.listen(port, () => {
  console.log(`[nutriclinica-api] listening on http://localhost:${port}`);
});

if (RETENTION_CONFIG.cleanupEnabled) {
  const schedule = RETENTION_CONFIG.cronSchedule;
  console.log(`[retention] scheduling cleanup cron: "${schedule}" (${RETENTION_CONFIG.years} years)`);
  cron.schedule(schedule, () => {
    console.log('[retention] running scheduled cleanup...');
    void runRetentionCleanup().then((result) => {
      console.log(`[retention] cleanup done: ${result.deletedCount} deleted, ${result.errors.length} errors`);
    });
  });
} else {
  console.log('[retention] cleanup disabled via RETENTION_CLEANUP_ENABLED=false');
}

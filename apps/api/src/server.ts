import "dotenv/config";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import authRouter from "./modules/auth/authRoutes.js";
import sucursalRouter from "./modules/sucursales/sucursalRoutes.js";
import pacienteRouter from "./modules/pacientes/pacienteRoutes.js";
import consultaRouter from "./modules/consultas/consultaRoutes.js";
import antropometriaRouter from "./modules/antropometrias/antropometriaRoutes.js";
import labPanelRouter from "./modules/lab/labPanelRoutes.js";
import planRouter from "./modules/planes/planRoutes.js";
import syncRouter from "./modules/sync/syncRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/sucursales", sucursalRouter);
app.use("/pacientes", pacienteRouter);
app.use("/consultas", consultaRouter);
app.use("/antropometrias", antropometriaRouter);
app.use("/lab-panels", labPanelRouter);
app.use("/planes", planRouter);
app.use("/sync", syncRouter);

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`[nutriclinica-api] listening on http://localhost:${port}`);
});

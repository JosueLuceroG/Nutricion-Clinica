import "dotenv/config";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import authRouter from "./modules/auth/authRoutes.js";
import sucursalRouter from "./modules/sucursales/sucursalRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/sucursales", sucursalRouter);

// 14A.6+: sync, etc. se montarán aquí
// app.use("/sync", syncRouter);

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`[nutriclinica-api] listening on http://localhost:${port}`);
});

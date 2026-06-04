import "dotenv/config";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import authRouter from "./modules/auth/authRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/health", healthRouter);
app.use("/auth", authRouter);

// 14B/14C: sucursales, sync, etc. se montarán aquí
// app.use("/sucursales", sucursalesRouter);
// app.use("/sync", syncRouter);

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`[nutriclinica-api] listening on http://localhost:${port}`);
});

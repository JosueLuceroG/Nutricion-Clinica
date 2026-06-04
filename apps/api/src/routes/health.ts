import { Router, type Router as ExpressRouter } from "express";
import { testConnection } from "../db/connection.js";

export const healthRouter: ExpressRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", service: "nutriclinica-api", version: "0.1.0" });
});

healthRouter.get("/db", async (_req, res) => {
  try {
    const ok = await testConnection();
    res.json({ status: ok ? "ok" : "error", db: ok ? "reachable" : "unreachable" });
  } catch (err) {
    res.status(500).json({ status: "error", error: err instanceof Error ? err.message : String(err) });
  }
});

import {
  Router,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from "express";
import { testConnection } from "../db/connection.js";
import { testDwhConnection } from "../modules/dwh/dwhConnection.js";

export interface HealthDependencies {
  oltp: () => Promise<boolean>;
  dwh: () => Promise<boolean>;
  env: NodeJS.ProcessEnv;
  isShuttingDown: () => boolean;
}

export function createHealthRouter(
  overrides: Partial<HealthDependencies> = {},
): ExpressRouter {
  const dependencies: HealthDependencies = {
    oltp: () => testConnection(false),
    dwh: () => testDwhConnection(false),
    env: process.env,
    isShuttingDown: () => false,
    ...overrides,
  };
  const router = Router();
  const liveness = (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: "alive",
      service: "nutriclinica-api",
      releaseVersion: dependencies.env.RELEASE_VERSION ?? "0.0.0-dev",
    });
  };

  router.get("/", liveness);
  router.get("/live", liveness);

  const readiness = async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    if (dependencies.isShuttingDown()) {
      res.status(503).json({
        status: "not_ready",
        checks: { shutdown: "draining" },
        optionalDependencies: {
          aiRuntime: "not_required",
          modelEligibility: "not_checked",
        },
      });
      return;
    }
    const dwhEnabled = dependencies.env.DWH_ENABLED === "true";
    const dwhRequired = dwhEnabled && dependencies.env.DWH_STORE === "sql";
    const [oltpReady, dwhReady] = await Promise.all([
      dependencies.oltp(),
      dwhRequired ? dependencies.dwh() : Promise.resolve(true),
    ]);
    const ready = oltpReady && dwhReady;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      checks: {
        oltp: oltpReady ? "ready" : "not_ready",
        dwh: dwhRequired
          ? dwhReady
            ? "ready"
            : "not_ready"
          : dwhEnabled
            ? "memory"
            : "disabled",
      },
      optionalDependencies: {
        aiRuntime: "not_required",
        modelEligibility: "not_checked",
      },
    });
  };

  router.get("/ready", readiness);
  router.get("/db", readiness);
  return router;
}

export const healthRouter: ExpressRouter = createHealthRouter();

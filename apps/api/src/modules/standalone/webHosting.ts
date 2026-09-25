import { resolve } from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";

export const STANDALONE_API_PREFIX = "/api";

export function rewriteStandaloneApiPath(url: string): string | null {
  if (url === STANDALONE_API_PREFIX) return "/";
  if (!url.startsWith(`${STANDALONE_API_PREFIX}/`)) return null;
  const suffix = url.slice(STANDALONE_API_PREFIX.length);
  return suffix.startsWith("/") ? suffix : `/${suffix}`;
}

/** Enables the same-origin `/api` contract without changing root API routes. */
export function installStandaloneApiPrefix(app: Express): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const rewritten = rewriteStandaloneApiPath(req.url ?? "/");
    if (rewritten === null) {
      next();
      return;
    }
    res.locals.standaloneApiRequest = true;
    req.url = rewritten;
    next();
  });
}

/**
 * Serves an already-built Web artifact from the API process. It is opt-in via
 * `NUTRICLINICA_WEB_ROOT`; no static files are served in normal API mode.
 */
export function mountStandaloneWeb(
  app: Express,
  webRoot: string | undefined,
): void {
  const root = webRoot?.trim();
  if (!root) return;
  const resolvedRoot = resolve(root);
  const staticWeb = express.static(resolvedRoot, {
    fallthrough: true,
    index: false,
    dotfiles: "deny",
    redirect: false,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (res.locals.standaloneApiRequest) {
      next();
      return;
    }
    staticWeb(req, res, next);
  });

  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (res.locals.standaloneApiRequest || req.method !== "GET") {
      next();
      return;
    }
    if (req.accepts("html") !== "html") {
      next();
      return;
    }
    res.sendFile(resolve(resolvedRoot, "index.html"), (error) => {
      if (error) next(error);
    });
  });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    if (res.locals.standaloneApiRequest) {
      res.status(404).json({ error: "Ruta API no encontrada" });
      return;
    }
    next();
  });
}

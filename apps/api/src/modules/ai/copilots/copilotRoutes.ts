import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import { rateLimit } from '../../../middleware/rateLimit.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../../tenancy/middleware/requireSucursalAccess.js';
import { copilotAvailability, getCopilot, listCopilots } from './copilotRegistry.js';

export function createCopilotRouter(): Router {
  const router: Router = ExpressRouter();
  const copilotRateLimit = rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'ai-copilots' });

  router.use(requireAuth, requireSucursalAccess, copilotRateLimit);

  router.get('/', (req: Request, res: Response) => {
    const role = req.user?.rol;
    if (!role) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    const copilots = listCopilots().map((copilot) => ({
      ...copilot,
      availability: copilotAvailability(copilot, role),
    }));
    res.json({ copilots });
  });

  router.get('/:copilotId', (req: Request, res: Response) => {
    const role = req.user?.rol;
    if (!role) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    const copilot = getCopilot(String(req.params.copilotId));
    if (!copilot) {
      res.status(404).json({ error: 'Copiloto no encontrado' });
      return;
    }
    res.json({ copilot: { ...copilot, availability: copilotAvailability(copilot, role) } });
  });

  return router;
}

export default createCopilotRouter();
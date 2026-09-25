import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from './middleware/requireAuth.js';
import { auditLog } from '../../middleware/auditMiddleware.js';
import {
  generateTotpSecret,
  buildTotpUri,
  generateQrCode,
  verifyTotp,
  beginTotpEnrollment,
  findPendingTotpEnrollment,
  activatePendingTotp,
  disableTotp,
  findTotpSecret,
  isTotpEnabled,
} from './application/twoFactorService.js';

const router: Router = ExpressRouter();

router.use(requireAuth);

router.post('/2fa/setup', auditLog('read', '2fa'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (await isTotpEnabled(req.user!.sub)) {
      res.status(409).json({
        error: '2FA ya está habilitado; deshabilítalo con el código actual antes de configurarlo de nuevo',
      });
      return;
    }
    const secret = generateTotpSecret();
    const stored = await beginTotpEnrollment(req.user!.sub, secret, new Date(Date.now() + 10 * 60 * 1000));
    if (!stored) {
      res.status(409).json({ error: 'No fue posible iniciar la configuración de 2FA' });
      return;
    }
    const uri = buildTotpUri(req.user!.email, secret);
    const qrCode = await generateQrCode(uri);
    res.json({ secret, uri, qrCode });
  } catch (err) {
    next(err);
  }
});

const VerifyBodySchema = z.object({
  secret: z.string().min(1),
  totpCode: z.string().min(6).max(6),
});

router.post('/2fa/enable', auditLog('update', '2fa'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profesionalId = req.user!.sub;
    const body = VerifyBodySchema.parse(req.body);
    const enrollment = await findPendingTotpEnrollment(profesionalId);
    if (!enrollment || enrollment.secret !== body.secret) {
      res.status(400).json({
        error: 'La configuración de 2FA no existe, expiró o fue reemplazada',
      });
      return;
    }
    if (!(await verifyTotp(body.totpCode, enrollment.secret))) {
      res.status(400).json({ error: 'Código TOTP inválido' });
      return;
    }
    if (!(await activatePendingTotp(profesionalId, enrollment.storageValue))) {
      res.status(409).json({ error: 'La configuración de 2FA expiró antes de activarse' });
      return;
    }
    res.json({ enabled: true });
  } catch (err) {
    next(err);
  }
});

const DisableBodySchema = z.object({
  totpCode: z.string().min(6).max(6),
});

router.post('/2fa/disable', auditLog('update', '2fa'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profesionalId = req.user!.sub;
    const body = DisableBodySchema.parse(req.body);
    const currentSecret = await findTotpSecret(profesionalId);
    if (!currentSecret) {
      res.status(400).json({ error: '2FA no está habilitado' });
      return;
    }
    if (!(await verifyTotp(body.totpCode, currentSecret))) {
      res.status(400).json({ error: 'Código TOTP inválido' });
      return;
    }
    await disableTotp(profesionalId);
    res.json({ disabled: true });
  } catch (err) {
    next(err);
  }
});

router.get('/2fa/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ enabled: await isTotpEnabled(req.user!.sub) });
  } catch (err) {
    next(err);
  }
});

export default router;

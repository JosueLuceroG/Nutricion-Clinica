import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { requireAuth } from './middleware/requireAuth.js';
import { getPool } from '../../db/connection.js';
import { auditLog } from '../../middleware/auditMiddleware.js';
import {
  generateTotpSecret,
  buildTotpUri,
  generateQrCode,
  verifyTotp,
  enableTotp,
  disableTotp,
} from './application/twoFactorService.js';

const router: Router = ExpressRouter();

router.use(requireAuth);

router.post('/2fa/setup', auditLog('read', '2fa'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = generateTotpSecret();
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
    if (!(await verifyTotp(body.totpCode, body.secret))) {
      res.status(400).json({ error: 'Código TOTP inválido' });
      return;
    }
    await enableTotp(profesionalId, body.secret);
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
    const pool = await getPool();
    const secretResult = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), profesionalId)
      .query<{ totp_secret: string | null }>(`SELECT totp_secret FROM profesionales WHERE id = @id AND deleted_at IS NULL`);
    const currentSecret = secretResult.recordset[0]?.totp_secret;
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
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), req.user!.sub)
      .query<{ totp_enabled: boolean }>(`SELECT totp_enabled FROM profesionales WHERE id = @id AND deleted_at IS NULL`);
    res.json({ enabled: result.recordset[0]?.totp_enabled ?? false });
  } catch (err) {
    next(err);
  }
});

export default router;

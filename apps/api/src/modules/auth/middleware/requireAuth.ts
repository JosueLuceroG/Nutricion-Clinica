import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../../../middleware/errorHandler.js';
import { verifyToken } from '../application/authService.js';
import type { JwtPayload, Role } from '@nutriclinica/shared';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization') ?? req.header('Authorization');
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedError('Falta header Authorization: Bearer <token>');
    }
    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedError('Token vacío');

    const payload: JwtPayload = await verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    next(new UnauthorizedError(err instanceof Error ? err.message : 'Token inválido'));
  }
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!allowed.includes(req.user.rol)) {
      next(new ForbiddenError(`Rol ${req.user.rol} no autorizado para este endpoint`));
      return;
    }
    next();
  };
}

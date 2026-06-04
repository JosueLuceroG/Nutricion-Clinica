import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../../../middleware/errorHandler.js';
import type { Role } from '@nutriclinica/shared';

const HEADER_NAME = 'x-sucursal-id';
const QUERY_PARAM = 'sucursalId';

function extractSucursalId(req: Request): string | null {
  const headerVal = req.header(HEADER_NAME);
  if (headerVal && headerVal.trim().length > 0) return headerVal.trim();
  const queryVal = req.query[QUERY_PARAM];
  if (typeof queryVal === 'string' && queryVal.length > 0) return queryVal;
  if (Array.isArray(queryVal) && typeof queryVal[0] === 'string') return queryVal[0];
  return null;
}

export function requireSucursalAccess(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }
  const sucursalId = extractSucursalId(req);
  if (!sucursalId) {
    next(new ForbiddenError(`Falta header '${HEADER_NAME}' o query param '${QUERY_PARAM}'`));
    return;
  }
  if (req.user.rol !== 'admin' && !req.user.sucursalIds.includes(sucursalId)) {
    next(new ForbiddenError(`El profesional no tiene acceso a la sucursal ${sucursalId}`));
    return;
  }
  req.sucursalId = sucursalId;
  next();
}

export function getRequestSucursalId(req: Request): string {
  if (!req.sucursalId) throw new Error('requireSucursalAccess no se ejecutó');
  return req.sucursalId;
}

export function isCrossTenantAllowed(req: Request): boolean {
  return req.user?.rol === ('admin' satisfies Role);
}

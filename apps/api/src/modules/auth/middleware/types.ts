import type { Request } from 'express';
import type { JwtPayload, Role } from '@nutriclinica/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      sucursalId?: string;
    }
  }
}

export type AuthRequest = Request & {
  user: JwtPayload;
  sucursalId?: string;
};

export type RoleRequirement = Role | readonly Role[];

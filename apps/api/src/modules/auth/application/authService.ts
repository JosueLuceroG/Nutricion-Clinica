import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { getPool } from '../../../db/connection.js';
import {
  InvalidCredentialsError,
  EmailAlreadyExistsError,
  InactiveAccountError,
} from '../domain/errors.js';
import { validatePasswordStrength } from '../domain/passwordPolicy.js';
import type {
  Role,
  AuthResponse,
  JwtPayload,
} from '@nutriclinica/shared';

const ARGON2_OPTIONS = {
  type: 2 as const,
  memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19456),
  timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
  parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
};

export interface ProfesionalRow {
  id: string;
  email: string;
  password_hash: string;
  nombre_completo: string;
  rol: Role;
  activo: boolean;
  email_verificado: boolean;
}

export interface SucursalAsignada {
  id: string;
  nombre: string;
  es_titular: boolean;
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export async function findProfesionalByEmail(email: string): Promise<ProfesionalRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('email', sql.NVarChar(200), email.toLowerCase().trim())
    .query<ProfesionalRow>(
      `SELECT TOP 1 id, email, password_hash, nombre_completo, rol, activo, email_verificado
         FROM profesionales
        WHERE LOWER(email) = LOWER(@email) AND deleted_at IS NULL`,
    );
  return result.recordset[0] ?? null;
}

export async function findProfesionalById(id: string): Promise<ProfesionalRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query<ProfesionalRow>(
      `SELECT TOP 1 id, email, password_hash, nombre_completo, rol, activo, email_verificado
         FROM profesionales
        WHERE id = @id AND deleted_at IS NULL`,
    );
  return result.recordset[0] ?? null;
}

export async function listSucursalesForProfesional(profesionalId: string): Promise<SucursalAsignada[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, profesionalId)
    .query<SucursalAsignada>(
      `SELECT s.id, s.nombre, ps.es_titular
         FROM profesional_sucursal ps
         INNER JOIN sucursales s ON s.id = ps.sucursal_id
        WHERE ps.profesional_id = @id AND s.activa = 1 AND s.deleted_at IS NULL
        ORDER BY ps.es_titular DESC, s.nombre`,
    );
  return result.recordset;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const prof = await findProfesionalByEmail(email);
  if (!prof) throw new InvalidCredentialsError();
  if (!prof.activo) throw new InactiveAccountError();

  const ok = await verifyPassword(prof.password_hash, password);
  if (!ok) throw new InvalidCredentialsError();

  const sucursales = await listSucursalesForProfesional(prof.id);
  const token = await signToken({
    sub: prof.id,
    email: prof.email,
    rol: prof.rol,
    sucursalIds: sucursales.map((s) => s.id),
  });

  await markLastLogin(prof.id);

  return {
    token,
    profesional: {
      id: prof.id,
      email: prof.email,
      nombreCompleto: prof.nombre_completo,
      rol: prof.rol,
    },
    sucursales: sucursales.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      esTitular: s.es_titular,
    })),
    sucursalActivaId: sucursales[0]?.id ?? null,
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  nombreCompleto: string;
  rol: Role;
  cedulaProfesional?: string | null;
  telefono?: string | null;
  sucursalIds: string[];
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  validatePasswordStrength(input.password);
  const email = input.email.toLowerCase().trim();

  const existing = await findProfesionalByEmail(email);
  if (existing) throw new EmailAlreadyExistsError();

  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const pool = await getPool();

  await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('email', sql.NVarChar(200), email)
    .input('password_hash', sql.NVarChar(255), passwordHash)
    .input('nombre', sql.NVarChar(200), input.nombreCompleto)
    .input('rol', sql.NVarChar(40), input.rol)
    .input('cedula', sql.NVarChar(40), input.cedulaProfesional ?? null)
    .input('telefono', sql.NVarChar(40), input.telefono ?? null)
    .query(
      `INSERT INTO profesionales
         (id, email, password_hash, nombre_completo, rol, cedula_profesional, telefono, email_verificado, activo)
       VALUES
         (@id, @email, @password_hash, @nombre, @rol, @cedula, @telefono, 0, 1)`,
    );

  for (const sucursalId of input.sucursalIds) {
    await pool
      .request()
      .input('prof_id', sql.UniqueIdentifier, id)
      .input('suc_id', sql.UniqueIdentifier, sucursalId)
      .query(
        `IF NOT EXISTS (SELECT 1 FROM profesional_sucursal WHERE profesional_id = @prof_id AND sucursal_id = @suc_id)
           INSERT INTO profesional_sucursal (profesional_id, sucursal_id, es_titular)
           VALUES (@prof_id, @suc_id, 0)`,
      );
  }

  const prof = await findProfesionalById(id);
  if (!prof) throw new Error('Profesional no encontrado tras registro');
  const sucursales = await listSucursalesForProfesional(id);
  const token = await signToken({
    sub: prof.id,
    email: prof.email,
    rol: prof.rol,
    sucursalIds: sucursales.map((s) => s.id),
  });

  return {
    token,
    profesional: {
      id: prof.id,
      email: prof.email,
      nombreCompleto: prof.nombre_completo,
      rol: prof.rol,
    },
    sucursales: sucursales.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      esTitular: s.es_titular,
    })),
    sucursalActivaId: sucursales[0]?.id ?? null,
  };
}

export async function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const { default: jwt } = await import('jsonwebtoken');
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as `${number}${'s' | 'm' | 'h' | 'd'}`;
  return jwt.sign(payload, secret, {
    expiresIn,
    issuer: process.env.JWT_ISSUER ?? 'nutriclinica-api',
    audience: process.env.JWT_AUDIENCE ?? 'nutriclinica-web',
  });
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { default: jwt } = await import('jsonwebtoken');
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  return jwt.verify(token, secret, {
    issuer: process.env.JWT_ISSUER ?? 'nutriclinica-api',
    audience: process.env.JWT_AUDIENCE ?? 'nutriclinica-web',
  }) as JwtPayload;
}

async function markLastLogin(profesionalId: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.UniqueIdentifier, profesionalId)
    .query('UPDATE profesionales SET ultimo_login_at = SYSUTCDATETIME() WHERE id = @id');
}

import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import sql from 'mssql';
import { getPool, closePool } from './connection.js';

interface SeedConfig {
  adminEmail: string;
  adminPassword: string;
  adminNombre: string;
  sucursalNombre: string;
}

function readConfig(): SeedConfig {
  return {
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@nutriclinica.local',
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'CambiaEstaPassword123!',
    adminNombre: process.env.SEED_ADMIN_NOMBRE ?? 'Administrador',
    sucursalNombre: process.env.SEED_SUCURSAL_NOMBRE ?? 'Sucursal Centro',
  };
}

export async function runSeed(): Promise<{ sucursalId: string; profesionalId: string }> {
  const cfg = readConfig();
  const pool = await getPool();

  const existing = await pool
    .request()
    .input('email', sql.NVarChar(200), cfg.adminEmail)
    .query<{ id: string }>(
      `SELECT id FROM profesionales WHERE email = @email AND deleted_at IS NULL`,
    );

  if (existing.recordset.length > 0) {
    const adminId = existing.recordset[0]!.id;
    const suc = await pool
      .request()
      .input('id', sql.UniqueIdentifier, adminId)
      .query<{ sucursal_id: string }>(
        `SELECT TOP 1 sucursal_id FROM profesional_sucursal WHERE profesional_id = @id`,
      );
    return {
      sucursalId: suc.recordset[0]?.sucursal_id ?? adminId,
      profesionalId: adminId,
    };
  }

  const sucursalId = randomUUID();
  await pool
    .request()
    .input('id', sql.UniqueIdentifier, sucursalId)
    .input('nombre', sql.NVarChar(120), cfg.sucursalNombre)
    .query(
      `IF NOT EXISTS (SELECT 1 FROM sucursales WHERE nombre = @nombre AND deleted_at IS NULL)
         INSERT INTO sucursales (id, nombre) VALUES (@id, @nombre)`,
    );

  const sucRow = await pool
    .request()
    .input('nombre', sql.NVarChar(120), cfg.sucursalNombre)
    .query<{ id: string }>(
      `SELECT id FROM sucursales WHERE nombre = @nombre AND deleted_at IS NULL`,
    );
  const finalSucursalId = sucRow.recordset[0]?.id ?? sucursalId;

  const profesionalId = randomUUID();
  const passwordHash = await argon2.hash(cfg.adminPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await pool
    .request()
    .input('id', sql.UniqueIdentifier, profesionalId)
    .input('email', sql.NVarChar(200), cfg.adminEmail)
    .input('password_hash', sql.NVarChar(255), passwordHash)
    .input('nombre', sql.NVarChar(200), cfg.adminNombre)
    .input('rol', sql.NVarChar(40), 'admin')
    .query(
      `INSERT INTO profesionales (id, email, password_hash, nombre_completo, rol, email_verificado, activo)
       VALUES (@id, @email, @password_hash, @nombre, @rol, 1, 1)`,
    );

  await pool
    .request()
    .input('prof_id', sql.UniqueIdentifier, profesionalId)
    .input('suc_id', sql.UniqueIdentifier, finalSucursalId)
    .query(
      `IF NOT EXISTS (SELECT 1 FROM profesional_sucursal WHERE profesional_id = @prof_id AND sucursal_id = @suc_id)
         INSERT INTO profesional_sucursal (profesional_id, sucursal_id, es_titular)
         VALUES (@prof_id, @suc_id, 1)`,
    );

  return { sucursalId: finalSucursalId, profesionalId };
}

async function main(): Promise<void> {
  console.log('=== nutriclinica: seed (sucursal + admin) ===');
  try {
    const result = await runSeed();
    console.log(`ok sucursal_id=${result.sucursalId}`);
    console.log(`ok profesional_id=${result.profesionalId}`);
  } catch (err) {
    console.error('error en seed:', err);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('seed.ts');
if (invokedDirectly) {
  void main();
}

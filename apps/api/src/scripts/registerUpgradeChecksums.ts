import 'dotenv/config';
import sql from 'mssql';
import { getPool, closePool } from '../db/connection.js';
import { listMigrations } from '../db/migrate.js';

const UPGRADE_EXCLUDES = ['036-build07-rag-versioning-memory.sql'];

async function main() {
  const pool = await getPool();
  await pool.request().query(
    `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'schema_migrations')
       CREATE TABLE schema_migrations (
         filename NVARCHAR(255) NOT NULL PRIMARY KEY,
         applied_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
         checksum NVARCHAR(64) NOT NULL
       )`,
  );
  const migrations = await listMigrations();
  for (const m of migrations) {
    if (UPGRADE_EXCLUDES.includes(m.filename)) continue;
    await pool
      .request()
      .input('filename', sql.NVarChar(255), m.filename)
      .input('checksum', sql.NVarChar(64), m.checksum)
      .query(
        `IF EXISTS (SELECT 1 FROM schema_migrations WHERE filename = @filename)
           UPDATE schema_migrations SET checksum = @checksum WHERE filename = @filename
         ELSE
           INSERT INTO schema_migrations (filename, checksum) VALUES (@filename, @checksum)`,
      );
    console.log('registrado', m.filename);
  }
  await closePool();
}

void main();
import "dotenv/config";
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sql from 'mssql';
import { getPool, closePool } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

export interface MigrationFile {
  filename: string;
  content: string;
  checksum: string;
}

export function checksumOf(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function listMigrations(): Promise<MigrationFile[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  const sqlFiles = entries.filter((f) => f.endsWith('.sql')).sort();
  return Promise.all(
    sqlFiles.map(async (filename) => {
      const content = await readFile(join(MIGRATIONS_DIR, filename), 'utf8');
      return { filename, content, checksum: checksumOf(content) };
    }),
  );
}

export interface ApplyMigrationsOptions {
  force?: boolean;
  onProgress?: (msg: string) => void;
}

export interface MigrationResult {
  filename: string;
  status: 'applied' | 'skipped' | 'reapplied' | 'error';
  error?: string;
}

export async function applyMigrations(
  options: ApplyMigrationsOptions = {},
): Promise<MigrationResult[]> {
  const log = options.onProgress ?? ((m) => console.log(m));
  const pool = await getPool();
  const migrations = await listMigrations();
  const results: MigrationResult[] = [];

  const ensured = await ensureMigrationsTable(pool);
  log(ensured);

  const applied = await fetchAppliedMigrations(pool);
  const appliedMap = new Map(applied.map((r) => [r.filename, r.checksum]));

  for (const m of migrations) {
    const existing = appliedMap.get(m.filename);
    if (existing === m.checksum) {
      log(`skip  ${m.filename} (ya aplicada)`);
      results.push({ filename: m.filename, status: 'skipped' });
      continue;
    }
    if (existing && !options.force) {
      const msg = `migration ${m.filename} ya aplicada con checksum distinto. usar --force para re-ejecutar.`;
      log(`error ${msg}`);
      results.push({ filename: m.filename, status: 'error', error: msg });
      continue;
    }

      log(`apply ${m.filename}`);
      try {
        // mssql@11's `request.batch()` falla con archivos grandes que
        // contienen `IF NOT EXISTS ... CREATE TABLE` anidados. Como ya
        // chequeamos `schema_migrations` arriba (idempotente), los
        // statements son seguros de re-ejecutar. Dividimos por `;` y
        // enviamos cada uno con `request.query()`.
        const statements = m.content
          .split(/;\s*(?=\n|$)/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !/^(--\s*)+$/.test(s))
          .map((s) => (s.endsWith(';') ? s : s + ';'));
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          try {
            await pool.request().query(stmt);
          } catch (stmtErr) {
            const e = stmtErr as Error & { precedingErrors?: Array<{ message: string }> };
            log(`  stmt ${i} fail (len=${stmt.length}): ${e.message}`);
            if (e.precedingErrors) {
              for (const pe of e.precedingErrors) log(`    pre: ${pe.message}`);
            }
            throw e;
          }
        }
      await pool
        .request()
        .input('filename', sql.NVarChar(255), m.filename)
        .input('checksum', sql.NVarChar(64), m.checksum)
        .query(
          `IF EXISTS (SELECT 1 FROM schema_migrations WHERE filename = @filename)
             UPDATE schema_migrations SET applied_at = SYSUTCDATETIME(), checksum = @checksum WHERE filename = @filename
           ELSE
             INSERT INTO schema_migrations (filename, checksum) VALUES (@filename, @checksum)`,
        );
      results.push({
        filename: m.filename,
        status: existing ? 'reapplied' : 'applied',
      });
      log(`ok    ${m.filename}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`fail  ${m.filename}: ${msg}`);
      results.push({ filename: m.filename, status: 'error', error: msg });
    }
  }

  return results;
}

async function ensureMigrationsTable(pool: sql.ConnectionPool): Promise<string> {
  await pool
    .request()
    .query(
      `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'schema_migrations')
         CREATE TABLE schema_migrations (
           filename NVARCHAR(255) NOT NULL PRIMARY KEY,
           applied_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
           checksum NVARCHAR(64) NOT NULL
         )`,
    );
  return 'tabla schema_migrations lista';
}

interface AppliedRow {
  filename: string;
  checksum: string;
}

async function fetchAppliedMigrations(pool: sql.ConnectionPool): Promise<AppliedRow[]> {
  const result = await pool
    .request()
    .query<AppliedRow>('SELECT filename, checksum FROM schema_migrations');
  return result.recordset;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  console.log('=== nutriclinica: migraciones SQL Server ===');
  try {
    const results = await applyMigrations({ force });
    const errors = results.filter((r) => r.status === 'error');
    console.log(`\nresultado: ${results.length} archivos, ${errors.length} errores`);
    if (errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('error fatal:', err);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('migrate.ts');
if (invokedDirectly) {
  void main();
}

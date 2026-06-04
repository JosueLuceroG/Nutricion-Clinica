import sql from "mssql";

const config: sql.config = {
  user: process.env.DB_USER ?? "sa",
  password: process.env.DB_PASSWORD ?? "",
  server: process.env.DB_SERVER ?? "localhost",
  database: process.env.DB_NAME ?? "nutriclinica",
  port: Number(process.env.DB_PORT ?? 1433),
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_CERT !== "false",
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30_000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) return pool;
  pool = await sql.connect(config);
  return pool;
}

export async function testConnection(): Promise<boolean> {
  try {
    const p = await getPool();
    await p.request().query("SELECT 1 AS ok");
    return true;
  } catch (err) {
    console.error("[db] connection failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

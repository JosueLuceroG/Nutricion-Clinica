import sql from 'mssql';

const pool = await sql.connect({
  user: 'sa',
  password: 'NutriCl1n1c4_2026!',
  server: 'localhost',
  database: 'nutriclinica',
  port: 1433,
  options: { encrypt: false, trustServerCertificate: true },
});

console.log('=== pacientes ===');
const r1 = await pool.request().query(
  'SELECT TOP 5 id, nombres, apellido_paterno, created_at FROM pacientes ORDER BY created_at DESC',
);
console.table(r1.recordset);

console.log('=== sync_state (last_pulled_at por sucursal) ===');
const r2 = await pool.request().query(
  'SELECT TOP 5 sucursal_id, entity_type, last_pulled_at, last_pushed_at FROM sync_state ORDER BY last_pulled_at DESC',
);
console.table(r2.recordset);

await pool.close();

import { getPool, closePool } from './connection.js';

console.log('=== pacientes ===');
const r1 = await getPool()
  .then((pool) => pool.request().query(
    'SELECT TOP 5 id, nombres, apellido_paterno, created_at FROM pacientes ORDER BY created_at DESC',
  ));
console.table(r1.recordset);

console.log('=== sync_state (last_pulled_at por sucursal) ===');
const r2 = await getPool()
  .then((pool) => pool.request().query(
    'SELECT TOP 5 sucursal_id, entity_type, last_pulled_at, last_pushed_at FROM sync_state ORDER BY last_pulled_at DESC',
  ));
console.table(r2.recordset);

await closePool();
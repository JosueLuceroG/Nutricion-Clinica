import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checksumOf, listMigrations, splitSqlBatches } from './migrate.js';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('mssql', () => {
  const NVarChar = (n: number) => ({ type: 'NVarChar', length: n });
  const UniqueIdentifier = () => ({ type: 'UniqueIdentifier' });
  return {
    default: {
      NVarChar,
      UniqueIdentifier,
    },
  };
});

vi.mock('./connection.js', () => ({
  getPool: vi.fn(),
  closePool: vi.fn(),
}));

import { readdir, readFile } from 'node:fs/promises';

describe('migrate — utilidades', () => {
  it('checksumOf produce SHA-256 hex de 64 chars', () => {
    const cs = checksumOf('CREATE TABLE foo (id INT);');
    expect(cs).toMatch(/^[a-f0-9]{64}$/);
  });

  it('checksumOf es determin\u00edstico', () => {
    const a = checksumOf('hello');
    const b = checksumOf('hello');
    expect(a).toBe(b);
  });

  it('checksumOf distingue contenido distinto', () => {
    expect(checksumOf('a')).not.toBe(checksumOf('b'));
  });

  it('checksumOf normaliza CRLF para evitar drift entre sistemas operativos', () => {
    expect(checksumOf('CREATE TABLE a;\nSELECT 1;\n')).toBe(
      checksumOf('CREATE TABLE a;\r\nSELECT 1;\r\n'),
    );
  });

  it('splitSqlBatches conserva bloques IF/BEGIN/END con punto y coma', () => {
    const batches = splitSqlBatches(`IF EXISTS (SELECT 1)\nBEGIN\n  ALTER TABLE dbo.t ALTER COLUMN name NVARCHAR(400) NULL;\nEND;`);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toContain('ALTER TABLE dbo.t');
    expect(batches[0]).toContain('END;');
  });

  it('splitSqlBatches separa solo por GO en linea independiente', () => {
    const batches = splitSqlBatches(`CREATE TABLE a (id INT);\nGO\nCREATE TABLE b (id INT);`);

    expect(batches).toEqual(['CREATE TABLE a (id INT);', 'CREATE TABLE b (id INT);']);
  });

  it('splitSqlBatches ignora batches solo con comentarios', () => {
    const batches = splitSqlBatches(`-- comment\nGO\n/* comment */\nGO\nSELECT 1;`);

    expect(batches).toEqual(['SELECT 1;']);
  });
});

describe('migrate — listMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lee y ordena .sql del directorio de migraciones', async () => {
    vi.mocked(readdir).mockResolvedValue([
      '002-domain.sql',
      '001-init.sql',
      'README.md',
    ] as never);
    vi.mocked(readFile).mockImplementation(async (p) => {
      const path = String(p);
      if (path.endsWith('001-init.sql')) return 'CREATE TABLE a;';
      if (path.endsWith('002-domain.sql')) return 'CREATE TABLE b;';
      throw new Error(`unexpected read ${path}`);
    });

    const list = await listMigrations();
    expect(list).toHaveLength(2);
    expect(list[0]!.filename).toBe('001-init.sql');
    expect(list[1]!.filename).toBe('002-domain.sql');
    expect(list[0]!.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('filtra archivos no .sql', async () => {
    vi.mocked(readdir).mockResolvedValue([
      '001-init.sql',
      'notes.txt',
      '.DS_Store',
    ] as never);
    vi.mocked(readFile).mockImplementation(async (p) => {
      if (String(p).endsWith('001-init.sql')) return '-- sql';
      return '';
    });

    const list = await listMigrations();
    expect(list.map((m) => m.filename)).toEqual(['001-init.sql']);
  });

  it('directorio vac\u00edo retorna lista vac\u00eda', async () => {
    vi.mocked(readdir).mockResolvedValue([] as never);
    const list = await listMigrations();
    expect(list).toEqual([]);
  });
});

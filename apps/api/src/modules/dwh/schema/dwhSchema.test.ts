import { describe, expect, it, vi } from "vitest";
import {
  DWH_PREVIOUS_SCHEMA_VERSION,
  DWH_SCHEMA_VERSION,
  applyDwhSchema,
  assertDwhSchemaCompatible,
  dwhDdl,
  dwhPreviousSchemaChecksum,
  dwhSchemaChecksum,
  dwhSchemaChecksumOf,
  dwhUpgradeDdl,
} from "./dwhSchema.js";

function fakeSchemaPool(initial?: {
  tableExists?: boolean;
  versions?: Record<string, string>;
}) {
  let tableExists = initial?.tableExists ?? false;
  const versions = new Map(Object.entries(initial?.versions ?? {}));
  const batches: string[] = [];
  const inserts: string[] = [];
  const pool = {
    request: vi.fn(() => {
      const inputs: Record<string, unknown> = {};
      return {
        input(name: string, _type: unknown, value: unknown) {
          inputs[name] = value;
          return this;
        },
        async query(query: string) {
          if (query.includes("SELECT checksum FROM dwh_schema_version")) {
            if (!tableExists) {
              throw Object.assign(new Error("missing"), { number: 208 });
            }
            const checksum = versions.get(String(inputs.schemaVersion));
            return {
              recordset: checksum ? [{ checksum }] : [],
            };
          }
          if (query.includes("INSERT INTO dwh_schema_version")) {
            tableExists = true;
            const version = String(inputs.schemaVersion);
            versions.set(version, String(inputs.checksum));
            inserts.push(version);
            return { recordset: [] };
          }
          throw new Error(`Unexpected schema query: ${query}`);
        },
        async batch(ddl: string) {
          batches.push(ddl);
          if (ddl.includes("CREATE TABLE dwh_schema_version")) tableExists = true;
          return { recordset: [] };
        },
      };
    }),
  };
  return { pool, versions, batches, inserts };
}

describe("DWH schema chain", () => {
  it("does not drift for CRLF or a terminal newline", () => {
    const schema = "CREATE TABLE example (id INT);";
    const expected = dwhSchemaChecksumOf(schema);
    expect(dwhSchemaChecksumOf(`${schema}\n`)).toBe(expected);
    expect(dwhSchemaChecksumOf(`${schema}\r\n`)).toBe(expected);
  });

  it("keeps the frozen dwh-08-002 artifact immutable", () => {
    expect(DWH_PREVIOUS_SCHEMA_VERSION).toBe("dwh-08-002");
    expect(dwhPreviousSchemaChecksum()).toBe(
      "9fd179f5a9821930d99c5b87a2e17043eab94f5aa54726d620513fd096dcab40",
    );
    expect(dwhDdl()).not.toContain("source_version BINARY(8)");
  });

  it("fails closed until both exact schema-chain records exist", async () => {
    const incomplete = fakeSchemaPool({
      tableExists: true,
      versions: {
        [DWH_PREVIOUS_SCHEMA_VERSION]: dwhPreviousSchemaChecksum(),
      },
    });
    await expect(
      assertDwhSchemaCompatible(incomplete.pool as never),
    ).rejects.toThrow(/one-shot/);

    const compatible = fakeSchemaPool({
      tableExists: true,
      versions: {
        [DWH_PREVIOUS_SCHEMA_VERSION]: dwhPreviousSchemaChecksum(),
        [DWH_SCHEMA_VERSION]: dwhSchemaChecksum(),
      },
    });
    await expect(
      assertDwhSchemaCompatible(compatible.pool as never),
    ).resolves.toBeUndefined();
  });

  it("does not confuse a permission failure with an absent version table", async () => {
    const request = {
      input: vi.fn().mockReturnThis(),
      query: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("permission denied"), { number: 229 }),
        ),
    };
    const pool = { request: vi.fn(() => request) };

    await expect(applyDwhSchema(pool as never)).rejects.toThrow(
      "permission denied",
    );
    expect(pool.request).toHaveBeenCalledTimes(1);
  });

  it("installs the frozen base before the additive upgrade and is idempotent", async () => {
    const fake = fakeSchemaPool();

    await expect(applyDwhSchema(fake.pool as never)).resolves.toBeUndefined();
    expect(fake.batches).toHaveLength(2);
    expect(fake.batches[0]).toContain("CREATE TABLE dwh_schema_version");
    expect(fake.batches[1]).toContain("dwh-08-002 -> dwh-08-003");
    expect(fake.inserts).toEqual([
      DWH_PREVIOUS_SCHEMA_VERSION,
      DWH_SCHEMA_VERSION,
    ]);
    expect(fake.versions.get(DWH_PREVIOUS_SCHEMA_VERSION)).toBe(
      dwhPreviousSchemaChecksum(),
    );
    expect(fake.versions.get(DWH_SCHEMA_VERSION)).toBe(dwhSchemaChecksum());

    await expect(applyDwhSchema(fake.pool as never)).resolves.toBeUndefined();
    expect(fake.batches).toHaveLength(2);
    expect(fake.inserts).toHaveLength(2);
  });

  it("upgrades an existing compatible dwh-08-002 database without replaying base DDL", async () => {
    const fake = fakeSchemaPool({
      tableExists: true,
      versions: {
        [DWH_PREVIOUS_SCHEMA_VERSION]: dwhPreviousSchemaChecksum(),
      },
    });

    await expect(applyDwhSchema(fake.pool as never)).resolves.toBeUndefined();
    expect(fake.batches).toEqual([dwhUpgradeDdl().trim()]);
    expect(fake.inserts).toEqual([DWH_SCHEMA_VERSION]);
  });

  it("rejects drift in either the frozen base or current chain head", async () => {
    const baseDrift = fakeSchemaPool({
      tableExists: true,
      versions: { [DWH_PREVIOUS_SCHEMA_VERSION]: "wrong" },
    });
    await expect(applyDwhSchema(baseDrift.pool as never)).rejects.toThrow(
      /dwh-08-002.*checksum distinto/,
    );

    const headDrift = fakeSchemaPool({
      tableExists: true,
      versions: {
        [DWH_PREVIOUS_SCHEMA_VERSION]: dwhPreviousSchemaChecksum(),
        [DWH_SCHEMA_VERSION]: "wrong",
      },
    });
    await expect(applyDwhSchema(headDrift.pool as never)).rejects.toThrow(
      /dwh-08-003.*checksum distinto/,
    );
  });

  it("keeps the upgrade additive and declares precise validity constraints", () => {
    const ddl = dwhUpgradeDdl();
    expect(ddl).toContain("valid_from DATETIME2(3) NOT NULL");
    expect(ddl).toContain("valid_to DATETIME2(3) NULL");
    expect(ddl).toContain("source_version BINARY(8) NULL");
    expect(ddl).toContain("WHERE is_current = 1");
    expect(ddl).not.toMatch(/\b(?:DELETE|TRUNCATE|DROP\s+TABLE)\b/i);
  });
});

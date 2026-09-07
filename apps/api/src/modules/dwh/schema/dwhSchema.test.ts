import { describe, expect, it, vi } from "vitest";
import {
  applyDwhSchema,
  assertDwhSchemaCompatible,
  dwhSchemaChecksum,
  dwhSchemaChecksumOf,
} from "./dwhSchema.js";

describe("DWH schema checksum canonicalization", () => {
  it("does not drift for CRLF or a terminal newline", () => {
    const schema = "CREATE TABLE example (id INT);";
    const expected = dwhSchemaChecksumOf(schema);
    expect(dwhSchemaChecksumOf(`${schema}\n`)).toBe(expected);
    expect(dwhSchemaChecksumOf(`${schema}\r\n`)).toBe(expected);
  });

  it("fails closed until the exact one-shot schema is recorded", async () => {
    const request = {
      input: vi.fn().mockReturnThis(),
      query: vi.fn().mockResolvedValue({ recordset: [{ checksum: "wrong" }] }),
    };
    const pool = { request: vi.fn(() => request) };

    await expect(assertDwhSchemaCompatible(pool as never)).rejects.toThrow(
      /one-shot/,
    );

    request.query.mockResolvedValue({
      recordset: [{ checksum: dwhSchemaChecksum() }],
    });
    await expect(
      assertDwhSchemaCompatible(pool as never),
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

  it("applies the first schema only for SQL Server missing-object error 208", async () => {
    const select = {
      input: vi.fn().mockReturnThis(),
      query: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("missing"), { number: 208 }),
        ),
    };
    const ddl = { batch: vi.fn().mockResolvedValue(undefined) };
    const insert = {
      input: vi.fn().mockReturnThis(),
      query: vi.fn().mockResolvedValue(undefined),
    };
    const requests = [select, ddl, insert];
    const pool = { request: vi.fn(() => requests.shift()) };

    await expect(applyDwhSchema(pool as never)).resolves.toBeUndefined();
    expect(ddl.batch).toHaveBeenCalledTimes(1);
    expect(insert.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO dwh_schema_version"),
    );
  });
});

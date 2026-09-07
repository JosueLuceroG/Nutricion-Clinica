import { beforeAll, describe, expect, it, vi } from "vitest";
import type { closePool, getPool } from "./connection.js";
import type { closeDwhPool, getDwhPool } from "../modules/dwh/dwhConnection.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const mocks = vi.hoisted(() => ({
  instances: [] as Array<{
    connectGate: Deferred<unknown>;
    close: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("mssql", () => {
  class ConnectionPool {
    readonly connectGate = deferred<ConnectionPool>();
    readonly close = vi.fn(async () => undefined);

    constructor(_config: unknown) {
      mocks.instances.push(this);
    }

    connect(): Promise<ConnectionPool> {
      return this.connectGate.promise;
    }
  }

  return { default: { ConnectionPool } };
});

let connection: { closePool: typeof closePool; getPool: typeof getPool };
let dwhConnection: {
  closeDwhPool: typeof closeDwhPool;
  getDwhPool: typeof getDwhPool;
};

beforeAll(async () => {
  vi.stubEnv("DB_NAME", "lifecycle_oltp");
  vi.stubEnv("DWH_DATABASE", "lifecycle_dwh");
  connection = await import("./connection.js");
  dwhConnection = await import("../modules/dwh/dwhConnection.js");
});

async function expectSerializedReconnect(
  getPool: () => Promise<unknown>,
  closePool: () => Promise<void>,
) {
  const firstIndex = mocks.instances.length;
  const firstGet = getPool();
  expect(mocks.instances).toHaveLength(firstIndex + 1);
  const first = mocks.instances[firstIndex]!;

  const closing = closePool();
  const secondGet = getPool();
  expect(mocks.instances).toHaveLength(firstIndex + 1);

  first.connectGate.resolve(first);
  await firstGet;
  await closing;
  expect(first.close).toHaveBeenCalledOnce();

  await vi.waitFor(() => {
    expect(mocks.instances).toHaveLength(firstIndex + 2);
  });
  const second = mocks.instances[firstIndex + 1]!;
  second.connectGate.resolve(second);
  await expect(secondGet).resolves.toBe(second);
  await closePool();
  expect(second.close).toHaveBeenCalledOnce();
}

describe("SQL pool lifecycle", () => {
  it("does not orphan OLTP pools during connect/close races", async () => {
    await expectSerializedReconnect(connection.getPool, connection.closePool);
  });

  it("does not orphan DWH pools during connect/close races", async () => {
    await expectSerializedReconnect(
      dwhConnection.getDwhPool,
      dwhConnection.closeDwhPool,
    );
  });
});

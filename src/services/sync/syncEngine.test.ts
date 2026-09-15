import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncEngine, type SyncEngineDeps } from "./syncEngine.js";
import { SyncQueueRepository, MAX_AUTO_RETRIES } from "./syncQueueRepository.js";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
void useAuthStore;
void useSyncStore;
import { HttpError, NetworkError } from "../api/httpClient.js";
import { API_VERSION, SYNC_SCHEMA_VERSION, type SyncPullCursors, type SyncPushBatch, type SyncPushResultItem } from "@nutriclinica/shared";
import { setSyncApplying } from "./syncEnqueuer.js";

const { mockManifest, mockPull, mockPush } = vi.hoisted(() => ({
  mockManifest: vi.fn(),
  mockPull: vi.fn(),
  mockPush: vi.fn(),
}));

const RV_A = "AAAAAAAAAAE=";
const RV_B = "AAAAAAAAAAI=";
const SERVER_TIME = "2026-06-04T00:00:01.000Z";
const SERVER_TIME_2 = "2026-06-04T00:00:02.000Z";
const cursor = (entity: string, revision: string, branch = "suc-1") =>
  `rv1:${branch}:${entity}:${revision}`;

vi.mock("./syncApiClient.js", () => ({
  syncApi: {
    manifest: mockManifest,
    pull: mockPull,
    push: mockPush,
  },
}));

const authGetState = vi.fn();
const syncGetState = vi.fn();

vi.mock("@store/authStore", () => ({
  useAuthStore: { getState: () => authGetState() },
}));
vi.mock("@store/syncStore", () => {
  const setStatus = vi.fn();
  const setLastSync = vi.fn();
  const setPendingChanges = vi.fn();
  const setLastError = vi.fn();
  const setSucursalId = vi.fn();
  return {
    useSyncStore: {
      getState: () => ({
        ...syncGetState(),
        setStatus,
        setLastSync,
        setPendingChanges,
        setLastError,
        setSucursalId,
      }),
    },
  };
});

describe("SyncEngine", () => {
  let db: NutriClinicaDB;
  let queue: SyncQueueRepository;
  let engine: SyncEngine;
  let lastPullAtBySucursal: Record<string, SyncPullCursors | null>;
  // Legacy scenario fixtures describe business results; this adapter supplies
  // the new transport receipt envelope. Adversarial envelopes have dedicated tests.
  const api = { manifest: mockManifest, pull: mockPull, push: async (batch: SyncPushBatch) => {
    const response = await mockPush(batch);
    return { ...response, results: response.results.map((result: SyncPushResultItem) => ({
      ...result, operationId: batch.operations.find((op) => op.entity === result.entity && op.id === result.id)?.operationId,
      serverRowVersion: result.serverRowVersion ?? "AAAAAAAAAAE=",
    })) };
  } };

  beforeEach(async () => {
    vi.resetAllMocks();
    db = new NutriClinicaDB(`test-engine-${Date.now()}-${Math.random()}`);
    await db.sync_queue.clear();
    queue = new SyncQueueRepository(db.sync_queue);
    lastPullAtBySucursal = { "suc-1": null };

    authGetState.mockReturnValue({ token: "tok", sucursalActivaId: "suc-1" });
    syncGetState.mockReturnValue({ sucursalId: "suc-1" });

    const deps: SyncEngineDeps = {
      db,
      queue,
      getLastPullAt: (sucursalId: string) =>
        lastPullAtBySucursal[sucursalId] ?? null,
      setLastPullAt: (sucursalId: string, cursors: SyncPullCursors) => {
        lastPullAtBySucursal[sucursalId] = cursors;
      },
      api,
      onProgress: vi.fn(),
      retrySleep: () => Promise.resolve(),
    };
    engine = new SyncEngine(deps);

    mockManifest.mockResolvedValue({
      operationContract: "durable-outbox-v1",
      apiVersion: "v1",
      apiContractVersion: API_VERSION,
      syncSchemaVersion: SYNC_SCHEMA_VERSION,
      serverTime: "2026-06-04T00:00:00.000Z",
      entities: ["pacientes"],
      maxBatchSize: 500,
      supportsDelta: true,
    });
    setSyncApplying(false);
  });

  it("no inicia sync mientras un restore local mantiene el bloqueo", async () => {
    setSyncApplying(true);
    try {
      await engine.sync();
      expect(mockManifest).not.toHaveBeenCalled();
    } finally {
      setSyncApplying(false);
    }
  });

  it("no-op si no hay token", async () => {
    authGetState.mockReturnValue({ token: null, sucursalActivaId: "suc-1" });
    await expect(engine.sync()).rejects.toThrow();
    expect(mockManifest).not.toHaveBeenCalled();
  });

  it("lanza si schema version no coincide", async () => {
    mockManifest.mockResolvedValueOnce({
      apiVersion: "v1",
      apiContractVersion: API_VERSION,
      syncSchemaVersion: 999,
      serverTime: "2026-06-04T00:00:00.000Z",
      entities: [],
      maxBatchSize: 500,
      supportsDelta: true,
    });
    await expect(engine.sync()).rejects.toThrow(/Schema mismatch/);
  });

  it("lanza si el contrato de API no coincide (fail-closed)", async () => {
    mockManifest.mockResolvedValueOnce({
      apiVersion: "v1",
      apiContractVersion: "v2",
      syncSchemaVersion: SYNC_SCHEMA_VERSION,
      serverTime: "2026-06-04T00:00:00.000Z",
      entities: [],
      maxBatchSize: 500,
      supportsDelta: true,
    });
    await expect(engine.sync()).rejects.toThrow(/API contract mismatch/);
    expect(mockPull).not.toHaveBeenCalled();
  });

  it("pull: aplica cambios al Dexie local y persiste cursor por entidad", async () => {
    mockPull.mockResolvedValueOnce({
      serverTime: "2026-06-04T00:00:01.000Z",
      changes: [
        {
          entity: "pacientes",
          id: "p1",
          op: "update",
          payload: { id: "p1", first_name: "Ana" },
          serverUpdatedAt: "2026-06-04T00:00:01.000Z",
          serverRowVersion: RV_A,
        },
      ],
      hasMore: false,
      cursors: { pacientes: cursor("pacientes", "0000000000000001") },
    });
    mockPush.mockResolvedValueOnce({
      results: [],
      serverTime: "2026-06-04T00:00:02.000Z",
    });
    await engine.sync();
    const stored = await db.patients.get("p1");
    expect(stored).toBeTruthy();
    expect((stored as { first_name: string }).first_name).toBe("Ana");
    expect((stored as { sucursal_id: string | null }).sucursal_id).toBe(
      "suc-1",
    );
    expect(
      (stored as unknown as { row_version: string | null }).row_version,
    ).toBe(RV_A);
    expect(lastPullAtBySucursal["suc-1"]).toEqual({
      pacientes: cursor("pacientes", "0000000000000001"),
    });
  });

  it("guarda lastPullAt por sucursal activa", async () => {
    lastPullAtBySucursal = {
      "suc-1": { pacientes: "2026-06-01T00:00:00.000Z@p-old" },
      "suc-2": null,
    };
    syncGetState.mockReturnValue({ sucursalId: "suc-2" });
    authGetState.mockReturnValue({ token: "tok", sucursalActivaId: "suc-2" });
    mockPull.mockResolvedValueOnce({
      serverTime: "2026-06-04T00:00:01.000Z",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockResolvedValueOnce({
      results: [],
      serverTime: "2026-06-04T00:00:02.000Z",
    });

    await engine.sync();

    expect(mockPull).toHaveBeenCalledWith({ since: null, sucursalId: "suc-2" });
    expect(lastPullAtBySucursal["suc-1"]).toEqual({
      pacientes: "2026-06-01T00:00:00.000Z@p-old",
    });
    expect(lastPullAtBySucursal["suc-2"]).toEqual({});
  });

  it("pull paginado: mergea cursors por entidad y no pierde filas truncadas", async () => {
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [
        {
          entity: "pacientes",
          id: "p9",
          op: "update",
          payload: { id: "p9", first_name: "Página 1" },
          serverUpdatedAt: SERVER_TIME,
          serverRowVersion: RV_A,
        },
      ],
      hasMore: true,
      cursors: { pacientes: cursor("pacientes", "0000000000000001") },
    });
    mockPull.mockResolvedValueOnce({
      serverTime: "t2",
      changes: [
        {
          entity: "consultas",
          id: "c1",
          op: "update",
          payload: { id: "c1", reason: "segunda página" },
          serverUpdatedAt: SERVER_TIME_2,
          serverRowVersion: RV_B,
        },
      ],
      hasMore: false,
      cursors: { consultas: cursor("consultas", "0000000000000002") },
    });
    mockPush.mockResolvedValueOnce({
      results: [],
      serverTime: "t3",
    });

    await engine.sync();

    expect(mockPull).toHaveBeenNthCalledWith(1, {
      since: null,
      sucursalId: "suc-1",
    });
    expect(mockPull).toHaveBeenNthCalledWith(2, {
      since: { pacientes: cursor("pacientes", "0000000000000001") },
      sucursalId: "suc-1",
    });
    expect(lastPullAtBySucursal["suc-1"]).toEqual({
      pacientes: cursor("pacientes", "0000000000000001"),
      consultas: cursor("consultas", "0000000000000002"),
    });
    const c = await db.consultations.get("c1");
    expect(c).toBeTruthy();
  });

  it("pull: aplica los cambios de un lote en una sola transacción Dexie", async () => {
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [
        {
          entity: "pacientes",
          id: "p1",
          op: "update",
          payload: { id: "p1", first_name: "Ana" },
          serverUpdatedAt: SERVER_TIME,
          serverRowVersion: RV_A,
        },
        {
          entity: "pacientes",
          id: "p2",
          op: "update",
          payload: { id: "p2", first_name: "Beto" },
          serverUpdatedAt: SERVER_TIME,
          serverRowVersion: RV_B,
        },
      ],
      hasMore: false,
      cursors: { pacientes: cursor("pacientes", "0000000000000002") },
    });
    mockPush.mockResolvedValueOnce({ results: [], serverTime: "t2" });

    const txSpy = vi.spyOn(db, "transaction");
    await engine.sync();

    expect(txSpy).toHaveBeenCalledTimes(2); // atomic pull plus atomic outbox claim
    expect(await db.patients.get("p1")).toBeTruthy();
    expect(await db.patients.get("p2")).toBeTruthy();
  });

  it("mantiene la sucursal capturada aunque el store cambie durante el ciclo", async () => {
    await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "branch-a",
      op: "create",
      payload: { id: "branch-a" },
    });
    await queue.enqueue({
      sucursalId: "suc-2",
      entity: "pacientes",
      entityId: "branch-b",
      op: "create",
      payload: { id: "branch-b" },
    });
    mockManifest.mockImplementationOnce(async () => {
      syncGetState.mockReturnValue({ sucursalId: "suc-2" });
      authGetState.mockReturnValue({ token: "tok", sucursalActivaId: "suc-2" });
      return {
        operationContract: "durable-outbox-v1",
        apiVersion: "v1",
        apiContractVersion: API_VERSION,
        syncSchemaVersion: SYNC_SCHEMA_VERSION,
        serverTime: "t",
        entities: ["pacientes"],
        maxBatchSize: 500,
        supportsDelta: true,
      };
    });
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockResolvedValueOnce({
      results: [{ entity: "pacientes", id: "branch-a", status: "applied" }],
      serverTime: "t2",
    });

    await engine.sync();

    expect(mockPull).toHaveBeenCalledWith({ since: null, sucursalId: "suc-1" });
    expect(mockPush).toHaveBeenCalledWith({
      sucursalId: "suc-1",
      operations: [expect.objectContaining({ id: "branch-a" })],
    });
    expect(
      (await queue.listPending("suc-2")).map((item) => item.entityId),
    ).toEqual(["branch-b"]);
  });

  it("pull: op=delete hace soft-delete local (preserva la fila con deleted_at)", async () => {
    await db.patients.put({
      id: "p1",
      sucursal_id: "suc-1",
      first_name: "X",
    } as unknown as Parameters<typeof db.patients.put>[0]);
    mockPull.mockResolvedValueOnce({
      serverTime: "2026-06-04T00:00:01.000Z",
      changes: [
        {
          entity: "pacientes",
          id: "p1",
          op: "delete",
          payload: null,
          serverUpdatedAt: "2026-06-04T00:00:01.000Z",
          serverRowVersion: RV_A,
        },
      ],
      hasMore: false,
      cursors: { pacientes: cursor("pacientes", "0000000000000001") },
    });
    mockPush.mockResolvedValueOnce({
      results: [],
      serverTime: "2026-06-04T00:00:02.000Z",
    });
    await engine.sync();
    const stored = await db.patients.get("p1");
    expect(stored).toBeTruthy();
    expect((stored as { deleted_at: string | null }).deleted_at).toBeTruthy();
  });

  it("pull: op=delete sobre fila inexistente es idempotente (no falla)", async () => {
    mockPull.mockResolvedValueOnce({
      serverTime: "2026-06-04T00:00:01.000Z",
      changes: [
        {
          entity: "pacientes",
          id: "p-doesnt-exist",
          op: "delete",
          payload: null,
          serverUpdatedAt: "2026-06-04T00:00:01.000Z",
          serverRowVersion: RV_A,
        },
      ],
      hasMore: false,
      cursors: { pacientes: cursor("pacientes", "0000000000000001") },
    });
    mockPush.mockResolvedValueOnce({
      results: [],
      serverTime: "2026-06-04T00:00:02.000Z",
    });
    await expect(engine.sync()).resolves.toBeUndefined();
  });

  it("pull parcial: fusiona billing sin borrar datos clínicos y no fabrica filas incompletas", async () => {
    authGetState.mockReturnValue({
      token: "tok",
      sucursalActivaId: "suc-1",
      user: { rol: "facturacion" },
    });
    await db.consultations.put({
      id: "c-existing",
      sucursal_id: "suc-1",
      patient_id: "p1",
      reason: "Motivo clínico",
      subjective: "Dato sensible",
      paid: false,
      payment_status: "pending",
      deleted_at: null,
    } as never);
    mockPull.mockResolvedValueOnce({
      serverTime: SERVER_TIME,
      changes: [
        {
          entity: "consultas",
          id: "c-existing",
          op: "update",
          partial: true,
          payload: { id: "c-existing", paid: true, payment_status: "paid" },
          serverUpdatedAt: SERVER_TIME,
          serverRowVersion: RV_A,
        },
        {
          entity: "consultas",
          id: "c-unknown",
          op: "update",
          partial: true,
          payload: { id: "c-unknown", paid: true, payment_status: "paid" },
          serverUpdatedAt: SERVER_TIME,
          serverRowVersion: RV_A,
        },
      ],
      hasMore: false,
      cursors: { consultas: cursor("consultas", "0000000000000001") },
    });
    mockPush.mockResolvedValueOnce({ results: [], serverTime: SERVER_TIME_2 });

    await engine.sync();

    expect(await db.consultations.get("c-existing")).toMatchObject({
      reason: "Motivo clínico",
      subjective: "Dato sensible",
      paid: true,
      payment_status: "paid",
      row_version: RV_A,
    });
    expect(await db.consultations.get("c-unknown")).toBeUndefined();
    expect(lastPullAtBySucursal["suc-1:billing"]).toEqual({
      consultas: cursor("consultas", "0000000000000001"),
    });
    expect(lastPullAtBySucursal["suc-1"]).toBeNull();
  });

  it("pull fail-closed: no persiste cambios con ROWVERSION o identidad de sucursal inválidos", async () => {
    mockPull.mockResolvedValueOnce({
      serverTime: SERVER_TIME,
      changes: [{
        entity: "pacientes",
        id: "p-invalid",
        op: "update",
        payload: { id: "p-invalid", sucursal_id: "suc-2", first_name: "Cross branch" },
        serverUpdatedAt: SERVER_TIME,
        serverRowVersion: "not-a-row-version",
      }],
      hasMore: false,
      cursors: { pacientes: cursor("pacientes", "0000000000000001") },
    });

    await expect(engine.sync()).rejects.toThrow("INVALID_SYNC_PULL_CHANGE");
    expect(await db.patients.get("p-invalid")).toBeUndefined();
    expect(lastPullAtBySucursal["suc-1"]).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("pull fail-closed: rechaza cursores de otra sucursal sin avanzar estado local", async () => {
    mockPull.mockResolvedValueOnce({
      serverTime: SERVER_TIME,
      changes: [],
      hasMore: false,
      cursors: { pacientes: cursor("pacientes", "0000000000000001", "suc-2") },
    });

    await expect(engine.sync()).rejects.toThrow("INVALID_SYNC_PULL_CURSOR");
    expect(lastPullAtBySucursal["suc-1"]).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("push: items pending se envían y marcan applied", async () => {
    await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p1",
      op: "create",
      payload: { id: "p1", first_name: "Ana" },
    });
    await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p2",
      op: "update",
      payload: { id: "p2", first_name: "Beto" },
    });
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockResolvedValueOnce({
      results: [
        { entity: "pacientes", id: "p1", status: "applied" },
        { entity: "pacientes", id: "p2", status: "applied" },
      ],
      serverTime: "t2",
    });
    await engine.sync();
    const remaining = await queue.listAll();
    expect(remaining.filter((i) => i.status === "applied")).toHaveLength(0);
  });

  it("push: incluye expectedRowVersion y el conflict guarda serverRowVersion del server", async () => {
    await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p1",
      op: "update",
      payload: { id: "p1", first_name: "Ana" },
      expectedRowVersion: RV_A,
    });
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockResolvedValueOnce({
      results: [
        {
          entity: "pacientes",
          id: "p1",
          status: "conflict",
          error: "row_version mismatch",
          serverRowVersion: RV_B,
        },
      ],
      serverTime: "t2",
    });

    await engine.sync();

    expect(mockPush).toHaveBeenCalledWith({
      sucursalId: "suc-1",
      operations: [expect.objectContaining({ expectedRowVersion: RV_A })],
    });
    const item = (await queue.listAll()).find((i) => i.entityId === "p1");
    expect(item?.status).toBe("conflict");
    // Al resolver "mantener local", el re-push llevará la versión fresca del server.
    expect(item?.expectedRowVersion).toBe(RV_A);
    expect(item?.serverRowVersion).toBe(RV_B);
  });

  it("push: items syncing atascados (>5 min) vuelven a pending y se reintentan", async () => {
    const item = await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p1",
      op: "create",
      payload: { id: "p1", first_name: "Ana" },
    });
    await queue.markSyncing(item.id);
    await db.sync_queue.update(item.id, {
      updatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    });
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockResolvedValueOnce({
      results: [{ entity: "pacientes", id: "p1", status: "applied" }],
      serverTime: "t2",
    });

    await engine.sync();

    expect(mockPush).toHaveBeenCalledTimes(1);
    // Los applied se limpian al final del push: la cola queda vacía.
    expect(await queue.listAll()).toHaveLength(0);
  });

  it("push: items en error que agotaron reintentos automáticos no se re-empujan", async () => {
    const item = await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p1",
      op: "create",
      payload: { id: "p1" },
    });
    for (let i = 0; i < MAX_AUTO_RETRIES; i++) {
      await queue.markError(item.id, "boom");
    }
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockResolvedValueOnce({ results: [], serverTime: "t2" });

    await engine.sync();

    expect(mockPush).not.toHaveBeenCalled();
    const final = await db.sync_queue.get(item.id);
    expect(final?.status).toBe("error");
  });

  it("push: conflict se preserva para resolución manual", async () => {
    await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p1",
      op: "update",
      payload: {},
    });
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockResolvedValueOnce({
      results: [
        {
          entity: "pacientes",
          id: "p1",
          status: "conflict",
          error: "row_version mismatch",
        },
      ],
      serverTime: "t2",
    });
    try {
      await engine.sync();
    } catch {
      // expected — conflict is preserved
    }
    const conflicts = await queue.countConflicts("suc-1");
    expect(conflicts).toBe(1);
  });

  it("push: error transitorio (NetworkError) reintenta", async () => {
    await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p1",
      op: "create",
      payload: {},
    });
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockRejectedValueOnce(new NetworkError("boom"));
    mockPush.mockResolvedValueOnce({
      results: [{ entity: "pacientes", id: "p1", status: "applied" }],
      serverTime: "t2",
    });
    await engine.sync();
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush.mock.calls[0]![0].operations[0]!.operationId)
      .toBe(mockPush.mock.calls[1]![0].operations[0]!.operationId);
  });

  it("push: 5xx reintenta, 4xx no", async () => {
    await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p1",
      op: "create",
      payload: {},
    });
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockRejectedValueOnce(new HttpError(500, "server error"));
    mockPush.mockResolvedValueOnce({
      results: [{ entity: "pacientes", id: "p1", status: "applied" }],
      serverTime: "t2",
    });
    await engine.sync();
    expect(mockPush).toHaveBeenCalledTimes(2);
    vi.clearAllMocks();
    await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p2",
      op: "create",
      payload: {},
    });
    mockManifest.mockResolvedValue({
      apiVersion: "v1",
      operationContract: "durable-outbox-v1",
      apiContractVersion: API_VERSION,
      syncSchemaVersion: SYNC_SCHEMA_VERSION,
      serverTime: "t",
      entities: ["pacientes"],
      maxBatchSize: 500,
      supportsDelta: true,
    });
    mockPull.mockResolvedValue({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockRejectedValue(new HttpError(400, "bad"));
    await expect(engine.sync()).rejects.toThrow();
    const rejected = (await queue.listAll()).find(
      (item) => item.entityId === "p2",
    );
    expect(rejected?.status).toBe("error");
    expect(rejected?.lastError).toBe("bad");
  });

  it("no se ejecuta concurrentemente (re-entrante devuelve la misma inFlight)", async () => {
    let resolvePull: (v: unknown) => void = () => undefined;
    mockPull.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePull = resolve;
      }),
    );
    const p1 = engine.sync();
    const p2 = engine.sync();
    // p2 debe ser la misma ejecución que p1.
    resolvePull({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    await Promise.all([p1, p2]);
    expect(mockManifest).toHaveBeenCalledTimes(1);
    expect(mockPull).toHaveBeenCalledTimes(1);
  });

  it("no se ejecuta concurrentemente: con items pending ambos completan", async () => {
    await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p1",
      op: "create",
      payload: {},
    });
    mockPull.mockResolvedValueOnce({
      serverTime: "t",
      changes: [],
      hasMore: false,
      cursors: {},
    });
    mockPush.mockResolvedValueOnce({
      results: [{ entity: "pacientes", id: "p1", status: "applied" }],
      serverTime: "t2",
    });
    const p1 = engine.sync();
    const p2 = engine.sync();
    await Promise.all([p1, p2]);
    expect(mockManifest).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  describe("toLocalRow — JSON columns del pull se guardan como strings en Dexie", () => {
    it("consultas: vitals={object} se almacena como vitals_json: string", async () => {
      await db.patients.put({
        id: "pid-1",
        first_name: "Test",
        last_name: "Pac",
        clinical_tags: "[]",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      } as unknown as Parameters<typeof db.patients.put>[0]);
      mockPull.mockResolvedValueOnce({
        serverTime: "t1",
        changes: [
          {
            entity: "consultas",
            id: "c1",
            op: "update",
            payload: {
              id: "c1",
              patient_id: "pid-1",
              consultation_date: "2026-06-07T00:00:00.000Z",
              consultation_number: 1,
              reason: "test",
              subjective: null,
              objective: null,
              assessment: null,
              plan: null,
              status: "completed",
              anthropometry_id: null,
              lab_panel_id: null,
              next_visit_date: null,
              cost: 0,
              paid: false,
              payment_method: null,
              paid_at: null,
              reference: null,
              invoice_number: null,
              billing_notes: null,
              vitals: {
                systolicMmHg: 120,
                diastolicMmHg: 80,
                heartRateBpm: 72,
                temperatureC: 36.5,
              },
              deleted_at: null,
              created_at: "t0",
              updated_at: "t0",
            },
            serverUpdatedAt: SERVER_TIME,
            serverRowVersion: RV_A,
          },
        ],
        hasMore: false,
        cursors: { consultas: cursor("consultas", "0000000000000001") },
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: "t2" });
      await engine.sync();
      const row = await db.consultations.get("c1");
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(r.vitals_json).toBeTypeOf("string");
      expect(r.vitals).toBeUndefined();
      const parsed = JSON.parse(r.vitals_json as string);
      expect(parsed.systolicMmHg).toBe(120);
      expect(parsed.diastolicMmHg).toBe(80);
    });

    it("consultas: vitals=null se almacena como vitals_json: null", async () => {
      await db.patients.put({
        id: "pid-2",
        first_name: "Test",
        last_name: "Pac",
        clinical_tags: "[]",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      } as unknown as Parameters<typeof db.patients.put>[0]);
      mockPull.mockResolvedValueOnce({
        serverTime: "t1",
        changes: [
          {
            entity: "consultas",
            id: "c2",
            op: "update",
            payload: {
              id: "c2",
              patient_id: "pid-2",
              consultation_date: "2026-06-07T00:00:00.000Z",
              consultation_number: 2,
              reason: "test",
              subjective: null,
              objective: null,
              assessment: null,
              plan: null,
              status: "completed",
              anthropometry_id: null,
              lab_panel_id: null,
              next_visit_date: null,
              cost: 0,
              paid: false,
              payment_method: null,
              paid_at: null,
              reference: null,
              invoice_number: null,
              billing_notes: null,
              vitals: null,
              deleted_at: null,
              created_at: "t0",
              updated_at: "t0",
            },
            serverUpdatedAt: SERVER_TIME,
            serverRowVersion: RV_A,
          },
        ],
        hasMore: false,
        cursors: { consultas: cursor("consultas", "0000000000000001") },
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: "t2" });
      await engine.sync();
      const row = await db.consultations.get("c2");
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(r.vitals_json).toBeNull();
      expect(r.vitals).toBeUndefined();
    });

    it("pacientes: clinical_tags=string[] → clinical_tags: \"string[]\"", async () => {
      mockPull.mockResolvedValueOnce({
        serverTime: "t1",
        changes: [
          {
            entity: "pacientes",
            id: "p-tag",
            op: "update",
            payload: {
              id: "p-tag",
              first_name: "Tag",
              last_name: "Test",
              clinical_tags: ["embarazado", "diabético"],
              status: "active",
              deleted_at: null,
              created_at: "t0",
              updated_at: "t0",
            },
            serverUpdatedAt: SERVER_TIME,
            serverRowVersion: RV_A,
          },
        ],
        hasMore: false,
        cursors: { pacientes: cursor("pacientes", "0000000000000001") },
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: "t2" });
      await engine.sync();
      const row = await db.patients.get("p-tag");
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(r.clinical_tags).toBeTypeOf("string");
      const parsed = JSON.parse(r.clinical_tags as string);
      expect(parsed).toEqual(["embarazado", "diabético"]);
    });

    it('pacientes: clinical_tags=[] (vacío) → clinical_tags: "[]"', async () => {
      mockPull.mockResolvedValueOnce({
        serverTime: "t1",
        changes: [
          {
            entity: "pacientes",
            id: "p-empty",
            op: "update",
            payload: {
              id: "p-empty",
              first_name: "Empty",
              last_name: "Tags",
              clinical_tags: [],
              status: "active",
              deleted_at: null,
              created_at: "t0",
              updated_at: "t0",
            },
            serverUpdatedAt: SERVER_TIME,
            serverRowVersion: RV_A,
          },
        ],
        hasMore: false,
        cursors: { pacientes: cursor("pacientes", "0000000000000001") },
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: "t2" });
      await engine.sync();
      const row = await db.patients.get("p-empty");
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(r.clinical_tags).toBe("[]");
    });

    it("pacientes: normaliza el estado y conserva campos locales que el servidor no almacena", async () => {
      await db.patients.put({
        id: "p-preserved",
        first_name: "Nombre local",
        last_name: "Paciente",
        birth_place: "Oaxaca",
        address: "Domicilio local",
        clinical_tags: "[]",
        record_status: "active",
        status: "active",
        created_at: "t0",
        updated_at: "t0",
        deleted_at: null,
      } as unknown as Parameters<typeof db.patients.put>[0]);
      mockPull.mockResolvedValueOnce({
        serverTime: "t1",
        changes: [
          {
            entity: "pacientes",
            id: "p-preserved",
            op: "update",
            payload: {
              id: "p-preserved",
              first_name: "Nombre remoto",
              last_name: "Paciente",
              record_status: "closed",
              record_closed_reason: "Alta clínica",
              clinical_tags: [],
              status: "inactive",
              deleted_at: null,
              created_at: "t0",
              updated_at: "t1",
            },
            serverUpdatedAt: SERVER_TIME,
            serverRowVersion: RV_A,
          },
        ],
        hasMore: false,
        cursors: { pacientes: cursor("pacientes", "0000000000000001") },
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: "t2" });

      await engine.sync();

      const row = await db.patients.get("p-preserved");
      expect(row).toMatchObject({
        first_name: "Nombre remoto",
        record_status: "inactive",
        discharge_reason: "Alta clínica",
        birth_place: "Oaxaca",
        address: "Domicilio local",
      });
      expect(
        (row as unknown as Record<string, unknown>).record_closed_reason,
      ).toBeUndefined();
    });

    it("planes_alimenticios: meals=[{slot,...}] → meals_json: string", async () => {
      await db.patients.put({
        id: "pid-3",
        first_name: "Meal",
        last_name: "Plan",
        clinical_tags: "[]",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      } as unknown as Parameters<typeof db.patients.put>[0]);
      mockPull.mockResolvedValueOnce({
        serverTime: "t1",
        changes: [
          {
            entity: "planes_alimenticios",
            id: "mp1",
            op: "update",
            payload: {
              id: "mp1",
              patient_id: "pid-3",
              start_date: "2026-06-07T00:00:00.000Z",
              end_date: null,
              status: "active",
              total_daily_calories: 2000,
              meals: [
                {
                  slot: "desayuno",
                  exchanges: [
                    {
                      foodId: "a1b2c3d4-0000-0000-0000-000000000001",
                      count: 2,
                    },
                  ],
                },
              ],
              deleted_at: null,
              created_at: "t0",
              updated_at: "t0",
            },
            serverUpdatedAt: SERVER_TIME,
            serverRowVersion: RV_A,
          },
        ],
        hasMore: false,
        cursors: { planes_alimenticios: cursor("planes_alimenticios", "0000000000000001") },
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: "t2" });
      await engine.sync();
      const row = await db.meal_plans.get("mp1");
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(r.meals_json).toBeTypeOf("string");
      expect(r.meals).toBeUndefined();
      const parsed = JSON.parse(r.meals_json as string);
      expect(parsed[0].slot).toBe("desayuno");
      expect(parsed[0].exchanges[0].foodId).toBe(
        "a1b2c3d4-0000-0000-0000-000000000001",
      );
    });

    it("lab_panels: results como array se almacena tal cual (el mapper ya lo lee como array)", async () => {
      await db.patients.put({
        id: "pid-4",
        first_name: "Lab",
        last_name: "Panel",
        clinical_tags: "[]",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      } as unknown as Parameters<typeof db.patients.put>[0]);
      mockPull.mockResolvedValueOnce({
        serverTime: "t1",
        changes: [
          {
            entity: "lab_panels",
            id: "lp1",
            op: "update",
            payload: {
              id: "lp1",
              patient_id: "pid-4",
              taken_at: "2026-06-07T00:00:00.000Z",
              lab_name: null,
              notes: null,
              results: [
                {
                  labPanelId: "lp1",
                  test: "GLUCOSA",
                  value: 95,
                  unit: "mg/dL",
                },
              ],
              deleted_at: null,
              created_at: "t0",
              updated_at: "t0",
            },
            serverUpdatedAt: SERVER_TIME,
            serverRowVersion: RV_A,
          },
        ],
        hasMore: false,
        cursors: { lab_panels: cursor("lab_panels", "0000000000000001") },
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: "t2" });
      await engine.sync();
      const row = await db.lab_panels.get("lp1");
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(Array.isArray(r.results)).toBe(true);
      expect((r.results as Array<{ test: string }>)[0].test).toBe("GLUCOSA");
    });
  });
});

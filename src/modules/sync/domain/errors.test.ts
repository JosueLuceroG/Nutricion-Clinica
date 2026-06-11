import { describe, it, expect } from "vitest";
import { SyncConflictError, SyncAuthError, SyncSchemaMismatchError } from "./errors";

describe("SyncConflictError", () => {
  it("tiene el nombre correcto y propiedades", () => {
    const error = new SyncConflictError("Patient", "p-123", "v2", "2024-06-01T00:00:00Z");

    expect(error.name).toBe("SyncConflictError");
    expect(error.entity).toBe("Patient");
    expect(error.entityId).toBe("p-123");
    expect(error.serverRowVersion).toBe("v2");
    expect(error.serverUpdatedAt).toBe("2024-06-01T00:00:00Z");
    expect(error.message).toBe("Sync conflict on Patient:p-123");
  });
});

describe("SyncAuthError", () => {
  it("tiene el nombre correcto y mensaje por defecto", () => {
    const error = new SyncAuthError();

    expect(error.name).toBe("SyncAuthError");
    expect(error.message).toBe("No autenticado para sincronizar");
  });

  it("se puede construir con mensaje personalizado", () => {
    const error = new SyncAuthError("Token expirado");

    expect(error.name).toBe("SyncAuthError");
    expect(error.message).toBe("Token expirado");
  });
});

describe("SyncSchemaMismatchError", () => {
  it("tiene el nombre correcto y almacena versiones", () => {
    const error = new SyncSchemaMismatchError(5, 3);

    expect(error.name).toBe("SyncSchemaMismatchError");
    expect(error.serverVersion).toBe(5);
    expect(error.clientVersion).toBe(3);
    expect(error.message).toBe("Schema mismatch: server=5 client=3");
  });
});

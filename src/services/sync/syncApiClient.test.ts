import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncApi } from "./syncApiClient.js";

const httpRequestMock = vi.hoisted(() => vi.fn());

vi.mock("../api/httpClient.js", () => ({ httpRequest: httpRequestMock }));

describe("syncApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    httpRequestMock.mockResolvedValue({});
  });

  it("fija la sucursal del pull en el header explícito", async () => {
    await syncApi.pull({ since: null, sucursalId: "suc-captured" });

    expect(httpRequestMock).toHaveBeenCalledWith("/sync/pull", {
      query: { since: undefined, entities: undefined },
      headers: { "X-Sucursal-Id": "suc-captured" },
      skipSucursalHeader: true,
    });
  });

  it("fija la sucursal del batch push en el header explícito", async () => {
    const batch = { sucursalId: "suc-captured", operations: [] };
    await syncApi.push(batch);

    expect(httpRequestMock).toHaveBeenCalledWith("/sync/push", {
      method: "POST",
      body: batch,
      headers: { "X-Sucursal-Id": "suc-captured" },
      skipSucursalHeader: true,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dwhQueries: [] as string[],
  requestInputs: [] as Array<Record<string, unknown>>,
  telemetry: vi.fn(),
}));

function fakeRequest() {
  const inputs: Record<string, unknown> = {};
  return {
    input(name: string, _type: unknown, value: unknown) {
      inputs[name] = value;
      return this;
    },
    async query<T>(query: string): Promise<{ recordset: T[] }> {
      mocks.dwhQueries.push(query);
      mocks.requestInputs.push(inputs);
      if (query.includes("SELECT watermark_at")) {
        return { recordset: [] };
      }
      if (query.includes("OUTPUT INSERTED.load_run_id")) {
        return { recordset: [{ load_run_id: "42" } as T] };
      }
      return { recordset: [] };
    },
  };
}

const fakeDwh = { request: fakeRequest };
const fakeOltp = {};

function fakeTransactionalDwh(batches: string[], failAt = -1) {
  const lifecycle: string[] = [];
  let call = 0;
  return {
    lifecycle,
    dwh: {
      transaction() {
        return {
          async begin() {
            lifecycle.push("begin");
          },
          request() {
            return {
              async batch(query: string) {
                call += 1;
                batches.push(query);
                if (call === failAt) throw new Error("batch failed");
                return {
                  recordset: query.includes("MERGE")
                    ? [{ act: "INSERT" }, { act: "INSERT" }]
                    : [],
                };
              },
            };
          },
          async commit() {
            lifecycle.push("commit");
          },
          async rollback() {
            lifecycle.push("rollback");
          },
        };
      },
    },
  };
}

vi.mock("../../../db/connection.js", () => ({
  getPool: () => Promise.resolve(fakeOltp),
}));
vi.mock("../dwhConnection.js", () => ({
  getDwhPool: () => Promise.resolve(fakeDwh),
}));
vi.mock("../../observability/telemetryService.js", () => ({
  emitTelemetry: mocks.telemetry,
}));

import {
  dateKeyFromDate,
  dimProfessionalPipeline,
  dimSucursalPipeline,
  factLabPipeline,
  runPipeline,
  type EtlContext,
} from "./engine.js";
import { startOfUtcWeek, toUtcDateKey } from "./dimDate.js";

describe("DWH ETL invariants", () => {
  beforeEach(() => {
    mocks.dwhQueries.length = 0;
    mocks.requestInputs.length = 0;
    mocks.telemetry.mockClear();
  });

  it("fails the run and does not advance the watermark on unexpected loss", async () => {
    const result = await runPipeline({
      pipelineId: "test_pipeline",
      async extract() {
        return {
          rows: [{ updatedAt: new Date("2026-01-02T00:00:00.000Z") }],
          expected: 2,
          rejects: [],
        };
      },
      async load() {
        return { inserted: 1, updated: 0 };
      },
      filtered() {
        return 0;
      },
    });

    expect(result.status).toBe("failed");
    expect(result.reconciliation.unexpectedLoss).toBe(1);
    expect(result.error).toContain("DWH_RECONCILIATION_FAILED");
    expect(
      mocks.dwhQueries.some((query) =>
        query.includes("UPDATE dwh_watermarks SET watermark_at"),
      ),
    ).toBe(false);
    expect(
      mocks.requestInputs.some((inputs) => inputs.status === "failed"),
    ).toBe(true);
  });

  it("fails reconciliation on unexpected overcount", async () => {
    const result = await runPipeline({
      pipelineId: "test_pipeline",
      async extract() {
        return {
          rows: [{ updatedAt: new Date("2026-01-02T00:00:00.000Z") }],
          expected: 1,
          rejects: [],
        };
      },
      async load() {
        return { inserted: 1, updated: 1 };
      },
      filtered() {
        return 0;
      },
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("expected 1 source rows, accounted 2");
    expect(
      mocks.dwhQueries.some((query) =>
        query.includes("UPDATE dwh_watermarks SET watermark_at"),
      ),
    ).toBe(false);
  });

  it("advances the watermark from rejected source rows", async () => {
    const updatedAt = new Date("2026-01-04T00:00:00.000Z");
    const result = await runPipeline({
      pipelineId: "test_pipeline",
      async extract() {
        return {
          rows: [],
          expected: 1,
          rejects: [
            {
              entity: "test",
              sourceReference: "source-1",
              reasonCode: "invalid",
            },
          ],
          maxSourceUpdatedAt: updatedAt,
        };
      },
      async load() {
        return { inserted: 0, updated: 0 };
      },
      filtered() {
        return 0;
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.sourceWatermark).toEqual(updatedAt);
    expect(
      mocks.requestInputs.some(
        (inputs) =>
          inputs.pipelineId === "test_pipeline" &&
          inputs.watermark === updatedAt,
      ),
    ).toBe(true);
  });

  it("extracts soft-deleted dimensions as inactive with an inclusive watermark", async () => {
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");
    const queries: string[] = [];
    const contextFor = (recordset: Array<Record<string, unknown>>) =>
      ({
        watermark: updatedAt,
        oltp: {
          request() {
            return {
              input() {
                return this;
              },
              async query(query: string) {
                queries.push(query);
                return { recordset };
              },
            };
          },
        },
      }) as unknown as EtlContext;

    const branch = await dimSucursalPipeline.extract(
      contextFor([
        {
          id: Buffer.alloc(16, 1),
          nombre: "Sucursal cerrada",
          activa: true,
          deleted_at: updatedAt,
          updated_at: updatedAt,
          row_version: Buffer.alloc(8, 1),
        },
      ]),
    );
    const professional = await dimProfessionalPipeline.extract(
      contextFor([
        {
          id: Buffer.alloc(16, 2),
          nombre_completo: "Profesional eliminado",
          cedula_profesional: "ABC",
          rol: "nutriologa",
          activo: true,
          deleted_at: updatedAt,
          updated_at: updatedAt,
          row_version: Buffer.alloc(8, 2),
        },
      ]),
    );

    expect(branch.rows[0]?.activa).toBe(false);
    expect(branch.rows[0]?.sourceVersion).toEqual(Buffer.alloc(8, 1));
    expect(professional.rows[0]?.activo).toBe(false);
    expect(professional.rows[0]?.sourceVersion).toEqual(Buffer.alloc(8, 2));
    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(query).toContain("updated_at >= @watermark");
      expect(query).not.toContain("deleted_at IS NULL");
    }
  });

  it("versions professional license changes atomically", async () => {
    const id = Buffer.alloc(16, 3);
    const sourceUpdatedAt = new Date("2026-01-02T13:00:00.000Z");
    const sourceVersion = Buffer.alloc(8, 2);
    const queries: string[] = [];
    const inputs: Array<Record<string, unknown>> = [];
    const context = {
      dwh: {
        request() {
          const requestInputs: Record<string, unknown> = {};
          return {
            input(name: string, _type: unknown, value: unknown) {
              requestInputs[name] = value;
              return this;
            },
            async query(query: string) {
              queries.push(query);
              inputs.push(requestInputs);
              if (query.includes("SELECT professional_natural_id")) {
                return {
                  recordset: [
                    { professional_natural_id: id, professional_key: 7 },
                  ],
                };
              }
              if (query.includes("SELECT nombre_completo")) {
                return {
                  recordset: [
                    {
                      nombre_completo: "Profesional",
                      cedula_profesional: "OLD",
                      rol: "nutriologa",
                      activo: true,
                      valid_from: new Date("2026-01-02T09:00:00.000Z"),
                      source_updated_at: new Date(
                        "2026-01-02T09:00:00.000Z",
                      ),
                      source_version: Buffer.alloc(8, 1),
                    },
                  ],
                };
              }
              return { recordset: [] };
            },
          };
        },
      },
    } as unknown as EtlContext;

    const result = await dimProfessionalPipeline.load(context, [
      {
        id,
        nombre_completo: "Profesional",
        cedula_profesional: "NEW",
        rol: "nutriologa",
        activo: true,
        updatedAt: sourceUpdatedAt,
        sourceVersion,
      },
    ]);

    expect(result).toEqual({ inserted: 1, updated: 0 });
    const transition = queries.find((query) =>
      query.includes("BEGIN TRANSACTION"),
    );
    expect(transition).toContain("UPDATE dim_professional");
    expect(transition).toContain("INSERT INTO dim_professional");
    expect(transition).toContain("valid_to = @sourceUpdatedAt");
    expect(transition).toContain("@sourceUpdatedAt, NULL, 1");
    expect(inputs.some((input) => input.sourceUpdatedAt === sourceUpdatedAt)).toBe(
      true,
    );
    expect(inputs.some((input) => input.sourceVersion === sourceVersion)).toBe(
      true,
    );
  });

  it("merges lab observations by panel and per-panel index", async () => {
    const panelId = Buffer.alloc(16, 4);
    const batches: string[] = [];
    const transaction = fakeTransactionalDwh(batches);
    const context = {
      dwh: transaction.dwh,
    } as unknown as EtlContext;

    const updatedAt = new Date("2026-01-02T01:00:00.000Z");
    const result = await factLabPipeline.load(
      context,
      [
        {
          panelId,
          observationIndex: 0,
          labName: "Glucosa",
          resultValue: "90",
          resultUnit: "mg/dL",
          sucursalKey: 1,
          professionalKey: 2,
          patientKey: 3,
          takenAt: new Date("2026-01-02T00:00:00.000Z"),
          deletedAt: null,
          updatedAt,
        },
        {
          panelId,
          observationIndex: 1,
          labName: "Insulina",
          resultValue: "8",
          resultUnit: "uIU/mL",
          sucursalKey: 1,
          professionalKey: 2,
          patientKey: 3,
          takenAt: new Date("2026-01-02T00:00:00.000Z"),
          deletedAt: null,
          updatedAt,
        },
      ],
      { panels: [{ panelId, updatedAt }] },
    );

    expect(result).toEqual({ inserted: 2, updated: 0 });
    expect(batches).toHaveLength(2);
    expect(batches[1]).toContain(
      "ON t.source_lab_panel_id = s.source_lab_panel_id AND t.observation_index = s.observation_index",
    );
    expect(batches[1]).not.toContain("UPDATE SET t.observation_index");
    expect(batches[0]).toContain("UPDATE target");
    expect(batches[0]).toContain(
      "target.source_lab_panel_id = incoming.source_lab_panel_id",
    );
    expect(transaction.lifecycle).toEqual(["begin", "commit"]);
  });

  it("marks prior lab observations deleted when a panel becomes empty", async () => {
    const panelId = Buffer.alloc(16, 10);
    const batches: string[] = [];
    const transaction = fakeTransactionalDwh(batches);
    const context = {
      dwh: transaction.dwh,
    } as unknown as EtlContext;

    const result = await factLabPipeline.load(context, [], {
      panels: [
        {
          panelId,
          updatedAt: new Date("2026-01-03T01:00:00.000Z"),
        },
      ],
    });

    expect(result).toEqual({ inserted: 0, updated: 0 });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toContain(
      "target.source_lab_panel_id = incoming.source_lab_panel_id",
    );
    expect(batches[0]).toContain(", '2026-01-03T01:00:00.000')");
    expect(transaction.lifecycle).toEqual(["begin", "commit"]);
  });

  it("rolls back lab deactivation when its merge fails", async () => {
    const panelId = Buffer.alloc(16, 11);
    const batches: string[] = [];
    const transaction = fakeTransactionalDwh(batches, 2);
    const context = { dwh: transaction.dwh } as unknown as EtlContext;

    await expect(
      factLabPipeline.load(
        context,
        [
          {
            panelId,
            observationIndex: 0,
            labName: "Glucosa",
            resultValue: "90",
            resultUnit: "mg/dL",
            sucursalKey: 1,
            professionalKey: 2,
            patientKey: 3,
            takenAt: new Date("2026-01-03T00:00:00.000Z"),
            deletedAt: null,
            updatedAt: new Date("2026-01-03T01:00:00.000Z"),
          },
        ],
        {
          panels: [
            {
              panelId,
              updatedAt: new Date("2026-01-03T01:00:00.000Z"),
            },
          ],
        },
      ),
    ).rejects.toThrow("batch failed");
    expect(transaction.lifecycle).toEqual(["begin", "rollback"]);
  });

  it("resets the lab observation index for each source panel", async () => {
    const sucursalId = Buffer.alloc(16, 5);
    const professionalId = Buffer.alloc(16, 6);
    const patientId = Buffer.alloc(16, 7);
    const updatedAt = new Date("2026-01-02T01:00:00.000Z");
    const context = {
      watermark: null,
      oltp: {
        request() {
          return {
            input() {
              return this;
            },
            query() {
              return Promise.resolve({
                recordset: [
                  ...[8, 9].map((byte) => ({
                    id: Buffer.alloc(16, byte),
                    sucursal_id: sucursalId,
                    paciente_id: patientId,
                    profesional_id: professionalId,
                    taken_at: updatedAt,
                    lab_name: "Panel",
                    results_json: '[{"analyte":"Glucosa","value":90}]',
                    deleted_at: null,
                    updated_at: updatedAt,
                  })),
                  {
                    id: Buffer.alloc(16, 10),
                    sucursal_id: sucursalId,
                    paciente_id: patientId,
                    profesional_id: professionalId,
                    taken_at: updatedAt,
                    lab_name: "Panel inválido",
                    results_json:
                      '[{"analyte":"Glucosa","value":{"nested":90}}]',
                    deleted_at: null,
                    updated_at: updatedAt,
                  },
                ],
              });
            },
          };
        },
      },
      dwh: {
        request() {
          return {
            query(query: string) {
              if (query.includes("sucursal_natural_id")) {
                return Promise.resolve({
                  recordset: [
                    { sucursal_natural_id: sucursalId, sucursal_key: 1 },
                  ],
                });
              }
              if (query.includes("professional_natural_id")) {
                return Promise.resolve({
                  recordset: [
                    {
                      professional_natural_id: professionalId,
                      professional_key: 2,
                    },
                  ],
                });
              }
              return Promise.resolve({
                recordset: [{ patient_natural_id: patientId, patient_key: 3 }],
              });
            },
          };
        },
      },
    } as unknown as EtlContext;

    const extracted = await factLabPipeline.extract(context);

    expect(extracted.rows.map((row) => row.observationIndex)).toEqual([0, 0]);
    expect(extracted.rows.map((row) => row.labName)).toEqual([
      "Glucosa",
      "Glucosa",
    ]);
    expect(extracted.rejects).toEqual([
      expect.objectContaining({ reasonCode: "invalid_lab_observation" }),
    ]);
  });

  it("derives date keys and ISO week starts in UTC", () => {
    const instant = new Date("2026-01-01T00:30:00.000Z");
    expect(dateKeyFromDate(instant)).toBe(20260101);
    expect(toUtcDateKey(instant)).toBe(20260101);
    expect(startOfUtcWeek(instant).toISOString()).toBe(
      "2025-12-29T00:00:00.000Z",
    );
  });
});

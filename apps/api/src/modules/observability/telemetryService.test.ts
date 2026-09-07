import { beforeEach, describe, expect, it } from "vitest";
import {
  resetAggregatorForTests,
  aggregateEvent,
  telemetryAggregates,
  flushAggregates,
} from "./aggregator.js";
import {
  emitTelemetry,
  observabilitySummary,
  resetTelemetryForTests,
} from "./telemetryService.js";
import { assertNoPhiFields, containsPhiFieldNames } from "./telemetryTypes.js";
import {
  parseTelemetryDetails,
  resetTelemetryStoreForTests,
  serializeTelemetryDetails,
  selectTelemetryStore,
} from "./telemetryStore.js";
import { buildHealthReport } from "./health.js";
import { evaluateAlerts, readAlertingConfig } from "./alerting.js";
import { canAccessTelemetry } from "./accessControl.js";

beforeEach(() => {
  resetAggregatorForTests();
  resetTelemetryStoreForTests();
  resetTelemetryForTests();
});

describe("telemetryTypes: PHI guard", () => {
  it("rejects events with PHI field names", () => {
    expect(containsPhiFieldNames({ patientId: "x" })).toEqual(["patientId"]);
    expect(containsPhiFieldNames({ fullPrompt: "x" })).toEqual(["fullPrompt"]);
    expect(containsPhiFieldNames({ executionId: "ok" })).toEqual([]);
  });

  it("assertNoPhiFields throws on PHI", () => {
    expect(() =>
      assertNoPhiFields({
        eventType: "ai.execution.started",
        executionId: "e",
        status: "x",
        pacienteId: "p",
      } as never),
    ).toThrow(/PHI/);
    expect(() =>
      assertNoPhiFields({
        eventType: "ai.execution.started",
        executionId: "e",
        status: "x",
      }),
    ).not.toThrow();
  });
});

describe("aggregator: percentiles con muestra minima", () => {
  it("no emite p50/p95 con una sola observacion", () => {
    aggregateEvent({
      eventType: "ai.execution.completed",
      executionId: "e1",
      status: "completed",
      durationMs: 10,
    });
    const out = telemetryAggregates();
    const bucket = out.latencies.find(
      (l) => l.key === "ai.execution.completed.duration",
    )?.bucket;
    expect(bucket?.count).toBe(1);
    expect(bucket?.p50).toBeNull();
    expect(bucket?.p95).toBeNull();
  });

  it("emite percentiles tras la muestra minima configurable", () => {
    for (let i = 0; i < 5; i++) {
      aggregateEvent({
        eventType: "ai.execution.completed",
        executionId: `e${i}`,
        status: "completed",
        durationMs: 10 + i,
      });
    }
    const out = telemetryAggregates();
    const bucket = out.latencies.find(
      (l) => l.key === "ai.execution.completed.duration",
    )?.bucket;
    expect(bucket?.count).toBe(5);
    expect(bucket?.p50).not.toBeNull();
    expect(bucket?.p95).not.toBeNull();
  });

  it("deduplica eventos terminales por executionId", () => {
    aggregateEvent({
      eventType: "ai.execution.completed",
      executionId: "dup",
      status: "completed",
    });
    aggregateEvent({
      eventType: "ai.execution.completed",
      executionId: "dup",
      status: "completed",
    });
    const out = telemetryAggregates();
    const counter = out.counters.find(
      (c) => c.key === "ai.execution.completed.completed",
    );
    expect(counter?.value).toBe(1);
    expect(
      out.counters.some(
        (c) => c.key === "ai.execution.completed.duplicate_suppressed",
      ),
    ).toBe(true);
  });

  it("registra estado de breaker", () => {
    aggregateEvent({
      eventType: "breaker.transition",
      executionId: "b1",
      provider: "p",
      model: "m",
      status: "opened",
      breakerState: "OPEN",
      breakerReasonCategory: "OPERATIONAL",
    });
    const out = telemetryAggregates();
    expect(out.breakers).toHaveLength(1);
    expect(out.breakers[0]!.state.state).toBe("OPEN");
  });
});

describe("telemetryService: fail-soft y sin PHI", () => {
  it("emit no lanza nunca", () => {
    expect(() =>
      emitTelemetry({
        eventType: "ai.execution.started",
        executionId: "e",
        status: "started",
      }),
    ).not.toThrow();
  });

  it("resumen expone overhead medido", async () => {
    emitTelemetry({
      eventType: "ai.execution.started",
      executionId: "e",
      status: "started",
    });
    const summary = observabilitySummary();
    expect(summary.overhead.count).toBeGreaterThanOrEqual(1);
  });

  it("store memory persiste eventos recientes", async () => {
    const store = selectTelemetryStore({ AI_TELEMETRY_STORE: "memory" });
    await store.record({
      eventType: "ai.execution.started",
      executionId: "e",
      status: "started",
    });
    const events = await store.recent(10);
    expect(events).toHaveLength(1);
  });

  it("normaliza el valor validado del store SQL", () => {
    expect(selectTelemetryStore({ AI_TELEMETRY_STORE: " sql " }).kind).toBe(
      "sql",
    );
  });

  it("serializa counts y latencias como un único JSON válido", () => {
    const value = serializeTelemetryDetails({
      eventType: "dwh.etl",
      executionId: "etl-1",
      status: "succeeded",
      counts: { loaded: 4 },
      latencyMs: { extract: 12 },
    });

    expect(parseTelemetryDetails(value)).toEqual({
      counts: { loaded: 4 },
      latencyMs: { extract: 12 },
    });
    expect(parseTelemetryDetails('{"loaded":4}')).toEqual({
      counts: { loaded: 4 },
    });
  });

  it("flush agrega counters al store", async () => {
    aggregateEvent({
      eventType: "ai.execution.completed",
      executionId: "f1",
      status: "completed",
    });
    await flushAggregates();
    const store = selectTelemetryStore({ AI_TELEMETRY_STORE: "memory" });
    const aggs = await store.findAggregate("ai.execution.completed.completed");
    expect(aggs.length).toBeGreaterThanOrEqual(1);
  });
});

describe("health: NO_ELIGIBLE_MODEL != infraestructura caida", () => {
  it("reporta modelo clinico NONE y egress kill switch", async () => {
    const report = await buildHealthReport({ AI_EGRESS_ENABLED: "true" });
    expect(report.clinicalModelAvailability).toBe("NO_ELIGIBLE_MODEL");
    expect(report.eligibleClinicalModel).toBe("NONE");
    expect(report.egressKillSwitch).toBe("ENABLED");
  });
});

describe("alerting: reglas deterministas", () => {
  it("detecta spike de fallos de schema", () => {
    const events = Array.from({ length: 6 }, () => ({
      eventType: "ai.structured_output",
      status: "schema_fail",
    }));
    const alerts = evaluateAlerts(events, readAlertingConfig({}));
    expect(alerts.some((a) => a.ruleId === "schema_failure_spike")).toBe(true);
  });

  it("no alerta con condiciones sanas", () => {
    const events = [
      { eventType: "ai.execution.completed", status: "completed" },
    ];
    const alerts = evaluateAlerts(events, readAlertingConfig({}));
    expect(alerts.filter((a) => a.severity !== "INFO")).toHaveLength(0);
  });

  it.each([
    ["AI_TELEMETRY_ALERT_BREAKER_OPENED", "yes"],
    ["AI_TELEMETRY_ALERT_SCHEMA_FAILURE_SPIKE", "0"],
    ["AI_TELEMETRY_ALERT_CITATION_VALIDITY_MIN", "NaN"],
    ["AI_TELEMETRY_ALERT_CRITICAL_DISAGREEMENT", "1.5"],
  ])("rechaza configuración inválida %s", (name, value) => {
    expect(() => readAlertingConfig({ [name]: value })).toThrow(name);
  });
});

describe("accessControl: telemetria restringida", () => {
  it("permite admin/auditor/soporte_tecnico", () => {
    expect(canAccessTelemetry("admin")).toBe(true);
    expect(canAccessTelemetry("auditor")).toBe(true);
    expect(canAccessTelemetry("soporte_tecnico")).toBe(true);
  });

  it("niega profesional y paciente", () => {
    expect(canAccessTelemetry("nutriologa")).toBe(false);
    expect(canAccessTelemetry("")).toBe(false);
  });
});

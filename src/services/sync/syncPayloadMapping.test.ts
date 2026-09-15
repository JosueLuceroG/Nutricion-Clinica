import { describe, expect, it } from "vitest";
import { toApiPayload, toLocalPayload } from "./syncPayloadMapping";

describe("canonical sync field boundary", () => {
  it("preserves vitals through Dexie -> wire -> Dexie", () => {
    const vitals = { systolic: 122, diastolic: 78, oxygen: 98 };
    const local = { id: "consultation", vitals_json: JSON.stringify(vitals) };
    expect(toApiPayload("consultas", local)).toEqual({ id: "consultation", vitals });
    expect(toLocalPayload("consultas", toApiPayload("consultas", local)!)).toEqual(local);
  });
  it("preserves meals and consultation identity without competing aliases", () => {
    const meals = [{ slot: "breakfast", exchanges: [{ foodId: "synthetic", count: 2 }] }];
    const local = { id: "plan", consultation_id: "consultation", meals_json: JSON.stringify(meals) };
    expect(toApiPayload("planes_alimenticios", local)).toEqual({ id: "plan", consulta_id: "consultation", meals });
    expect(toLocalPayload("planes_alimenticios", toApiPayload("planes_alimenticios", local)!)).toEqual(local);
  });
  it("fails closed on corrupt clinical JSON instead of substituting null", () => {
    expect(() => toApiPayload("consultas", { vitals_json: "{broken" })).toThrow();
    expect(() => toApiPayload("planes_alimenticios", { meals_json: "{broken" })).toThrow();
  });
  it("rejects competing names rather than choosing a truth silently", () => {
    expect(() => toApiPayload("consultas", { vitals_json: "{}", vitals: {} })).toThrow();
    expect(() => toApiPayload("planes_alimenticios", { consultation_id: "A", consulta_id: "B" })).toThrow();
  });
  it("leaves array-valued lab and anthropometry payloads structured", () => {
    for (const entity of ["antropometrias", "lab_panels", "adherence_records"] as const) {
      const payload = { id: "row", results: [{ value: 42 }], circumferences: { waist: 80 } };
      expect(toLocalPayload(entity, toApiPayload(entity, payload)!)).toEqual(payload);
    }
  });
  it("restores adherence dates and timestamps to the Dexie representation", () => {
    expect(toLocalPayload("adherence_records", {
      id: "row",
      date: "2026-09-09T00:00:00.000Z",
      created_at: "2026-09-09T10:00:00.000Z",
      updated_at: "2026-09-09T11:00:00.000Z",
    })).toEqual({
      id: "row",
      date: "2026-09-09",
      created_at: Date.parse("2026-09-09T10:00:00.000Z"),
      updated_at: Date.parse("2026-09-09T11:00:00.000Z"),
    });
  });
});

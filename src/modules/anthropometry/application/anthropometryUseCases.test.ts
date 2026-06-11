import { describe, it, expect, vi } from "vitest";
import { Anthropometry } from "../domain/Anthropometry";
import { AnthropometryId } from "../domain/AnthropometryId";
import { PatientId } from "@modules/patient/domain/PatientId";
import { Weight, Height } from "../domain/Measurements";
import { AnthropometryNotFoundError } from "../domain/AnthropometryRepository";
import type { AnthropometryRepository } from "../domain/AnthropometryRepository";
import {
  CreateAnthropometryUseCase,
  UpdateAnthropometryUseCase,
  GetAnthropometryUseCase,
  ListAnthropometryUseCase,
  DeleteAnthropometryUseCase,
} from "./anthropometryUseCases";

const makeFixture = () => ({
  patientId: PatientId.generate(),
  measuredAt: new Date(),
  weight: Weight.fromKg(70),
  height: Height.fromCentimeters(170),
});

const makeMockRepo = (): AnthropometryRepository => ({
  save: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  count: vi.fn(),
  delete: vi.fn(),
});

describe("CreateAnthropometryUseCase", () => {
  it("crea y guarda una medición", async () => {
    const repo = makeMockRepo();
    const useCase = new CreateAnthropometryUseCase(repo);

    const result = await useCase.execute(makeFixture());

    expect(result.weight.toKg()).toBe(70);
    expect(result.height.toMeters()).toBeCloseTo(1.7);
    expect(repo.save).toHaveBeenCalledWith(result);
  });
});

describe("UpdateAnthropometryUseCase", () => {
  it("actualiza una medición existente", async () => {
    const repo = makeMockRepo();
    const existing = Anthropometry.create(makeFixture());
    vi.mocked(repo.findById).mockResolvedValue(existing);

    const useCase = new UpdateAnthropometryUseCase(repo);
    const result = await useCase.execute(existing.id, { notes: "actualizado" });

    expect(result.notes).toBe("actualizado");
    expect(result.id.equals(existing.id)).toBe(true);
    expect(repo.save).toHaveBeenCalled();
  });

  it("lanza error si la medición no existe", async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.findById).mockResolvedValue(null);
    const useCase = new UpdateAnthropometryUseCase(repo);

    await expect(
      useCase.execute(AnthropometryId.generate(), { notes: "x" }),
    ).rejects.toThrow(AnthropometryNotFoundError);
  });
});

describe("GetAnthropometryUseCase", () => {
  it("retorna medición existente", async () => {
    const repo = makeMockRepo();
    const existing = Anthropometry.create(makeFixture());
    vi.mocked(repo.findById).mockResolvedValue(existing);

    const useCase = new GetAnthropometryUseCase(repo);
    const result = await useCase.execute(existing.id);

    expect(result.id.equals(existing.id)).toBe(true);
  });

  it("lanza error si la medición no existe", async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.findById).mockResolvedValue(null);
    const useCase = new GetAnthropometryUseCase(repo);

    await expect(
      useCase.execute(AnthropometryId.generate()),
    ).rejects.toThrow(AnthropometryNotFoundError);
  });
});

describe("ListAnthropometryUseCase", () => {
  it("retorna items y total", async () => {
    const repo = makeMockRepo();
    const item = Anthropometry.create(makeFixture());
    vi.mocked(repo.findAll).mockResolvedValue([item]);
    vi.mocked(repo.count).mockResolvedValue(1);

    const useCase = new ListAnthropometryUseCase(repo);
    const result = await useCase.execute();

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].id.equals(item.id)).toBe(true);
  });

  it("retorna lista vacía cuando no hay mediciones", async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.findAll).mockResolvedValue([]);
    vi.mocked(repo.count).mockResolvedValue(0);

    const useCase = new ListAnthropometryUseCase(repo);
    const result = await useCase.execute();

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe("DeleteAnthropometryUseCase", () => {
  it("elimina medición existente (soft delete por defecto)", async () => {
    const repo = makeMockRepo();
    const existing = Anthropometry.create(makeFixture());
    vi.mocked(repo.findById).mockResolvedValue(existing);

    const useCase = new DeleteAnthropometryUseCase(repo);
    await useCase.execute(existing.id);

    expect(repo.delete).toHaveBeenCalledWith(existing.id, true);
  });

  it("permite hard delete con soft=false", async () => {
    const repo = makeMockRepo();
    const existing = Anthropometry.create(makeFixture());
    vi.mocked(repo.findById).mockResolvedValue(existing);

    const useCase = new DeleteAnthropometryUseCase(repo);
    await useCase.execute(existing.id, false);

    expect(repo.delete).toHaveBeenCalledWith(existing.id, false);
  });

  it("lanza error si la medición no existe", async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.findById).mockResolvedValue(null);
    const useCase = new DeleteAnthropometryUseCase(repo);

    await expect(
      useCase.execute(AnthropometryId.generate()),
    ).rejects.toThrow(AnthropometryNotFoundError);
  });
});

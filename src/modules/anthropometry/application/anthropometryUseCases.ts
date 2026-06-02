import { Anthropometry, type AnthropometryCreate } from "../domain/Anthropometry";
import type { AnthropometryId } from "../domain/AnthropometryId";
import type { AnthropometryRepository, AnthropometryQuery } from "../domain/AnthropometryRepository";
import { AnthropometryNotFoundError } from "../domain/AnthropometryRepository";

export class CreateAnthropometryUseCase {
  constructor(private readonly repo: AnthropometryRepository) {}

  async execute(input: AnthropometryCreate): Promise<Anthropometry> {
    const measurement = Anthropometry.create(input);
    await this.repo.save(measurement);
    return measurement;
  }
}

export class UpdateAnthropometryUseCase {
  constructor(private readonly repo: AnthropometryRepository) {}

  async execute(
    id: AnthropometryId,
    updates: Partial<Omit<AnthropometryCreate, "id" | "patientId">>,
  ): Promise<Anthropometry> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AnthropometryNotFoundError(id);
    const updated = existing.with(updates);
    await this.repo.save(updated);
    return updated;
  }
}

export class GetAnthropometryUseCase {
  constructor(private readonly repo: AnthropometryRepository) {}

  async execute(id: AnthropometryId): Promise<Anthropometry> {
    const found = await this.repo.findById(id);
    if (!found) throw new AnthropometryNotFoundError(id);
    return found;
  }
}

export class ListAnthropometryUseCase {
  constructor(private readonly repo: AnthropometryRepository) {}

  async execute(query?: AnthropometryQuery): Promise<{ items: Anthropometry[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.findAll(query),
      this.repo.count(query),
    ]);
    return { items, total };
  }
}

export class DeleteAnthropometryUseCase {
  constructor(private readonly repo: AnthropometryRepository) {}

  async execute(id: AnthropometryId, soft = true): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AnthropometryNotFoundError(id);
    await this.repo.delete(id, soft);
  }
}

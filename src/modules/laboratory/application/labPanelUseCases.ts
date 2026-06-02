import { LabPanel, type LabPanelCreate } from "../domain/LabPanel";
import type { LabPanelId } from "../domain/LabPanelId";
import type { LabPanelRepository, LabPanelQuery } from "../domain/LabPanelRepository";
import { LabPanelNotFoundError } from "../domain/LabPanelRepository";

export class CreateLabPanelUseCase {
  constructor(private readonly repo: LabPanelRepository) {}

  async execute(input: LabPanelCreate): Promise<LabPanel> {
    const panel = LabPanel.create(input);
    await this.repo.save(panel);
    return panel;
  }
}

export class UpdateLabPanelUseCase {
  constructor(private readonly repo: LabPanelRepository) {}

  async execute(id: LabPanelId, updates: { notes?: string | null }): Promise<LabPanel> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new LabPanelNotFoundError(id);
    const updated = updates.notes !== undefined ? existing.withNotes(updates.notes) : existing;
    if (updated === existing) return existing;
    await this.repo.save(updated);
    return updated;
  }
}

export class GetLabPanelUseCase {
  constructor(private readonly repo: LabPanelRepository) {}

  async execute(id: LabPanelId): Promise<LabPanel> {
    const found = await this.repo.findById(id);
    if (!found) throw new LabPanelNotFoundError(id);
    return found;
  }
}

export class ListLabPanelsUseCase {
  constructor(private readonly repo: LabPanelRepository) {}

  async execute(query?: LabPanelQuery): Promise<{ items: LabPanel[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.findAll(query),
      this.repo.count(query),
    ]);
    return { items, total };
  }
}

export class DeleteLabPanelUseCase {
  constructor(private readonly repo: LabPanelRepository) {}

  async execute(id: LabPanelId, soft = true): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new LabPanelNotFoundError(id);
    await this.repo.delete(id, soft);
  }
}

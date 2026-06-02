import { DexieLabPanelRepository } from "@modules/laboratory/infrastructure/DexieLabPanelRepository";
import { db } from "@services/db/dexieSchema";
import {
  CreateLabPanelUseCase,
  UpdateLabPanelUseCase,
  GetLabPanelUseCase,
  ListLabPanelsUseCase,
  DeleteLabPanelUseCase,
} from "@modules/laboratory/application/labPanelUseCases";
import type { LabPanelRepository } from "@modules/laboratory/domain/LabPanelRepository";

const repository: LabPanelRepository = new DexieLabPanelRepository(db);

export const labPanelService = {
  create: new CreateLabPanelUseCase(repository),
  update: new UpdateLabPanelUseCase(repository),
  get: new GetLabPanelUseCase(repository),
  list: new ListLabPanelsUseCase(repository),
  delete: new DeleteLabPanelUseCase(repository),
};

export type LabPanelService = typeof labPanelService;

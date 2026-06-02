import { DexieAnthropometryRepository } from "@modules/anthropometry/infrastructure/DexieAnthropometryRepository";
import { db } from "@services/db/dexieSchema";
import {
  CreateAnthropometryUseCase,
  UpdateAnthropometryUseCase,
  GetAnthropometryUseCase,
  ListAnthropometryUseCase,
  DeleteAnthropometryUseCase,
} from "@modules/anthropometry/application/anthropometryUseCases";
import type { AnthropometryRepository } from "@modules/anthropometry/domain/AnthropometryRepository";

const repository: AnthropometryRepository = new DexieAnthropometryRepository(db);

export const anthropometryService = {
  create: new CreateAnthropometryUseCase(repository),
  update: new UpdateAnthropometryUseCase(repository),
  get: new GetAnthropometryUseCase(repository),
  list: new ListAnthropometryUseCase(repository),
  delete: new DeleteAnthropometryUseCase(repository),
};

export type AnthropometryService = typeof anthropometryService;

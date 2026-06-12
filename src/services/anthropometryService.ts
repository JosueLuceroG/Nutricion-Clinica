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
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

const repository: AnthropometryRepository = new DexieAnthropometryRepository(db);
const createAnthropometry = new CreateAnthropometryUseCase(repository);
const updateAnthropometry = new UpdateAnthropometryUseCase(repository);
const deleteAnthropometry = new DeleteAnthropometryUseCase(repository);

export const anthropometryService = {
  create: {
    async execute(input: Parameters<typeof createAnthropometry.execute>[0]): ReturnType<typeof createAnthropometry.execute> {
      const measurement = await createAnthropometry.execute(input);
      await recordClinicalAudit({ module: "anthropometry", action: "create", resourceType: "anthropometry", resourceId: measurement.id.toString(), patientId: measurement.patientId.toString() });
      return measurement;
    },
  },
  update: {
    async execute(id: Parameters<typeof updateAnthropometry.execute>[0], updates: Parameters<typeof updateAnthropometry.execute>[1]): ReturnType<typeof updateAnthropometry.execute> {
      const measurement = await updateAnthropometry.execute(id, updates);
      await recordClinicalAudit({ module: "anthropometry", action: "update", resourceType: "anthropometry", resourceId: measurement.id.toString(), patientId: measurement.patientId.toString() });
      return measurement;
    },
  },
  get: new GetAnthropometryUseCase(repository),
  list: new ListAnthropometryUseCase(repository),
  delete: {
    async execute(id: Parameters<typeof deleteAnthropometry.execute>[0], soft = true): ReturnType<typeof deleteAnthropometry.execute> {
      const existing = await repository.findById(id);
      await deleteAnthropometry.execute(id, soft);
      await recordClinicalAudit({ module: "anthropometry", action: soft ? "soft_delete" : "remove", resourceType: "anthropometry", resourceId: id.toString(), patientId: existing?.patientId.toString() ?? null });
    },
  },
};

export type AnthropometryService = typeof anthropometryService;

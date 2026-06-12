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
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

const repository: LabPanelRepository = new DexieLabPanelRepository(db);
const createLabPanel = new CreateLabPanelUseCase(repository);
const updateLabPanel = new UpdateLabPanelUseCase(repository);
const deleteLabPanel = new DeleteLabPanelUseCase(repository);

export const labPanelService = {
  create: {
    async execute(input: Parameters<typeof createLabPanel.execute>[0]): ReturnType<typeof createLabPanel.execute> {
      const panel = await createLabPanel.execute(input);
      await recordClinicalAudit({ module: "laboratory", action: "create", resourceType: "lab_panel", resourceId: panel.id.toString(), patientId: panel.patientId.toString() });
      return panel;
    },
  },
  update: {
    async execute(id: Parameters<typeof updateLabPanel.execute>[0], updates: Parameters<typeof updateLabPanel.execute>[1]): ReturnType<typeof updateLabPanel.execute> {
      const panel = await updateLabPanel.execute(id, updates);
      await recordClinicalAudit({ module: "laboratory", action: "update", resourceType: "lab_panel", resourceId: panel.id.toString(), patientId: panel.patientId.toString(), justification: "notes" });
      return panel;
    },
  },
  get: new GetLabPanelUseCase(repository),
  list: new ListLabPanelsUseCase(repository),
  delete: {
    async execute(id: Parameters<typeof deleteLabPanel.execute>[0], soft = true): ReturnType<typeof deleteLabPanel.execute> {
      const existing = await repository.findById(id);
      await deleteLabPanel.execute(id, soft);
      await recordClinicalAudit({ module: "laboratory", action: soft ? "soft_delete" : "remove", resourceType: "lab_panel", resourceId: id.toString(), patientId: existing?.patientId.toString() ?? null });
    },
  },
};

export type LabPanelService = typeof labPanelService;

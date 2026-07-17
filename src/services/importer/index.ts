import { PatientImporterService } from "./importerService";
import { DexiePatientRepository } from "@modules/patient/infrastructure/DexiePatientRepository";
import { db } from "@services/db/dexieSchema";

const patientRepository = new DexiePatientRepository(db);

export const patientImporterService = new PatientImporterService(patientRepository);

export { parseCsv, CsvParseError } from "./csvParser";
export {
  mapHeaders,
  mapRow,
  toPatientCreate,
  tryCreatePatient,
  validateRequiredHeaders,
  REQUIRED_COLUMNS,
  type PatientCsvRow,
  type MappedRow,
  PatientRowImportError,
} from "./patientImporter";
export {
  PatientImporterService,
  type ImporterPreview,
  type ImporterApplyResult,
} from "./importerService";
export {
  currentPatientRowsForBranch,
  patientRowsToCsv,
} from "./patientCsvExport";
export {
  closeCsvPreviewWindow,
  downloadAndOpenCsv,
  prepareCsvPreviewWindow,
  type CsvDownloadResult,
} from "./csvDownload";

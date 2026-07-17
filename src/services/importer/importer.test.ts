import { describe, it, expect } from "vitest";
import { parseCsv, CsvParseError } from "./csvParser";
import {
  mapHeaders,
  mapRow,
  parseDate,
  validateRequiredHeaders,
  toPatientCreate,
  tryCreatePatient,
  PatientRowImportError,
} from "./patientImporter";
import { PatientImporterService } from "./importerService";
import {
  currentPatientRowsForBranch,
  patientRowsToCsv,
} from "./patientCsvExport";
import type { PatientRepository } from "@modules/patient/domain/PatientRepository";
import type { Patient } from "@modules/patient/domain/Patient";
import type { PatientRow } from "@modules/patient/infrastructure/patientMapper";

describe("csvParser", () => {
  it("parsea CSV simple con encabezados y filas", () => {
    const csv = "nombre,apellido\nMar\u00eda,G\u00f3mez\nJuan,P\u00e9rez\n";
    const result = parseCsv(csv);
    expect(result.headers).toEqual(["nombre", "apellido"]);
    expect(result.totalRows).toBe(2);
    expect(result.rows).toEqual([["Mar\u00eda", "G\u00f3mez"], ["Juan", "P\u00e9rez"]]);
  });

  it("ignora BOM al inicio del archivo", () => {
    const csv = "\uFEFFnombre,apellido\nMar\u00eda,G\u00f3mez\n";
    const result = parseCsv(csv);
    expect(result.headers).toEqual(["nombre", "apellido"]);
    expect(result.totalRows).toBe(1);
  });

  it("maneja campos entrecomillados con comas dentro", () => {
    const csv = "nombre,direccion\nMar\u00eda,\"Calle A, #123\"\n";
    const result = parseCsv(csv);
    expect(result.rows[0]).toEqual(["Mar\u00eda", "Calle A, #123"]);
  });

  it("maneja comillas escapadas como \"\"", () => {
    const csv = "nombre,notas\nMar\u00eda,\"Dice \"\"hola\"\" siempre\"\n";
    const result = parseCsv(csv);
    expect(result.rows[0]).toEqual(["Mar\u00eda", "Dice \"hola\" siempre"]);
  });

  it("ignora l\u00edneas vac\u00edas", () => {
    const csv = "a,b\n1,2\n\n3,4\n";
    const result = parseCsv(csv);
    expect(result.totalRows).toBe(2);
  });

  it("soporta separador ; configurable", () => {
    const csv = "a;b\n1;2\n";
    const result = parseCsv(csv, { separator: ";" });
    expect(result.rows[0]).toEqual(["1", "2"]);
  });

  it("lanza CsvParseError si una comilla no cierra", () => {
    const csv = "a,b\n1,\"2\n";
    expect(() => parseCsv(csv)).toThrow(CsvParseError);
  });

  it("lanza CsvParseError si comilla aparece en medio de un campo sin abrir", () => {
    const csv = "a,b\n1x\"2,3\n";
    expect(() => parseCsv(csv)).toThrow(CsvParseError);
  });

  it("retorna filas vac\u00edas cuando el archivo est\u00e1 en blanco", () => {
    const result = parseCsv("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(result.totalRows).toBe(0);
  });

  it("maneja saltos de l\u00ednea dentro de campos entrecomillados", () => {
    const csv = "a,b\n1,\"l\u00ednea 1\nl\u00ednea 2\"\n";
    const result = parseCsv(csv);
    expect(result.rows[0][1]).toBe("l\u00ednea 1\nl\u00ednea 2");
  });
});

describe("mapHeaders", () => {
  it("mapea encabezados en espa\u00f1ol a campos del dominio", () => {
    const map = mapHeaders(["Nombre", "Apellido", "Fecha de nacimiento", "Sexo"]);
    expect(map.get(0)).toBe("firstName");
    expect(map.get(1)).toBe("lastName");
    expect(map.get(2)).toBe("birthDate");
    expect(map.get(3)).toBe("sex");
  });

  it("mapea encabezados en ingl\u00e9s", () => {
    const map = mapHeaders(["First Name", "Last Name", "Birth Date", "Sex"]);
    expect(map.get(0)).toBe("firstName");
    expect(map.get(3)).toBe("sex");
  });

  it("mapea encabezados con tildes, snake_case y kebab-case", () => {
    const map = mapHeaders(["Correo", "Tel\u00e9fono", "telefono_secundario", "emergency_phone"]);
    expect(map.get(0)).toBe("email");
    expect(map.get(1)).toBe("phone");
    expect(map.get(2)).toBe("secondaryPhone");
    expect(map.get(3)).toBe("emergencyContactPhone");
  });

  it("ignora encabezados desconocidos", () => {
    const map = mapHeaders(["foo", "bar", "Nombre"]);
    expect(map.size).toBe(1);
    expect(map.get(2)).toBe("firstName");
  });
});

describe("parseDate", () => {
  it("parsea formato ISO AAAA-MM-DD", () => {
    const d = parseDate("1990-05-15");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(1990);
    expect(d!.getUTCMonth()).toBe(4);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("parsea formato DD/MM/AAAA", () => {
    const d = parseDate("15/05/1990");
    expect(d!.getUTCFullYear()).toBe(1990);
    expect(d!.getUTCMonth()).toBe(4);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("parsea formato DD-MM-AAAA", () => {
    const d = parseDate("15-05-1990");
    expect(d!.getUTCFullYear()).toBe(1990);
    expect(d!.getUTCMonth()).toBe(4);
    expect(d!.getUTCDate()).toBe(15);
  });

  it("rechaza fecha inv\u00e1lida", () => {
    expect(parseDate("no-fecha")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("validateRequiredHeaders", () => {
  it("ok=true si todos los requeridos est\u00e1n presentes", () => {
    const result = validateRequiredHeaders(["Nombre", "Apellido", "Fecha de nacimiento", "Sexo"]);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("ok=false si falta un requerido", () => {
    const result = validateRequiredHeaders(["Nombre", "Apellido"]);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("birthDate");
    expect(result.missing).toContain("sex");
  });
});

describe("mapRow", () => {
  const headers = ["Nombre", "Apellido", "Fecha de nacimiento", "Sexo", "Correo", "Tel\u00e9fono"];
  const map = mapHeaders(headers);

  it("mapea fila v\u00e1lida sin errores", () => {
    const result = mapRow(0, ["Mar\u00eda", "G\u00f3mez", "15/05/1990", "F", "maria@x.com", "5512345678"], map);
    expect(result.errors).toEqual([]);
    expect(result.mapped?.firstName).toBe("Mar\u00eda");
    expect(result.mapped?.birthDate).toBe("15/05/1990");
    expect(result.mapped?.sex).toBe("F");
  });

  it("recolecta errores de campos faltantes", () => {
    const result = mapRow(0, ["", "", "", ""], map);
    expect(result.errors).toContain("Falta nombre");
    expect(result.errors).toContain("Falta apellido");
    expect(result.errors).toContain("Falta fecha de nacimiento");
    expect(result.errors).toContain("Falta sexo");
    expect(result.mapped).toBeNull();
  });

  it("rechaza fecha inv\u00e1lida", () => {
    const result = mapRow(0, ["Mar\u00eda", "G\u00f3mez", "no-fecha", "F"], map);
    expect(result.errors.some((e) => e.includes("Fecha de nacimiento inv\u00e1lida"))).toBe(true);
  });

  it("rechaza sexo no reconocido", () => {
    const result = mapRow(0, ["Mar\u00eda", "G\u00f3mez", "15/05/1990", "X"], map);
    expect(result.errors.some((e) => e.toLowerCase().includes("sexo"))).toBe(true);
  });

  it("rechaza email inv\u00e1lido", () => {
    const result = mapRow(0, ["Mar\u00eda", "G\u00f3mez", "15/05/1990", "F", "no-es-email"], map);
    expect(result.errors.some((e) => e.includes("Email inv\u00e1lido"))).toBe(true);
  });

  it("rechaza tel\u00e9fono inv\u00e1lido", () => {
    const result = mapRow(0, ["Mar\u00eda", "G\u00f3mez", "15/05/1990", "F", "", "abc"], map);
    expect(result.errors.some((e) => e.includes("Tel\u00e9fono inv\u00e1lido"))).toBe(true);
  });
});

describe("tryCreatePatient", () => {
  const headers = ["Nombre", "Apellido", "Fecha de nacimiento", "Sexo"];
  const map = mapHeaders(headers);

  it("crea Patient cuando la fila mapea correctamente", () => {
    const mapped = mapRow(0, ["Mar\u00eda", "G\u00f3mez", "1990-05-15", "femenino"], map);
    const p = tryCreatePatient(mapped);
    expect(p).not.toBeNull();
    expect(p!.firstName).toBe("Mar\u00eda");
    expect(p!.sex).toBe("female");
    expect(p!.birthDate.getUTCFullYear()).toBe(1990);
  });

  it("devuelve null si la fila no mapea", () => {
    const mapped = mapRow(0, ["", "", "", ""], map);
    expect(tryCreatePatient(mapped)).toBeNull();
  });
});

describe("toPatientCreate", () => {
  const headers = ["Nombre", "Apellido", "Fecha de nacimiento", "Sexo", "Notas"];
  const map = mapHeaders(headers);

  it("lanza PatientRowImportError si la fila no est\u00e1 mapeada", () => {
    const mapped = mapRow(0, ["", "", "", ""], map);
    expect(() => toPatientCreate(mapped)).toThrow(PatientRowImportError);
  });
});

function makeFakeRepo(): PatientRepository {
  const stored: Patient[] = [];
  return {
    async save(patient: Patient): Promise<void> {
      stored.push(patient);
    },
    async findById(): Promise<Patient | null> {
      return stored[0] ?? null;
    },
    async findAll(): Promise<Patient[]> {
      return stored.slice();
    },
    async count(): Promise<number> {
      return stored.length;
    },
    async findDeleted(): Promise<Patient[]> {
      return stored.filter((p) => p.deletedAt !== null);
    },
    async countDeleted(): Promise<number> {
      return stored.filter((p) => p.deletedAt !== null).length;
    },
    async delete(): Promise<void> {
      /* noop */
    },
  };
}

describe("PatientImporterService", () => {
  it("preview clasifica filas en valid/invalid", () => {
    const repo = makeFakeRepo();
    const svc = new PatientImporterService(repo);
    const csv = "Nombre,Apellido,Fecha de nacimiento,Sexo\nMar\u00eda,G\u00f3mez,1990-05-15,femenino\n,Sin,no-fecha,X\n";
    const preview = svc.preview(csv);
    expect(preview.headers).toEqual(["Nombre", "Apellido", "Fecha de nacimiento", "Sexo"]);
    expect(preview.valid.length + preview.invalid.length).toBe(2);
    expect(preview.valid.length).toBe(1);
    expect(preview.invalid.length).toBe(1);
    expect(preview.valid[0].errors).toEqual([]);
    expect(preview.invalid[0].errors.length).toBeGreaterThan(0);
  });

  it("apply persiste solo filas v\u00e1lidas y reporta fallidas", async () => {
    const repo = makeFakeRepo();
    const svc = new PatientImporterService(repo);
    const csv = "Nombre,Apellido,Fecha de nacimiento,Sexo\nMar\u00eda,G\u00f3mez,1990-05-15,femenino\nJuan,P\u00e9rez,1985-10-20,masculino\n,Sin,no-fecha,X\n";
    const result = await svc.apply(csv);
    expect(result.imported).toBe(2);
    expect(result.failed.length).toBe(1);
    expect(result.failed[0].rowNumber).toBe(3);
  });

  it("apply lanza error si faltan columnas obligatorias", async () => {
    const repo = makeFakeRepo();
    const svc = new PatientImporterService(repo);
    const csv = "foo,bar\n1,2\n";
    await expect(svc.apply(csv)).rejects.toThrow(/obligatorias/i);
  });

  it("preview reporta encabezados faltantes", () => {
    const repo = makeFakeRepo();
    const svc = new PatientImporterService(repo);
    const csv = "foo,bar\n1,2\n";
    const preview = svc.preview(csv);
    expect(preview.missingRequiredColumns.length).toBeGreaterThan(0);
  });
});

function makePatientRow(
  id: string,
  overrides: Partial<PatientRow> = {},
): PatientRow {
  return {
    id,
    sucursal_id: "branch-1",
    first_name: "María",
    last_name: "Gómez",
    second_last_name: null,
    birth_date: "1990-05-15T00:00:00.000Z",
    sex: "female",
    gender: null,
    marital_status: null,
    occupation: "Ingeniera",
    education: null,
    email: "maria@example.com",
    phone: "+52 55 1234 5678",
    secondary_phone: null,
    emergency_contact_name: null,
    emergency_contact_relationship: null,
    emergency_contact_phone: null,
    record_status: "active",
    record_opened_at: "2025-01-01T00:00:00.000Z",
    general_notes: "Seguimiento, mensual",
    consentimiento_informado_id: null,
    fecha_firma_consentimiento: null,
    version_politica_privacidad: null,
    clinical_tags: "[]",
    clave_interna: null,
    birth_place: null,
    address: null,
    nationality: null,
    id_type: null,
    id_number: null,
    discharge_reason: null,
    responsible_professional_id: null,
    external_record_number: null,
    photo_url: null,
    status: "active",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("patientCsvExport", () => {
  it("exporta un CSV que el importador puede volver a leer", () => {
    const csv = patientRowsToCsv([
      makePatientRow("patient-1", {
        first_name: 'María "Luz"',
        general_notes: "Seguimiento, mensual",
      }),
    ]);
    const preview = new PatientImporterService(makeFakeRepo()).preview(csv);

    expect(preview.valid).toHaveLength(1);
    expect(preview.invalid).toHaveLength(0);
    expect(preview.valid[0].mapped?.firstName).toBe('María "Luz"');
    expect(preview.valid[0].mapped?.generalNotes).toBe("Seguimiento, mensual");
  });

  it("incluye pacientes actuales de la sucursal y registros heredados", () => {
    const rows = [
      makePatientRow("current"),
      makePatientRow("legacy", { sucursal_id: null }),
      makePatientRow("other", { sucursal_id: "branch-2" }),
      makePatientRow("deleted", { deleted_at: "2026-01-01T00:00:00.000Z" }),
    ];

    expect(
      currentPatientRowsForBranch(rows, "branch-1").map((row) => row.id),
    ).toEqual(["current", "legacy"]);
  });
});

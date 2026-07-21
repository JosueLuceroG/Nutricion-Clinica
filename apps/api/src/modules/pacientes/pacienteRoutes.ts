import {
  Router as ExpressRouter,
  type Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import sql from "mssql";
import { getPool } from "../../db/connection.js";
import { requireAuth } from "../auth/middleware/requireAuth.js";
import { requireSucursalAccess } from "../tenancy/middleware/requireSucursalAccess.js";
import { ForbiddenError } from "../../middleware/errorHandler.js";
import pacienteSubstitutionRouter from "./pacienteSubstitutionRoutes.js";
import { validatePatientPhotoValue } from "./patientPhoto.js";

const router: Router = ExpressRouter();

router.use(requireAuth, requireSucursalAccess);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SEXO_VALUES = ["female", "male", "intersex", "undisclosed"] as const;
const ESTADO_VALUES = ["active", "inactive", "archived"] as const;

const PatientPhotoSchema = z.string().superRefine((value, context) => {
  try {
    validatePatientPhotoValue(value);
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : "Imagen inválida",
    });
  }
});

const FamilyRelationshipSchema = z.enum([
  "none",
  "mother",
  "father",
  "maternalGrandparents",
  "paternalGrandparents",
  "siblings",
]);

const FamilyHistoryDetailsSchema = z
  .object({
    diabetes: z.array(FamilyRelationshipSchema).max(6),
    hypertension: z.array(FamilyRelationshipSchema).max(6),
    obesity: z.array(FamilyRelationshipSchema).max(6),
    cardiovascularDisease: z.array(FamilyRelationshipSchema).max(6),
    dyslipidemia: z.array(FamilyRelationshipSchema).max(6),
    kidneyDisease: z.array(FamilyRelationshipSchema).max(6),
    thyroidDisease: z.array(FamilyRelationshipSchema).max(6),
    otherConditions: z.string().max(500).nullable(),
    notes: z.string().max(1000).nullable(),
  })
  .strict();

const MedicalIntakeSchema = z
  .object({
    diagnosedConditions: z.boolean().nullable().optional(),
    previousSurgeries: z.boolean().nullable().optional(),
    currentTreatments: z.boolean().nullable().optional(),
    intolerances: z.boolean().nullable().optional(),
    familyHistory: z.boolean().nullable().optional(),
    familyHistoryDetails: FamilyHistoryDetailsSchema.nullable().optional(),
    medications: z.boolean().nullable().optional(),
    supplements: z.boolean().nullable().optional(),
    medicationAllergies: z.boolean().nullable().optional(),
    adverseMedicationOrSupplementEffects: z.boolean().nullable().optional(),
    physicalActivity: z.boolean().nullable().optional(),
  })
  .strict();

const PacienteCreateBody = z.object({
  nombres: z.string().min(1).max(120),
  apellidoPaterno: z.string().min(1).max(80),
  apellidoMaterno: z.string().max(80).optional().nullable(),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sexo: z.enum(SEXO_VALUES),
  genero: z.string().max(80).optional().nullable(),
  estadoCivil: z.string().max(40).optional().nullable(),
  ocupacion: z.string().max(120).optional().nullable(),
  escolaridad: z.string().max(80).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  telefono: z.string().max(40).optional().nullable(),
  telefonoSecundario: z.string().max(40).optional().nullable(),
  whatsappHabilitado: z.boolean().optional().nullable(),
  numeroExpedienteExterno: z.string().max(100).optional().nullable(),
  motivoIngreso: z.string().max(500).optional().nullable(),
  fotoUrl: PatientPhotoSchema.optional().nullable(),
  tamizajeMedico: MedicalIntakeSchema.optional().nullable(),
  contactoEmergenciaNombre: z.string().max(200).optional().nullable(),
  contactoEmergenciaParentesco: z.string().max(60).optional().nullable(),
  contactoEmergenciaTelefono: z.string().max(40).optional().nullable(),
  notasGenerales: z.string().max(2000).optional().nullable(),
  profesionalTitularId: z.string().uuid().optional().nullable(),
});

const PacienteUpdateBody = PacienteCreateBody.partial().extend({
  status: z.enum(ESTADO_VALUES).optional(),
});

interface PacienteRow {
  id: string;
  sucursal_id: string;
  profesional_titular_id: string | null;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  fecha_nacimiento: Date;
  sexo: string;
  genero: string | null;
  estado_civil: string | null;
  ocupacion: string | null;
  escolaridad: string | null;
  email: string | null;
  telefono: string | null;
  telefono_secundario: string | null;
  whatsapp_habilitado: boolean | null;
  numero_expediente_externo: string | null;
  motivo_ingreso: string | null;
  foto_url: string | null;
  tamizaje_medico_json: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_parentesco: string | null;
  contacto_emergencia_telefono: string | null;
  notas_generales: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  row_version: Buffer;
}

function rowToPaciente(row: PacienteRow): Record<string, unknown> {
  return {
    id: row.id,
    sucursalId: row.sucursal_id,
    profesionalTitularId: row.profesional_titular_id,
    nombres: row.nombres,
    apellidoPaterno: row.apellido_paterno,
    apellidoMaterno: row.apellido_materno,
    fechaNacimiento: row.fecha_nacimiento.toISOString().slice(0, 10),
    sexo: row.sexo,
    genero: row.genero,
    estadoCivil: row.estado_civil,
    ocupacion: row.ocupacion,
    escolaridad: row.escolaridad,
    email: row.email,
    telefono: row.telefono,
    telefonoSecundario: row.telefono_secundario,
    whatsappHabilitado: row.whatsapp_habilitado,
    numeroExpedienteExterno: row.numero_expediente_externo,
    motivoIngreso: row.motivo_ingreso,
    fotoUrl: row.foto_url,
    tamizajeMedico: parseJsonObject(row.tamizaje_medico_json),
    contactoEmergenciaNombre: row.contacto_emergencia_nombre,
    contactoEmergenciaParentesco: row.contacto_emergencia_parentesco,
    contactoEmergenciaTelefono: row.contacto_emergencia_telefono,
    notasGenerales: row.notas_generales,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function canMutate(rol: string): boolean {
  return ["admin", "nutriologa", "asistente"].includes(rol);
}

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const SELECT_PACIENTE = `
  SELECT id, sucursal_id, profesional_titular_id, nombres, apellido_paterno, apellido_materno,
         fecha_nacimiento, sexo, genero, estado_civil, ocupacion, escolaridad, email, telefono,
         telefono_secundario, whatsapp_habilitado, numero_expediente_externo, motivo_ingreso, foto_url,
         tamizaje_medico_json,
         contacto_emergencia_nombre, contacto_emergencia_parentesco,
         contacto_emergencia_telefono, notas_generales, status, created_at, updated_at, row_version
    FROM pacientes
   WHERE deleted_at IS NULL`;

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
      .query<PacienteRow>(
        `${SELECT_PACIENTE} AND sucursal_id = @sucursal_id ORDER BY apellido_paterno, apellido_materno, nombres`,
      );
    res.json({ pacientes: result.recordset.map(rowToPaciente) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ error: "id debe ser UUID" });
      return;
    }
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier(), id)
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
      .query<PacienteRow>(
        `${SELECT_PACIENTE} AND id = @id AND sucursal_id = @sucursal_id`,
      );
    if (result.recordset.length === 0) {
      res.status(404).json({ error: "Paciente no encontrado" });
      return;
    }
    res.json(rowToPaciente(result.recordset[0]!));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canMutate(req.user.rol)) {
      throw new ForbiddenError("Rol sin permisos para crear pacientes");
    }
    const body = PacienteCreateBody.parse(req.body);
    const sucursalId = String(req.sucursalId);
    const { randomUUID } = await import("node:crypto");
    const id = randomUUID();
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.UniqueIdentifier(), id)
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
      .input(
        "profesional_titular_id",
        sql.UniqueIdentifier(),
        body.profesionalTitularId ?? req.user.sub,
      )
      .input("nombres", sql.NVarChar(120), body.nombres)
      .input("apellido_paterno", sql.NVarChar(80), body.apellidoPaterno)
      .input("apellido_materno", sql.NVarChar(80), body.apellidoMaterno ?? null)
      .input("fecha_nacimiento", sql.Date(), body.fechaNacimiento)
      .input("sexo", sql.NVarChar(20), body.sexo)
      .input("genero", sql.NVarChar(80), body.genero ?? null)
      .input("estado_civil", sql.NVarChar(40), body.estadoCivil ?? null)
      .input("ocupacion", sql.NVarChar(120), body.ocupacion ?? null)
      .input("escolaridad", sql.NVarChar(80), body.escolaridad ?? null)
      .input("email", sql.NVarChar(200), body.email ?? null)
      .input("telefono", sql.NVarChar(40), body.telefono ?? null)
      .input(
        "telefono_secundario",
        sql.NVarChar(40),
        body.telefonoSecundario ?? null,
      )
      .input("whatsapp_habilitado", sql.Bit(), body.whatsappHabilitado ?? null)
      .input(
        "numero_expediente_externo",
        sql.NVarChar(100),
        body.numeroExpedienteExterno ?? null,
      )
      .input("motivo_ingreso", sql.NVarChar(500), body.motivoIngreso ?? null)
      .input(
        "foto_url",
        sql.NVarChar(sql.MAX),
        validatePatientPhotoValue(body.fotoUrl),
      )
      .input(
        "tamizaje_medico_json",
        sql.NVarChar(sql.MAX),
        body.tamizajeMedico ? JSON.stringify(body.tamizajeMedico) : null,
      )
      .input(
        "contacto_emergencia_nombre",
        sql.NVarChar(200),
        body.contactoEmergenciaNombre ?? null,
      )
      .input(
        "contacto_emergencia_parentesco",
        sql.NVarChar(60),
        body.contactoEmergenciaParentesco ?? null,
      )
      .input(
        "contacto_emergencia_telefono",
        sql.NVarChar(40),
        body.contactoEmergenciaTelefono ?? null,
      )
      .input(
        "notas_generales",
        sql.NVarChar(sql.MAX),
        body.notasGenerales ?? null,
      )
      .query(
        `INSERT INTO pacientes
           (id, sucursal_id, profesional_titular_id, nombres, apellido_paterno, apellido_materno,
            fecha_nacimiento, sexo, genero, estado_civil, ocupacion, escolaridad, email, telefono,
             telefono_secundario, whatsapp_habilitado, numero_expediente_externo, motivo_ingreso, foto_url,
             tamizaje_medico_json,
            contacto_emergencia_nombre, contacto_emergencia_parentesco,
            contacto_emergencia_telefono, notas_generales)
         VALUES
           (@id, @sucursal_id, @profesional_titular_id, @nombres, @apellido_paterno, @apellido_materno,
            @fecha_nacimiento, @sexo, @genero, @estado_civil, @ocupacion, @escolaridad, @email, @telefono,
             @telefono_secundario, @whatsapp_habilitado, @numero_expediente_externo, @motivo_ingreso, @foto_url,
             @tamizaje_medico_json,
            @contacto_emergencia_nombre, @contacto_emergencia_parentesco,
            @contacto_emergencia_telefono, @notas_generales)`,
      );
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/:id/expediente",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pacienteId = String(req.params.id);
      if (!UUID_REGEX.test(pacienteId)) {
        res.status(400).json({ error: "id debe ser UUID" });
        return;
      }
      const sucursalId = String(req.sucursalId);
      const pool = await getPool();
      const pacienteResult = await pool
        .request()
        .input("id", sql.UniqueIdentifier(), pacienteId)
        .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
        .query<PacienteRow>(
          `${SELECT_PACIENTE} AND id = @id AND sucursal_id = @sucursal_id`,
        );
      if (pacienteResult.recordset.length === 0) {
        res.status(404).json({ error: "Paciente no encontrado" });
        return;
      }
      const [
        consultas,
        antropometrias,
        planes,
        labs,
        adherencia,
        consentimientos,
        messages,
        mealPhotos,
      ] = await Promise.all([
        pool
          .request()
          .input("paciente_id", sql.UniqueIdentifier(), pacienteId)
          .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
          .query(
            `SELECT id, fecha_consulta, subjective, objective, assessment, plan, created_at FROM consultas WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY fecha_consulta DESC`,
          ),
        pool
          .request()
          .input("paciente_id", sql.UniqueIdentifier(), pacienteId)
          .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
          .query(
            `SELECT id, fecha, peso, talla, imc, cintura, cadera, porcentaje_grasa, created_at FROM antropometrias WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY fecha DESC`,
          ),
        pool
          .request()
          .input("paciente_id", sql.UniqueIdentifier(), pacienteId)
          .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
          .query(
            `SELECT id, nombre, tipo, objetivo_calorico, created_at FROM planes WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY created_at DESC`,
          ),
        pool
          .request()
          .input("paciente_id", sql.UniqueIdentifier(), pacienteId)
          .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
          .query(
            `SELECT id, panel, fecha, created_at FROM lab_panels WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY fecha DESC`,
          ),
        pool
          .request()
          .input("paciente_id", sql.UniqueIdentifier(), pacienteId)
          .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
          .query(
            `SELECT id, fecha, source, puntuacion FROM adherence_records WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY fecha DESC`,
          ),
        pool
          .request()
          .input("paciente_id", sql.UniqueIdentifier(), pacienteId)
          .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
          .query(
            `SELECT id, tipo, titulo, version, aceptado, fecha_aceptacion, created_at FROM consentimientos WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY created_at DESC`,
          ),
        pool
          .request()
          .input("paciente_id", sql.UniqueIdentifier(), pacienteId)
          .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
          .query(
            `SELECT id, remitente, contenido, leido, created_at FROM patient_portal_messages WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY created_at DESC`,
          ),
        pool
          .request()
          .input("paciente_id", sql.UniqueIdentifier(), pacienteId)
          .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
          .query(
            `SELECT id, meal_date, meal_slot, caption, adherence_rating, mime_type, created_at FROM patient_portal_meal_photos WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY meal_date DESC`,
          ),
      ]);
      res.json({
        paciente: rowToPaciente(pacienteResult.recordset[0]),
        consultas: consultas.recordset,
        antropometrias: antropometrias.recordset,
        planes: planes.recordset,
        laboratorios: labs.recordset,
        adherencia: adherencia.recordset,
        consentimientos: consentimientos.recordset,
        mensajesPortal: messages.recordset,
        fotosComidasPortal: mealPhotos.recordset,
        exportadoEn: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canMutate(req.user.rol)) {
      throw new ForbiddenError("Rol sin permisos para actualizar pacientes");
    }
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ error: "id debe ser UUID" });
      return;
    }
    const body = PacienteUpdateBody.parse(req.body);
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    const existing = await pool
      .request()
      .input("id", sql.UniqueIdentifier(), id)
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
      .query<{
        id: string;
      }>(`SELECT id FROM pacientes WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`);
    if (existing.recordset.length === 0) {
      res.status(404).json({ error: "Paciente no encontrado" });
      return;
    }
    const sets: string[] = [];
    const r = pool
      .request()
      .input("id", sql.UniqueIdentifier(), id)
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId);
    const map: Record<
      string,
      { col: string; type: sql.ISqlType; val: unknown }
    > = {
      nombres: { col: "nombres", type: sql.NVarChar(120), val: body.nombres },
      apellidoPaterno: {
        col: "apellido_paterno",
        type: sql.NVarChar(80),
        val: body.apellidoPaterno,
      },
      apellidoMaterno: {
        col: "apellido_materno",
        type: sql.NVarChar(80),
        val: body.apellidoMaterno,
      },
      fechaNacimiento: {
        col: "fecha_nacimiento",
        type: sql.Date(),
        val: body.fechaNacimiento,
      },
      sexo: { col: "sexo", type: sql.NVarChar(20), val: body.sexo },
      genero: { col: "genero", type: sql.NVarChar(80), val: body.genero },
      estadoCivil: {
        col: "estado_civil",
        type: sql.NVarChar(40),
        val: body.estadoCivil,
      },
      ocupacion: {
        col: "ocupacion",
        type: sql.NVarChar(120),
        val: body.ocupacion,
      },
      escolaridad: {
        col: "escolaridad",
        type: sql.NVarChar(80),
        val: body.escolaridad,
      },
      email: { col: "email", type: sql.NVarChar(200), val: body.email },
      telefono: { col: "telefono", type: sql.NVarChar(40), val: body.telefono },
      telefonoSecundario: {
        col: "telefono_secundario",
        type: sql.NVarChar(40),
        val: body.telefonoSecundario,
      },
      whatsappHabilitado: {
        col: "whatsapp_habilitado",
        type: sql.Bit(),
        val: body.whatsappHabilitado,
      },
      numeroExpedienteExterno: {
        col: "numero_expediente_externo",
        type: sql.NVarChar(100),
        val: body.numeroExpedienteExterno,
      },
      motivoIngreso: {
        col: "motivo_ingreso",
        type: sql.NVarChar(500),
        val: body.motivoIngreso,
      },
      fotoUrl: {
        col: "foto_url",
        type: sql.NVarChar(sql.MAX),
        val:
          body.fotoUrl == null ? null : validatePatientPhotoValue(body.fotoUrl),
      },
      tamizajeMedico: {
        col: "tamizaje_medico_json",
        type: sql.NVarChar(sql.MAX),
        val: body.tamizajeMedico
          ? JSON.stringify(body.tamizajeMedico)
          : body.tamizajeMedico,
      },
      profesionalTitularId: {
        col: "profesional_titular_id",
        type: sql.UniqueIdentifier(),
        val: body.profesionalTitularId,
      },
      contactoEmergenciaNombre: {
        col: "contacto_emergencia_nombre",
        type: sql.NVarChar(200),
        val: body.contactoEmergenciaNombre,
      },
      contactoEmergenciaParentesco: {
        col: "contacto_emergencia_parentesco",
        type: sql.NVarChar(60),
        val: body.contactoEmergenciaParentesco,
      },
      contactoEmergenciaTelefono: {
        col: "contacto_emergencia_telefono",
        type: sql.NVarChar(40),
        val: body.contactoEmergenciaTelefono,
      },
      notasGenerales: {
        col: "notas_generales",
        type: sql.NVarChar(sql.MAX),
        val: body.notasGenerales,
      },
      status: { col: "status", type: sql.NVarChar(20), val: body.status },
    };
    for (const [key, def] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[key] !== undefined) {
        sets.push(`${def.col} = @${key}`);
        r.input(key, def.type, def.val ?? null);
      }
    }
    if (sets.length === 0) {
      res.json({ updated: 0 });
      return;
    }
    await r.query(
      `UPDATE pacientes SET ${sets.join(", ")}, updated_at = SYSUTCDATETIME() WHERE id = @id AND sucursal_id = @sucursal_id`,
    );
    res.json({ updated: 1 });
  } catch (err) {
    next(err);
  }
});

router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !["admin", "nutriologa"].includes(req.user.rol)) {
        throw new ForbiddenError(
          "Solo admin o nutriologa pueden archivar pacientes",
        );
      }
      const id = String(req.params.id);
      if (!UUID_REGEX.test(id)) {
        res.status(400).json({ error: "id debe ser UUID" });
        return;
      }
      const sucursalId = String(req.sucursalId);
      const pool = await getPool();
      const result = await pool
        .request()
        .input("id", sql.UniqueIdentifier(), id)
        .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
        .query(
          `UPDATE pacientes SET deleted_at = SYSUTCDATETIME(), status = 'archived' WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
        );
      res.json({ archived: result.rowsAffected[0] ?? 0 });
    } catch (err) {
      next(err);
    }
  },
);

import consentimientoRouter from "./consentimientoRoutes.js";

router.use("/:pacienteId/substitutions", pacienteSubstitutionRouter);
router.use("/:pacienteId/consentimientos", consentimientoRouter);

export default router;

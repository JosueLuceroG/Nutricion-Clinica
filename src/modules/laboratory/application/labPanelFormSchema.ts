import { z } from "zod";
import { LAB_TEST_CODES } from "../domain/LabTest";

const optionalLabValue = z
  .union([
    z.literal(""),
    z.coerce
      .number({ invalid_type_error: "Debe ser un número" })
      .positive("Debe ser positivo")
      .max(100000, "Valor demasiado alto"),
  ])
  .optional();

const labTestValuesSchema = LAB_TEST_CODES.reduce(
  (acc, code) => {
    acc[code] = optionalLabValue;
    return acc;
  },
  {} as Record<(typeof LAB_TEST_CODES)[number], typeof optionalLabValue>,
);

export const LabPanelFormSchema = z
  .object({
    takenAt: z
      .string()
      .min(1, "Requerido")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida")
      .refine(
        (v) => new Date(v).getTime() <= Date.now() + 24 * 60 * 60 * 1000,
        "No puede estar en el futuro",
      ),
    labName: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
    notes: z.string().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
    ...labTestValuesSchema,
  })
  .strict()
  .refine(
    (v) => LAB_TEST_CODES.some((code) => typeof v[code] === "number" && Number.isFinite(v[code])),
    { message: "Captura al menos un valor de laboratorio", path: ["takenAt"] },
  );

export type LabPanelFormValues = z.infer<typeof LabPanelFormSchema>;

const buildEmptyDefaults = (): LabPanelFormValues => ({
  takenAt: new Date().toISOString().slice(0, 10),
  labName: "",
  notes: "",
  ...LAB_TEST_CODES.reduce(
    (acc, code) => ({ ...acc, [code]: "" }),
    {} as Record<(typeof LAB_TEST_CODES)[number], "" | number>,
  ),
});

export const labPanelFormDefaultValues: LabPanelFormValues = buildEmptyDefaults();

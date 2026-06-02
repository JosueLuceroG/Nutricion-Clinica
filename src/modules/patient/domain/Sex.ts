import { z } from "zod";

export const SexSchema = z.enum(["female", "male", "intersex", "undisclosed"]);

export type Sex = z.infer<typeof SexSchema>;

export const SexLabel: Record<Sex, string> = {
  female: "Femenino",
  male: "Masculino",
  intersex: "Intersexual",
  undisclosed: "Prefiero no decir",
};

export const SexShort: Record<Sex, string> = {
  female: "F",
  male: "M",
  intersex: "I",
  undisclosed: "—",
};

export function isSex(value: unknown): value is Sex {
  return SexSchema.safeParse(value).success;
}

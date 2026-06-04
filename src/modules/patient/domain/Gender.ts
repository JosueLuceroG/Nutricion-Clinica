import { z } from "zod";

export const GenderSchema = z.enum(["woman", "man", "non_binary", "undisclosed", "other"]);

export type Gender = z.infer<typeof GenderSchema>;

export const GenderLabel: Record<Gender, string> = {
  woman: "Mujer",
  man: "Hombre",
  non_binary: "No binario",
  undisclosed: "Prefiero no decir",
  other: "Otro",
};

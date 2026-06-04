import { z } from "zod";

export const MaritalStatusSchema = z.enum(["single", "married", "divorced", "widowed", "cohabiting"]);

export type MaritalStatus = z.infer<typeof MaritalStatusSchema>;

export const MaritalStatusLabel: Record<MaritalStatus, string> = {
  single: "Soltero/a",
  married: "Casado/a",
  divorced: "Divorciado/a",
  widowed: "Viudo/a",
  cohabiting: "Unión libre",
};

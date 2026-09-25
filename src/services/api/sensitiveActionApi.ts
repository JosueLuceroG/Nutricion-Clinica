import type {
  ConsumeSensitiveActionGrantRequest,
  SensitiveActionGrantRequest,
  SensitiveActionGrantResponse,
} from "@nutriclinica/shared";
import { httpRequest } from "./httpClient.js";

export const sensitiveActionApi = {
  authorize(
    input: SensitiveActionGrantRequest,
  ): Promise<SensitiveActionGrantResponse> {
    return httpRequest("/auth/sensitive-action-grants", {
      method: "POST",
      body: input,
      skipSucursalHeader: true,
    });
  },

  consume(
    input: ConsumeSensitiveActionGrantRequest,
  ): Promise<{ authorized: true }> {
    return httpRequest("/auth/sensitive-action-grants/consume", {
      method: "POST",
      body: input,
      skipSucursalHeader: true,
    });
  },
};

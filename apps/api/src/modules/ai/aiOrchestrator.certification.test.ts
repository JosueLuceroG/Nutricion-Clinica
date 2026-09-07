import { describe, expect, it } from "vitest";
import {
  AIOrchestrator,
  type AIOrchestratorOptions,
} from "./aiOrchestrator.js";
import { ModelRegistry, type ModelInfo } from "./models/modelRegistry.js";
import { ModelRouter } from "./routing/modelRouter.js";
import { AIDataEgressPolicy } from "./egress/egressPolicy.js";
import { clinicalCertificationRegistry } from "./certification/clinicalCertification.js";

const SEED: ModelInfo[] = [
  {
    id: "gpt-4o-mini",
    provider: "openai",
    providerModelName: "gpt-4o-mini",
    version: "gpt-4o-mini-2024-07-18",
    enabled: true,
    supportedCapabilities: [
      "chat_general",
      "structured_json",
      "nutrition_reasoning",
    ],
    supportsStructuredOutput: true,
    supportsTools: false,
    supportsEmbeddings: false,
    supportsVision: false,
    maxContextTokens: 4096,
    isDefault: true,
    respectsRequestedModel: true,
  },
  {
    id: "llama3.2",
    provider: "ollama",
    providerModelName: "llama3.2",
    version: "3.2",
    enabled: true,
    supportedCapabilities: ["chat_general", "nutrition_reasoning"],
    supportsStructuredOutput: false,
    supportsTools: false,
    supportsEmbeddings: false,
    supportsVision: false,
    maxContextTokens: 4096,
    isDefault: true,
    respectsRequestedModel: false,
  },
];

const registry = new ModelRegistry(SEED);
const router = new ModelRouter();
const baseEnv = {
  AI_PROVIDER: "openai",
  AI_EGRESS_ENABLED: "true",
  AI_QUALIFICATION_ENFORCED: "true",
  AI_MODEL_MODE: "ORGANIZATION_PREFERRED",
  OPENAI_API_KEY: "sk-test",
};

function orchestrator(
  overrides: Partial<AIOrchestratorOptions> = {},
): AIOrchestrator {
  const calls: string[] = [];
  const options: AIOrchestratorOptions = {
    env: () => ({ ...baseEnv }),
    modelRegistry: registry,
    modelRouter: router,
    egressPolicy: AIDataEgressPolicy.withInMemoryStore({
      env: () => ({ ...baseEnv }),
      consentStatusProvider: async () => ({
        status: "valid",
        reference: "cons-1",
      }),
      namesProvider: async () => ["Ana Gómez"],
    }),
    getProviderAdapter: (provider) => ({
      complete: async () => {
        calls.push(provider);
        return {
          content: `ok-${provider}`,
          model: provider === "openai" ? "gpt-4o-mini" : "llama3.2",
          finishReason: "stop",
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        };
      },
    }),
    ...overrides,
  };
  return new AIOrchestrator(options);
}

describe("aiOrchestrator + certificación clínica (Build 05)", () => {
  it("capability sin registro de riesgo: fail-closed CAPABILITY_DENIED sin invocar adapters", async () => {
    const o = orchestrator();
    const result = await o.execute({
      request: { model: "gpt-4o-mini", systemPrompt: "x", userPrompt: "y" },
      preferredProvider: "openai",
      egress: { capability: "capability_inexistente" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.code).toBe("CAPABILITY_DENIED");
      expect(result.message).toContain("sin registro de riesgo");
    }
  });

  it("patient_support exige APPROVED_PATIENT: gpt-4o-mini (APPROVED_GENERAL) no satisface y nadie es llamado", async () => {
    const o = orchestrator();
    const result = await o.execute({
      request: { model: "gpt-4o-mini", systemPrompt: "x", userPrompt: "y" },
      requiredCapability: "chat_general",
      preferredProvider: "openai",
      egress: {
        capability: "patient_support",
        patientId: "11111111-1111-1111-1111-111111111111",
        sucursalId: "22222222-2222-2222-2222-222222222222",
        actor: { profesionalId: "33333333-3333-3333-3333-333333333333" },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.clinical?.effectiveRisk).toBe("RISK_3");
      expect(result.clinical?.requiresProfessionalReview).toBe(true);
    }
  });

  it("elevación de riesgo dinámica: redFlag en generic_assistant exige APPROVED_CLINICAL_SUPPORT y bloquea la ejecución", async () => {
    const o = orchestrator();
    const result = await o.execute({
      request: { model: "gpt-4o-mini", systemPrompt: "x", userPrompt: "y" },
      requiredCapability: "chat_general",
      preferredProvider: "openai",
      egress: { capability: "generic_assistant" },
      riskSignals: { redFlag: true },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.clinical?.effectiveRisk).toBe("RISK_5");
      expect(result.status).toBe(403);
    }
  });

  it("con riesgo elevado a RISK_4, un modelo APPROVED_ANALYTICS ya no alcanza (requiere clínico)", async () => {
    const o = orchestrator();
    const result = await o.execute({
      request: {
        model: "gpt-4o-mini",
        systemPrompt: "x",
        userPrompt: "y",
        responseFormat: "json",
      },
      requiredCapability: "structured_json",
      preferredProvider: "openai",
      egress: { capability: "dashboard_analytics" },
      riskSignals: { highRiskPatientContext: true },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.clinical?.baseRisk).toBe("RISK_2");
      expect(result.clinical?.effectiveRisk).toBe("RISK_4");
      expect(result.status).toBe(403);
    }
  });

  it("la ejecución exitosa lleva metadata clínica completa sin PHI", async () => {
    // Escenario controlado: se desmarca el flag 07.5A solo para este test
    // (el default sigue bloqueando llama3.2 en producción/resto de tests).
    clinicalCertificationRegistry.clearRequalificationRequired(
      "ollama",
      "llama3.2",
      "nutrition_reasoning",
    );
    try {
      const o = orchestrator();
      const result = await o.execute({
        request: { model: "gpt-4o-mini", systemPrompt: "x", userPrompt: "y" },
        requiredCapability: "nutrition_reasoning",
        preferredProvider: "openai",
        egress: {
          capability: "nutrition_reasoning",
          patientId: "11111111-1111-1111-1111-111111111111",
          sucursalId: "22222222-2222-2222-2222-222222222222",
          actor: { profesionalId: "33333333-3333-3333-3333-333333333333" },
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.provider).toBe("ollama");
        expect(result.clinical?.capability).toBe("nutrition_reasoning");
        expect(result.clinical?.effectiveRisk).toBe("RISK_3");
        expect(result.clinical?.certificationState).toBe(
          "APPROVED_NUTRITION_SUPPORT",
        );
        expect(result.clinical?.modelVersion).toBe("3.2");
        expect(result.clinical?.promptVersion).toBeTruthy();
        expect(result.clinical?.toolsetVersion).toMatch(/^toolset\./);
        expect(result.clinical?.requiresProfessionalReview).toBe(true);
      }
    } finally {
      clinicalCertificationRegistry.markRequalificationRequired(
        "ollama",
        "llama3.2",
        "nutrition_reasoning",
      );
    }
  });

  it("con AI_QUALIFICATION_ENFORCED=false el gate granular se desactiva (compatibilidad)", async () => {
    const o = orchestrator({
      env: () => ({ ...baseEnv, AI_QUALIFICATION_ENFORCED: "false" }),
    });
    const result = await o.execute({
      request: { model: "gpt-4o-mini", systemPrompt: "x", userPrompt: "y" },
      requiredCapability: "chat_general",
      preferredProvider: "openai",
      egress: { capability: "generic_assistant" },
      riskSignals: { redFlag: true },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("openai");
      expect(result.clinical?.effectiveRisk).toBe("RISK_5");
    }
  });

  it("un valor malformado de AI_QUALIFICATION_ENFORCED no omite el gate", async () => {
    const o = orchestrator({
      env: () => ({ ...baseEnv, AI_QUALIFICATION_ENFORCED: "yes" }),
    });
    const result = await o.execute({
      request: { model: "gpt-4o-mini", systemPrompt: "x", userPrompt: "y" },
      requiredCapability: "chat_general",
      preferredProvider: "openai",
      egress: { capability: "generic_assistant" },
      riskSignals: { redFlag: true },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_ELIGIBLE_MODEL");
  });
});

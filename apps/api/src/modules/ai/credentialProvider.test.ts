import { describe, expect, it } from "vitest";
import { CredentialProvider, getAIProvider } from "./credentialProvider.js";

describe("CredentialProvider deployment config", () => {
  it("does not read browser-prefixed provider configuration", () => {
    expect(getAIProvider({ VITE_AI_PROVIDER: "ollama" })).toBe("openai");
    expect(getAIProvider({ AI_PROVIDER: "ollama" })).toBe("ollama");
    expect(getAIProvider({ AI_PROVIDER: " ollama " })).toBe("ollama");
  });

  it("uses independent OpenAI and Ollama endpoints", () => {
    const provider = new CredentialProvider({
      OPENAI_BASE_URL: "https://openai.example.test/v1/",
      OLLAMA_BASE_URL: "http://ollama.internal:11434",
    });
    expect(provider.getBaseUrl("openai")).toBe(
      "https://openai.example.test/v1",
    );
    expect(provider.getBaseUrl("ollama")).toBe(
      "http://ollama.internal:11434/v1",
    );
  });
});

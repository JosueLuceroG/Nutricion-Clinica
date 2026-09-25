import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, sendEmail } from "./emailService.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("email deployment safety", () => {
  it("escapes all HTML-significant characters in dynamic email content", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')"> &`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp;",
    );
  });

  it("defaults to disabled and never logs recipient or subject", async () => {
    vi.stubEnv("ENVIRONMENT_CLASS", "STAGING");
    vi.stubEnv("EXTERNAL_SIDE_EFFECTS_MODE", "DISABLED");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const result = await sendEmail({
      to: "synthetic.patient@example.test",
      subject: "PHI_DEPLOYMENT_MARKER_6f6db2",
      html: "<p>synthetic</p>",
    });
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic.patient");
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      "PHI_DEPLOYMENT_MARKER",
    );
  });

  it("does not honor production mode outside PRODUCTION", async () => {
    vi.stubEnv("ENVIRONMENT_CLASS", "STAGING");
    vi.stubEnv("EXTERNAL_SIDE_EFFECTS_MODE", "PRODUCTION");
    const result = await sendEmail({
      to: "nobody@example.test",
      subject: "x",
      html: "x",
    });
    expect(result.messageId).toMatch(/^simulated-/);
    expect(result.simulated).toBe(true);
  });
});

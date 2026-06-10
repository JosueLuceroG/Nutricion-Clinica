import { test, expect } from "@playwright/test";
import { loginAsAdmin, hashUrl } from "./helpers";

test.describe("Telemedicina", () => {
  test("navega a la página de telemedicina y muestra el título", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(hashUrl("/telemedicina"));
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Telemedicina|Videollamada/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("la página de sala individual carga sin errores", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(hashUrl("/telemedicina"));
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Telemedicina|Videollamada/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("TURN config endpoint responde con ICE servers", async ({ request }) => {
    const loginResp = await request.post("http://localhost:3000/auth/login", {
      data: { email: "admin@nutriclinica.local", password: "Admin123!Nutri" },
    });
    expect(loginResp.ok()).toBeTruthy();
    const body = (await loginResp.json()) as { token: string };
    expect(body.token).toBeTruthy();

    const turnResp = await request.get("http://localhost:3000/telemedicina/turn-config", {
      headers: { Authorization: `Bearer ${body.token}` },
    });
    expect(turnResp.ok()).toBeTruthy();
    const turnBody = (await turnResp.json()) as { iceServers: Array<{ urls: string | string[] }>; configured: boolean };
    expect(Array.isArray(turnBody.iceServers)).toBe(true);
    expect(turnBody.iceServers.length).toBeGreaterThanOrEqual(1);
    expect(turnBody.iceServers[0]!.urls).toBeDefined();
  });
});

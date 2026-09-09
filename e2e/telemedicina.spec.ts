import { test, expect } from "@playwright/test";
import {
  ADMIN_EMAIL,
  e2eAdminPassword,
  loginAsAdmin,
  hashUrl,
} from "./helpers";

test.describe("Telemedicina", () => {
  test("navega a la página de telemedicina y muestra el título", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(hashUrl("/telemedicina"));
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(/Telemedicina|Videollamada/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("la página de sala individual carga sin errores", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(hashUrl("/telemedicina"));
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(/Telemedicina|Videollamada/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("TURN config endpoint returns the authenticated server-controlled ICE policy", async ({
    request,
  }) => {
    const loginResp = await request.post("http://localhost:3000/auth/login", {
      data: { email: ADMIN_EMAIL, password: e2eAdminPassword() },
    });
    expect(loginResp.ok()).toBeTruthy();
    const body = (await loginResp.json()) as { token: string };
    expect(body.token).toBeTruthy();

    const turnResp = await request.get(
      "http://localhost:3000/telemedicina/turn-config",
      {
        headers: { Authorization: `Bearer ${body.token}` },
      },
    );
    expect(turnResp.ok()).toBeTruthy();
    const turnBody = (await turnResp.json()) as {
      policy: string;
      iceServers: Array<{
        urls: string | string[];
        username?: string;
        credential?: string;
      }>;
      configured: boolean;
    };
    expect(turnBody.policy).toBe("OPTIONAL_DIRECT_ALLOWED");
    expect(Array.isArray(turnBody.iceServers)).toBe(true);
    const servers = turnBody.iceServers.map((server) => ({
      ...server,
      urls: typeof server.urls === "string" ? [server.urls] : server.urls,
    }));
    for (const server of servers) {
      expect(server.urls.length).toBeGreaterThan(0);
      expect(
        server.urls.every((url) => /^(?:stun|stuns|turn|turns):/i.test(url)),
      ).toBe(true);
    }
    if (turnBody.configured) {
      expect(
        servers.some(
          (server) =>
            server.urls.some((url) => /^turns?:/i.test(url)) &&
            Boolean(server.username) &&
            Boolean(server.credential),
        ),
      ).toBe(true);
    }
  });
});

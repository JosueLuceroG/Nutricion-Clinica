import { expect, test } from "@playwright/test";
import { fakeLogin, hashUrl } from "./helpers";

test("precarga Consultas y conserva el shell durante la navegación", async ({
  page,
}) => {
  await fakeLogin(page, "e2e-dashboard-navigation");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(hashUrl("/"));
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 30_000,
  });

  const sidebar = page.locator(".nc-dashboard-sidebar");
  const consultationsLink = sidebar.getByRole("link", { name: "Consultas" });
  await sidebar.evaluate((element) =>
    element.setAttribute("data-navigation-shell-probe", "true"),
  );

  const consultationModuleRequest = page.waitForRequest((request) =>
    request.url().includes("ConsultationsListPage"),
  );
  await consultationsLink.hover();
  await consultationModuleRequest;

  const startedAt = Date.now();
  await consultationsLink.click();
  await expect(
    page.getByRole("heading", { name: "Consultas", exact: true }),
  ).toBeVisible();

  expect(Date.now() - startedAt).toBeLessThan(1_500);
  await expect(page).toHaveURL(/#\/consultas$/);
  await expect(page.locator('[data-navigation-shell-probe="true"]')).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { hashUrl } from "./helpers";

const PORTAL_TOKEN = "portal-demo-token-12345678901234567890";
const PORTAL_CACHE_TOKEN = "portal-cache-token-12345678901234567890";

function createCachedPortalPayload() {
  return {
    portal: {
      tokenId: "token-cacheado",
      sucursalId: "sucursal-centro",
      expiresAt: "2026-07-01T00:00:00.000Z",
      scopes: ["summary", "plan", "appointments", "documents", "adherence"],
    },
    patient: {
      id: "paciente-cache",
      fullName: "Paciente Cache",
      birthDate: "1992-02-02",
      sex: "female",
      email: "cache@example.test",
      phone: "555-0202",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    summary: {
      activePlanName: "Plan cacheado offline",
      nextAppointmentAt: "2026-06-20T16:00:00.000Z",
      documentsCount: 0,
    },
    activePlan: {
      id: "plan-cache",
      name: "Plan cacheado offline",
      description: "Plan disponible desde cache local.",
      startDate: "2026-06-10",
      endDate: "2026-07-10",
      kcalTarget: 1800,
      proteinTargetG: 90,
      carbsTargetG: 210,
      fatTargetG: 55,
      meals: [
        {
          slot: "breakfast",
          exchanges: [{ foodId: "cereal-tortilla-maiz", count: 1 }],
        },
      ],
      notes: "Ultima version guardada.",
      status: "active",
      updatedAt: "2026-06-10T00:00:00.000Z",
    },
    upcomingAppointments: [],
    documents: [],
  };
}

function createCachedNotificationsPayload() {
  return {
    notifications: [
      {
        id: "notif-cache",
        type: "appointment_reminder",
        to: "cache@example.test",
        subject: "Recordatorio cacheado",
        error: null,
        sentAt: "2026-06-19T10:00:00.000Z",
      },
    ],
  };
}

test.describe("Patient portal", () => {
  test("ruta publica muestra resumen, plan, citas, documentos y envia adherencia sin login", async ({
    page,
  }) => {
    let adherenceBody: unknown = null;
    let messageBody: unknown = null;
    let mealPhotoBody: Record<string, unknown> | null = null;
    let reminderRequests = 0;
    await page.route(
      "http://localhost:3000/patient-portal/**",
      async (route) => {
        const url = route.request().url();
        if (
          route.request().method() === "GET" &&
          url.endsWith("/messages")
        ) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              messages: [
                {
                  id: "msg-1",
                  tokenId: "token-publico",
                  pacienteId: "paciente-1",
                  sucursalId: "sucursal-centro",
                  profesionalId: "prof-1",
                  content: "Puedes escribirme tus dudas por aquí.",
                  direction: "professional_to_patient",
                  readAt: null,
                  createdAt: "2026-06-19T09:00:00.000Z",
                },
              ],
            }),
          });
          return;
        }

        if (
          route.request().method() === "POST" &&
          url.endsWith("/messages")
        ) {
          messageBody = route.request().postDataJSON();
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              message: {
                id: "msg-2",
                tokenId: "token-publico",
                pacienteId: "paciente-1",
                sucursalId: "sucursal-centro",
                profesionalId: null,
                content: "Tengo una duda sobre mi cena",
                direction: "patient_to_professional",
                readAt: null,
                createdAt: "2026-06-19T09:05:00.000Z",
              },
            }),
          });
          return;
        }

        if (
          route.request().method() === "GET" &&
          /\/meal-photos\/[^/]+\/image$/.test(new URL(url).pathname)
        ) {
          await route.fulfill({
            status: 200,
            contentType: "image/png",
            body: Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
              "base64",
            ),
          });
          return;
        }

        if (
          route.request().method() === "GET" &&
          url.endsWith("/meal-photos")
        ) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              mealPhotos: [
                {
                  id: "meal-photo-1",
                  tokenId: "token-publico",
                  pacienteId: "paciente-1",
                  sucursalId: "sucursal-centro",
                  mealDate: "2026-06-19",
                  mealSlot: "breakfast",
                  caption: "Avena con fruta",
                  adherenceRating: 4,
                  mimeType: "image/png",
                  fileName: "desayuno.png",
                  sizeBytes: 128,
                  sha256: "a".repeat(64),
                  reviewedAt: null,
                  reviewedByProfesionalId: null,
                  createdAt: "2026-06-19T08:00:00.000Z",
                  updatedAt: "2026-06-19T08:00:00.000Z",
                },
              ],
            }),
          });
          return;
        }

        if (
          route.request().method() === "POST" &&
          url.endsWith("/meal-photos")
        ) {
          mealPhotoBody = route.request().postDataJSON() as Record<string, unknown>;
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              mealPhoto: {
                id: "meal-photo-2",
                tokenId: "token-publico",
                pacienteId: "paciente-1",
                sucursalId: "sucursal-centro",
                mealDate: "2026-06-19",
                mealSlot: mealPhotoBody.mealSlot,
                caption: mealPhotoBody.caption,
                adherenceRating: mealPhotoBody.adherenceRating,
                mimeType: "image/jpeg",
                fileName: "cena.jpg",
                sizeBytes: 4,
                sha256: "b".repeat(64),
                reviewedAt: null,
                reviewedByProfesionalId: null,
                createdAt: "2026-06-19T21:00:00.000Z",
                updatedAt: "2026-06-19T21:00:00.000Z",
              },
            }),
          });
          return;
        }

        if (
          route.request().method() === "GET" &&
          url.endsWith("/notifications")
        ) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              notifications: [
                {
                  id: "notif-1",
                  type: "appointment_reminder",
                  to: "ana@example.test",
                  subject: "Recordatorio de cita - NutriClínica",
                  error: null,
                  sentAt: "2026-06-19T10:00:00.000Z",
                },
              ],
            }),
          });
          return;
        }

        if (
          route.request().method() === "POST" &&
          url.endsWith("/send-reminder")
        ) {
          reminderRequests++;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              sent: true,
              messageId: "simulated-1",
              to: "ana@example.test",
              appointmentDate: "2026-06-20T16:00:00.000Z",
            }),
          });
          return;
        }

        if (
          route.request().method() === "POST" &&
          route.request().url().endsWith("/adherence")
        ) {
          adherenceBody = route.request().postDataJSON();
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              record: { id: "adh-1", date: "2026-06-09" },
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            portal: {
              tokenId: "token-publico",
              sucursalId: "sucursal-centro",
              expiresAt: "2026-07-01T00:00:00.000Z",
              scopes: [
                "summary",
                "plan",
                "appointments",
                "documents",
                "adherence",
                "messaging",
                "meal_photos",
              ],
            },
            patient: {
              id: "paciente-1",
              fullName: "Ana Perez",
              birthDate: "1990-01-01",
              sex: "female",
              email: "ana@example.test",
              phone: "555-0101",
              updatedAt: "2026-06-01T00:00:00.000Z",
            },
            summary: {
              activePlanName: "Plan metabólico semanal",
              nextAppointmentAt: "2026-06-20T16:00:00.000Z",
              documentsCount: 1,
            },
            activePlan: {
              id: "plan-1",
              name: "Plan metabólico semanal",
              description: "Plan inicial de solo lectura.",
              startDate: "2026-06-10",
              endDate: "2026-07-10",
              kcalTarget: 1800,
              proteinTargetG: 90,
              carbsTargetG: 210,
              fatTargetG: 55,
              meals: [
                {
                  slot: "breakfast",
                  exchanges: [{ foodId: "cereal-tortilla-maiz", count: 2 }],
                },
                {
                  slot: "lunch",
                  exchanges: [{ foodId: "aoa-pechuga-pollo", count: 3 }],
                },
              ],
              notes: "Hidratarse durante el día.",
              status: "active",
              updatedAt: "2026-06-10T00:00:00.000Z",
            },
            upcomingAppointments: [
              {
                id: "consulta-1",
                consultationDate: "2026-06-20T16:00:00.000Z",
                status: "scheduled",
                reason: "Seguimiento mensual",
                nextVisitDate: null,
              },
            ],
            documents: [
              {
                id: "doc-1",
                type: "receta",
                fileName: "receta-nutricional.pdf",
                mimeType: "application/pdf",
                sizeBytes: 24576,
                url: "https://example.test/receta-nutricional.pdf",
                sha256: "a".repeat(64),
                documentDate: "2026-06-12",
                notes: null,
                createdAt: "2026-06-12T00:00:00.000Z",
              },
            ],
          }),
        });
      },
    );

    await page.goto(hashUrl(`/portal/${PORTAL_TOKEN}`));

    await expect(
      page.getByRole("heading", { name: /Portal del paciente/i }),
    ).toBeVisible();
    await expect(page.getByText("Hola, Ana")).toBeVisible();
    await expect(
      page.getByText("Plan metabólico semanal").first(),
    ).toBeVisible();
    await expect(page.getByText("Tortilla")).toBeVisible();
    await expect(page.getByText("Seguimiento mensual")).toBeVisible();
    await expect(page.getByText("receta-nutricional.pdf")).toBeVisible();
    await expect(page.getByText("Registro rápido de adherencia")).toBeVisible();
    await expect(page.getByText("Fotos de comidas").first()).toBeVisible();
    await expect(page.getByText("Avena con fruta")).toBeVisible();
    await expect(page.getByText("Mensajes con tu nutrióloga")).toBeVisible();
    await expect(page.getByText("Puedes escribirme tus dudas por aquí.")).toBeVisible();
    await expect(
      page.getByText("Recordatorio de cita - NutriClínica"),
    ).toBeVisible();

    await page.getByPlaceholder("Escribe tu mensaje...").fill("Tengo una duda sobre mi cena");
    await page.getByPlaceholder("Escribe tu mensaje...").press("Enter");
    await expect(page.getByText("Tengo una duda sobre mi cena")).toBeVisible();
    expect(messageBody).toMatchObject({ content: "Tengo una duda sobre mi cena" });

    await page.locator("#portal-meal-photo-file").setInputFiles({
      name: "cena.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    await page.getByLabel("Descripción o comentarios").fill("Cena con verduras");
    await page.locator("#portal-meal-photo-rating").fill("5");
    await page.getByRole("button", { name: /Enviar comida/i }).click();
    await expect(page.getByText(/Comida enviada/i)).toBeVisible();
    expect(mealPhotoBody).toMatchObject({
      mealSlot: "breakfast",
      caption: "Cena con verduras",
      adherenceRating: 5,
      fileName: "cena.jpg",
    });
    expect(String(mealPhotoBody?.photoDataUrl)).toContain("data:image/jpeg;base64,");

    await page
      .getByRole("button", { name: /Enviar recordatorio por correo/i })
      .click();
    await expect(page.getByText(/Recordatorio enviado/i)).toBeVisible();
    expect(reminderRequests).toBe(1);

    await page
      .getByLabel("Barreras o dificultades")
      .fill("Poco tiempo para cocinar");
    await page.getByRole("button", { name: /Enviar adherencia/i }).click();
    await expect(page.getByText(/Registro enviado/i)).toBeVisible();
    expect(adherenceBody).toMatchObject({
      adherenceMenu: 80,
      adherenceWater: 80,
      barriers: "Poco tiempo para cocinar",
    });

    expect(page.url()).toContain("#/portal/");
    expect(page.url()).not.toContain("#/login");
  });

  test("muestra datos cacheados cuando falla la red", async ({ page }) => {
    let networkAvailable = true;
    await page.route(
      "http://localhost:3000/patient-portal/**",
      async (route) => {
        const url = route.request().url();
        if (!networkAvailable) {
          await route.abort("failed");
          return;
        }

        if (
          route.request().method() === "GET" &&
          url.endsWith("/notifications")
        ) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(createCachedNotificationsPayload()),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createCachedPortalPayload()),
        });
      },
    );

    await page.goto(hashUrl(`/portal/${PORTAL_CACHE_TOKEN}`));
    await expect(page.getByText("Plan cacheado offline").first()).toBeVisible();
    await expect(page.getByText("Recordatorio cacheado")).toBeVisible();

    networkAvailable = false;
    await page.reload();

    await expect(page.getByText(/Mostrando datos guardados/i)).toBeVisible();
    await expect(page.getByText("Plan cacheado offline").first()).toBeVisible();
    await expect(
      page.getByText(/Historial guardado localmente/i),
    ).toBeVisible();
    await expect(page.getByText("Recordatorio cacheado")).toBeVisible();
  });
});

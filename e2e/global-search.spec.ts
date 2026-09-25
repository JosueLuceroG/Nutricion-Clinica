import { expect, test, type Page } from "@playwright/test";
import { fakeLogin, hashUrl } from "./helpers";

async function seedSearchRecords(page: Page) {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("nutriclinica");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ["patients", "consultations", "meal_plans", "recipes"],
      "readwrite",
    );
    const now = new Date().toISOString();

    transaction.objectStore("patients").put({
      id: "e2e-search-patient",
      sucursal_id: "e2e-branch",
      first_name: "Ana",
      last_name: "García-López",
      second_last_name: null,
      birth_date: "1990-05-15T12:00:00.000Z",
      sex: "female",
      gender: null,
      marital_status: null,
      occupation: null,
      education: null,
      email: "ana.search@example.com",
      phone: "+52 55 1234 9876",
      secondary_phone: null,
      whatsapp_enabled: true,
      emergency_contact_name: null,
      emergency_contact_relationship: null,
      emergency_contact_phone: null,
      record_status: "active",
      record_opened_at: now,
      general_notes: null,
      consentimiento_informado_id: null,
      fecha_firma_consentimiento: null,
      version_politica_privacidad: null,
      clinical_tags: "[]",
      clave_interna: "SEARCH-001",
      birth_place: null,
      address: null,
      nationality: null,
      id_type: null,
      id_number: null,
      discharge_reason: null,
      responsible_professional_id: null,
      external_record_number: null,
      admission_reason: null,
      photo_url: null,
      medical_intake: "{}",
      status: "active",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    transaction.objectStore("consultations").put({
      id: "e2e-search-consultation",
      sucursal_id: "e2e-branch",
      patient_id: "e2e-search-patient",
      consultation_date: "2026-07-29T12:00:00.000Z",
      consultation_number: 7,
      reason: "Seguimiento metabólico",
      subjective: "Mejor energía durante el día",
      objective: "Evolución clínica favorable",
      vitals_json: null,
      assessment: "Continúa con buena adherencia",
      plan: "Mantener estrategia nutricional",
      anthropometry_id: null,
      lab_panel_id: null,
      next_visit_date: null,
      status: "completed",
      cost: 0,
      paid: false,
      payment_status: "pending",
      payment_concept: "consulta",
      payment_method: null,
      paid_at: null,
      reference: null,
      invoice_number: null,
      billing_notes: null,
      amount_paid: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    const safeMeals = [
      {
        slot: "breakfast",
        exchanges: [{ foodId: "aoa-pechuga-pollo", count: 1 }],
      },
      { slot: "morning-snack", exchanges: [] },
      {
        slot: "lunch",
        exchanges: [
          { foodId: "aoa-pechuga-pollo", count: 1 },
          { foodId: "aoa-bistec-res", count: 1 },
        ],
      },
      { slot: "afternoon-snack", exchanges: [] },
      { slot: "dinner", exchanges: [] },
    ];
    const planBase = {
      sucursal_id: "e2e-branch",
      patient_id: "e2e-search-patient",
      consultation_id: null,
      description: "Plan clínico de prueba",
      start_date: "2026-07-30T12:00:00.000Z",
      end_date: null,
      kcal_target: 2300,
      protein_target_g: 120,
      carbs_target_g: 300,
      fat_target_g: 70,
      status: "active",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    transaction.objectStore("meal_plans").put({
      ...planBase,
      id: "e2e-search-plan-safe",
      name: "Plan 2300 seguro",
      notes: "Carne y pollo en dos tiempos de comida",
      meals_json: JSON.stringify(safeMeals),
    });
    transaction.objectStore("meal_plans").put({
      ...planBase,
      id: "e2e-search-plan-fish",
      name: "Plan 2300 con pescado",
      notes: "Variante con pescado",
      meals_json: JSON.stringify(
        safeMeals.map((meal) =>
          meal.slot === "dinner"
            ? {
                ...meal,
                exchanges: [{ foodId: "aoa-pescado-blanco", count: 1 }],
              }
            : meal,
        ),
      ),
    });
    transaction.objectStore("recipes").put({
      id: "e2e-search-recipe",
      name: "Pollo cítrico",
      description: "Pollo con limón y hierbas",
      category: "plato_fuerte",
      subcategory: null,
      cuisine: "mexicana",
      difficulty: "facil",
      prep_time_min: 10,
      cook_time_min: 20,
      servings: 4,
      serving_unit: "porción",
      serving_weight_g: null,
      ingredients_json: "[]",
      steps_json: "[]",
      notes: "",
      photo_paths_json: "[]",
      tags_json: '["pollo","cítrico"]',
      allergens_json: "[]",
      cost_total: 0,
      cost_per_serving: 0,
      currency: "MXN",
      status: "active",
      current_version: 1,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });
}

test.describe("búsqueda inteligente global", () => {
  test.beforeEach(async ({ page }) => {
    await fakeLogin(page, "e2e-branch");
    await page.goto(hashUrl("/"));
    await page.waitForLoadState("domcontentloaded");
  });

  test("abre desde el dashboard y expone la estructura premium", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /Buscar pacientes, consultas, recetas/i })
      .click();

    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("combobox", { name: /Paleta de comandos/i }),
    ).toBeFocused();
    await expect(dialog.getByRole("tab", { name: "Todo" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(dialog.getByText("Sugerencias")).toBeVisible();
    await expect(dialog.getByText("Búsqueda privada").first()).toBeVisible();
    await expect(dialog.getByText("Accesos rápidos")).toBeVisible();
    await expect(dialog.getByText("Recientes")).toBeVisible();
  });

  test("abre con Ctrl+K, interpreta comandos y cierra con Escape", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", {
        name: /Buscar pacientes, consultas, recetas/i,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    await expect(dialog).toBeVisible();

    const input = dialog.getByRole("combobox", { name: /Paleta de comandos/i });
    await input.fill("crear nuevo paciente");
    await expect(
      dialog.getByText("Comando local: se ejecuta solo al seleccionarlo"),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("explica la búsqueda privada y diferencia el Asistente IA", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", {
        name: /Buscar pacientes, consultas, recetas/i,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    await dialog.getByRole("button", { name: "Cómo funciona" }).first().click();

    await expect(dialog.getByText("Búsqueda privada").last()).toBeVisible();
    await expect(
      dialog.getByText("El Asistente IA es otra función"),
    ).toBeVisible();
    await expect(dialog.getByText("Filtros fáciles")).toBeVisible();
    await expect(dialog.getByText("Ver filtros avanzados")).toBeVisible();
    await expect(
      dialog.getByText(/texto y los resultados no se envían/i),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Ir a configurar el Asistente IA" })
      .click();
    await expect(page).toHaveURL(/#\/configuracion\?section=ai$/);
    await expect(page.getByTestId("ai-settings-card")).toBeFocused();
  });

  test("permite aplicar filtros rápidos sin escribir la sintaxis", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", {
        name: /Buscar pacientes, consultas, recetas/i,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });

    await dialog.getByRole("button", { name: "Pacientes activos" }).click();
    await expect(dialog.getByRole("combobox")).toHaveValue(
      "tipo:paciente estado:activo",
    );
    await expect(
      dialog.getByRole("tab", { name: "Pacientes" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("interpreta consultas de hoy y recetas por calorías como búsquedas", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", {
        name: /Buscar pacientes, consultas, recetas/i,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    const input = dialog.getByRole("combobox");

    await input.fill("consultas de hoy");
    await expect(
      dialog.getByRole("tab", { name: "Consultas" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByText("Abrir agenda de hoy")).toHaveCount(0);

    await input.fill("recetas de 2000 calorías");
    await expect(dialog.getByRole("tab", { name: "Recetas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("permite filtrar por categoría", async ({ page }) => {
    await expect(
      page.getByRole("button", {
        name: /Buscar pacientes, consultas, recetas/i,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    const patientsTab = dialog.getByRole("tab", { name: "Pacientes" });
    await patientsTab.click();
    await expect(patientsTab).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByText("Sin coincidencias")).toBeVisible();
  });

  test("encuentra y abre pacientes, consultas y recetas reales", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /Buscar pacientes, consultas, recetas/i })
      .click();
    const initialDialog = page.getByRole("dialog", {
      name: /Búsqueda inteligente/i,
    });
    await expect(initialDialog).toBeVisible();
    await expect(initialDialog.locator("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page.keyboard.press("Escape");
    await seedSearchRecords(page);

    await page.keyboard.press("Control+K");
    let dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    let input = dialog.getByRole("combobox");
    await input.fill("garcia lopez");
    await expect(
      dialog.getByText("Ana García-López", { exact: true }),
    ).toBeVisible();
    await dialog.getByText("Ana García-López", { exact: true }).click();
    await expect(page).toHaveURL(/#\/pacientes\/e2e-search-patient$/);

    await page.keyboard.press("Control+K");
    dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    input = dialog.getByRole("combobox");
    await input.fill("consultas de Ana Garcia Lopez");
    await expect(
      dialog.getByText(/Consulta #7 · Ana García-López/),
    ).toBeVisible();
    await dialog.getByText(/Consulta #7 · Ana García-López/).click();
    await expect(page).toHaveURL(/#\/consultas\/e2e-search-consultation$/);

    await page.keyboard.press("Control+K");
    dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    input = dialog.getByRole("combobox");
    await input.fill("recetas con pollo");
    await expect(dialog.getByText("Pollo cítrico")).toBeVisible();
    await dialog.getByText("Pollo cítrico").click();
    await expect(page).toHaveURL(/#\/recetas\?recipeId=e2e-search-recipe$/);
    await expect(page.locator("#recipe-e2e-search-recipe")).toBeFocused();
  });

  test("interpreta una dieta natural combinando calorías, alimentos y frecuencia", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /Buscar pacientes, consultas, recetas/i })
      .click();
    const initialDialog = page.getByRole("dialog", {
      name: /Búsqueda inteligente/i,
    });
    await expect(initialDialog.locator("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page.keyboard.press("Escape");
    await seedSearchRecords(page);

    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", {
      name: /Búsqueda inteligente/i,
    });
    await dialog
      .getByRole("combobox")
      .fill("dieta de 2300 kc con carne, pollo 2 veces al día y sin pescado");

    await expect(dialog.getByText("Plan 2300 seguro")).toBeVisible();
    await expect(dialog.getByText("Plan 2300 con pescado")).toHaveCount(0);
    await expect(dialog.getByRole("tab", { name: "Planes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await dialog.getByText("Plan 2300 seguro").click();
    await expect(page).toHaveURL(/#\/planes\/e2e-search-plan-safe$/);
  });

  test("encuentra una sección de configuración y la enfoca", async ({ page }) => {
    await page
      .getByRole("button", { name: /Buscar pacientes, consultas, recetas/i })
      .click();
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    await dialog.getByRole("combobox").fill("card motivacional");

    const result = dialog.getByText("Card motivacional", { exact: true });
    await expect(result).toBeVisible();
    await result.click();

    await expect(page).toHaveURL(
      /#\/configuracion\?section=motivational-card$/,
    );
    await expect(
      page.locator('[data-settings-section="motivational-card"]'),
    ).toBeFocused();
  });

  test("se mantiene dentro del viewport móvil", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: /Buscar pacientes, consultas, recetas/i })
      .click();
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });
});

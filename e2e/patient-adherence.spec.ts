import { test, expect } from "@playwright/test";
import { loginAsAdmin, hashUrl, uniqueEmail } from "./helpers";

/**
 * E2E de adherencia profesional (Sprint 25E).
 *
 * Cubre:
 *   1. Ir al detalle de un paciente
 *   2. Navegar a la página de adherencia vía ModuleLink
 *   3. Crear un registro de adherencia desde el diálogo
 *   4. Verificar que el registro aparece en la lista con los scores correctos
 */

test.describe.serial("Adherencia profesional — captura en consulta", () => {
  test.setTimeout(90_000);

  test("navegar a adherencia, crear registro y verlo en lista", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1536, height: 862 });
    await loginAsAdmin(page);

    // 1) Crear un paciente para la prueba
    const email = uniqueEmail("adherence");
    await page.goto(hashUrl("/pacientes/nuevo"));
    await expect(
      page.getByText(/agregar paciente|nuevo paciente/i).first(),
    ).toBeVisible();
    const simpleStepHeights = await page
      .locator(".nc-new-patient")
      .evaluate((element) => {
        const sidebar = element.querySelector<HTMLElement>(
          ".nc-new-patient__sidebar",
        );
        const formCard = element.querySelector<HTMLElement>(
          '.nc-new-patient__formCard[data-step="0"]',
        );
        if (!sidebar || !formCard)
          throw new Error("Simple step layout missing");
        return {
          sidebar: sidebar.getBoundingClientRect().height,
          formCard: formCard.getBoundingClientRect().height,
        };
      });
    expect(
      Math.abs(simpleStepHeights.sidebar - simpleStepHeights.formCard),
    ).toBeLessThanOrEqual(1);
    const wizardSteps = page.locator(".nc-new-patient__menuStep");
    const readTypography = async (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element);
          return { fontSize: style.fontSize, fontWeight: style.fontWeight };
        });
    const expectConditionalFieldBelow = async (
      triggerName: string,
      detailName: string,
      fullWidth = false,
    ) => {
      const panel = page.locator(
        `.nc-new-patient__nutritionPanel:has([name="${triggerName}"]):has([name="${detailName}"])`,
      );
      await expect(panel).toHaveCount(1);
      const positions = await panel.evaluate(
        (element, names) => {
          const trigger = element
            .querySelector<HTMLElement>(`[name="${names.trigger}"]`)
            ?.closest<HTMLElement>(".nc-new-patient__nutritionField");
          const detail = element
            .querySelector<HTMLElement>(`[name="${names.detail}"]`)
            ?.closest<HTMLElement>(".nc-new-patient__nutritionField");
          if (!trigger || !detail) {
            throw new Error("Conditional nutrition fields are missing");
          }
          return {
            triggerBottom: trigger.getBoundingClientRect().bottom,
            detailTop: detail.getBoundingClientRect().top,
            detailWidth: detail.getBoundingClientRect().width,
            containerWidth: detail.parentElement?.getBoundingClientRect().width,
          };
        },
        { trigger: triggerName, detail: detailName },
      );
      expect(positions.detailTop).toBeGreaterThan(positions.triggerBottom);
      if (fullWidth) {
        expect(
          Math.abs(positions.detailWidth - (positions.containerWidth ?? 0)),
        ).toBeLessThanOrEqual(1);
      }
    };
    const expectFirstControlsAligned = async (
      panelSelector: string,
      count: number,
    ) => {
      const tops = await page.locator(panelSelector).evaluate(
        (panel, expectedCount) =>
          Array.from(
            panel.querySelectorAll<HTMLElement>(
              ".nc-new-patient__nutritionSelectControl, .nc-new-patient__nutritionBinary, .nc-new-patient__nutritionField > textarea, .nc-new-patient__nutritionField > input",
            ),
          )
            .slice(0, expectedCount)
            .map((control) => control.getBoundingClientRect().top),
        count,
      );
      expect(tops).toHaveLength(count);
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    };
    await wizardSteps.nth(3).click();
    const clinicalTitleTypography = await readTypography(
      '.nc-new-patient__formCard[data-step="3"] .nc-new-patient__formHeader h2',
    );
    const clinicalLabelTypography = await readTypography(
      ".nc-new-patient__formFields[data-clinical-record] .nc-new-patient__field label",
    );
    expect(clinicalTitleTypography).toEqual({
      fontSize: "18px",
      fontWeight: "600",
    });
    expect(clinicalLabelTypography).toEqual({
      fontSize: "12.5px",
      fontWeight: "600",
    });
    await wizardSteps.nth(4).click();
    await expect(
      page.locator('.nc-new-patient__formCard[data-step="4"]'),
    ).toBeVisible();
    expect(
      await readTypography(
        '.nc-new-patient__formCard[data-step="4"] .nc-new-patient__formHeader h2',
      ),
    ).toEqual(clinicalTitleTypography);
    expect(await readTypography(".nc-new-patient__medicalNav strong")).toEqual(
      clinicalLabelTypography,
    );
    expect(
      await readTypography(".nc-new-patient__binaryQuestion > strong span"),
    ).toEqual({ fontSize: "12.5px", fontWeight: "400" });
    const medicalStepHeights = await page
      .locator(".nc-new-patient")
      .evaluate((element) => {
        const sectionNav = element.querySelector<HTMLElement>(
          ".nc-new-patient__medicalNav",
        );
        const formCard = element.querySelector<HTMLElement>(
          '.nc-new-patient__formCard[data-step="4"]',
        );
        if (!sectionNav || !formCard) {
          throw new Error("Medical step layout missing");
        }
        return {
          sectionNav: sectionNav.getBoundingClientRect().height,
          formCard: formCard.getBoundingClientRect().height,
        };
      });
    expect(
      Math.abs(medicalStepHeights.sectionNav - medicalStepHeights.formCard),
    ).toBeLessThanOrEqual(1);
    await page.locator(".nc-new-patient__medicalNav button").nth(1).click();
    expect(
      await readTypography(".nc-new-patient__familyMode > legend"),
    ).toEqual({ fontSize: "12.5px", fontWeight: "400" });
    expect(
      await readTypography(".nc-new-patient__familyMode label strong"),
    ).toEqual({ fontSize: "12.5px", fontWeight: "400" });
    await page.locator(".nc-new-patient__medicalNav button").nth(2).click();
    const medicationCardHeights = await page
      .locator(
        '.nc-new-patient__formFields[data-medical-section="medications"] > .nc-new-patient__binaryQuestion',
      )
      .evaluateAll((cards) =>
        cards.map((card) => card.getBoundingClientRect().height),
      );
    expect(medicationCardHeights).toHaveLength(4);
    expect(
      Math.max(...medicationCardHeights) - Math.min(...medicationCardHeights),
    ).toBeLessThanOrEqual(1);
    await page.locator(".nc-new-patient__medicalNav button").nth(0).click();
    await wizardSteps.nth(5).click();
    await expect(
      page.locator('.nc-new-patient__formCard[data-step="5"]'),
    ).toBeVisible();
    expect(
      await readTypography(
        '.nc-new-patient__formCard[data-step="5"] .nc-new-patient__formHeader h2',
      ),
    ).toEqual(clinicalTitleTypography);
    expect(await readTypography(".nc-new-patient__medicalNav strong")).toEqual(
      clinicalLabelTypography,
    );
    expect(
      await readTypography(".nc-new-patient__nutritionPanel legend"),
    ).toEqual(clinicalLabelTypography);
    expect(
      await readTypography(".nc-new-patient__nutritionField > label"),
    ).toEqual({ fontSize: "12.5px", fontWeight: "400" });
    await expect(
      page.locator(".nc-new-patient__nutritionPanel legend > span"),
    ).toHaveCount(0);
    await wizardSteps.nth(0).click();

    await page.locator('input[name="firstName"]').fill("Adherencia");
    await page.locator('input[name="lastName"]').fill("E2ETest");
    await page.locator('input[name="firstName"]').press("Tab");
    await page.locator('input[name="age"]').fill("36");
    await page.locator('select[name="sex"]').selectOption("female");
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="phone"]').fill("+52 55 1234 5678");

    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page
      .locator('input[name="emergencyContactName"]')
      .fill("Contacto Adherencia");
    await page
      .locator('select[name="emergencyContactRelationship"]')
      .selectOption("Madre");
    await page
      .locator('input[name="emergencyContactPhone"]')
      .fill("+52 55 2468 1357");
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page
      .locator('input[name="externalRecordNumber"]')
      .fill(`EXP-${Date.now()}`);
    await page
      .locator('textarea[name="admissionReason"]')
      .fill("Seguimiento de adherencia");
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page
      .locator('input[name="diagnosedConditions"][value="yes"]')
      .check({ force: true });
    await page
      .locator('input[name="diagnosedConditionDetails.0.diagnosis"]')
      .fill("Diabetes mellitus tipo 2");
    await page
      .locator('select[name="diagnosedConditionDetails.0.status"]')
      .selectOption("controlled");
    await page
      .getByRole("button", {
        name: /agregar otra enfermedad|add another condition/i,
      })
      .click();
    await page
      .locator('input[name="diagnosedConditionDetails.1.diagnosis"]')
      .fill("Hipertensión arterial");
    await page
      .locator('select[name="diagnosedConditionDetails.1.status"]')
      .selectOption("active");

    await page
      .locator('input[name="previousSurgeries"][value="yes"]')
      .check({ force: true });
    await page
      .locator('input[name="previousSurgeryDetails.0.procedure"]')
      .fill("Apendicectomía");

    await page
      .locator('input[name="currentTreatments"][value="yes"]')
      .check({ force: true });
    await page
      .locator('input[name="currentTreatmentDetails.0.name"]')
      .fill("Terapia nutricional");
    await page
      .locator('input[name="currentTreatmentDetails.0.reason"]')
      .fill("Control glucémico");
    await page
      .locator('input[name="currentTreatmentDetails.0.frequency"]')
      .fill("Mensual");

    await page
      .locator('input[name="intolerances"][value="yes"]')
      .check({ force: true });
    await page
      .locator('input[name="intoleranceDetails.0.substance"]')
      .fill("Lactosa");
    await page
      .locator('input[name="intoleranceDetails.0.reaction"]')
      .fill("Distensión abdominal");
    await page
      .locator('input[name="intoleranceDetails.0.severity"][value="moderate"]')
      .check();
    const hidePathologicalDetails = page.getByRole("button", {
      name: /ocultar información capturada|hide captured information/i,
    });
    await expect(hidePathologicalDetails).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      await hidePathologicalDetails.first().click();
    }
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page.locator(".nc-new-patient__medicalNav button").nth(0).click();
    await expect(
      page.getByRole("button", {
        name: /mostrar información capturada|show captured information/i,
      }),
    ).toHaveCount(4);
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page
      .locator('input[name="familyHistoryMode"][value="recorded"]')
      .check();
    await expect(
      page.getByText(/^(Notas adicionales|Additional notes)$/i),
    ).toBeVisible();
    const familyLabelsFit = await page
      .locator(".nc-new-patient__familyHistoryGrid")
      .evaluate((grid) =>
        Array.from(
          grid.querySelectorAll<HTMLElement>(
            ".nc-new-patient__familyField > label",
          ),
        ).every((label) => label.scrollWidth <= label.clientWidth + 1),
      );
    expect(familyLabelsFit).toBe(true);
    for (const field of [
      "familyHypertension",
      "familyObesity",
      "familyCardiovascular",
      "familyDyslipidemia",
      "familyKidneyDisease",
      "familyThyroidDisease",
    ]) {
      const familySelect = page.locator(`[data-family-field="${field}"]`);
      await familySelect
        .locator(".nc-new-patient__familySelectTrigger")
        .click();
      await familySelect
        .locator('input[type="checkbox"][value="none"]')
        .click();
    }
    const diabetesSelect = page.locator('[data-family-field="familyDiabetes"]');
    await diabetesSelect
      .locator(".nc-new-patient__familySelectTrigger")
      .click();
    await diabetesSelect
      .locator('input[type="checkbox"][value="mother"]')
      .check();
    await diabetesSelect
      .locator('input[type="checkbox"][value="father"]')
      .check();
    await expect(
      diabetesSelect.locator(".nc-new-patient__familySelectTrigger"),
    ).toContainText(/madre, padre|mother, father/i);
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page
      .locator('input[name="supplements"][value="yes"]')
      .check({ force: true });
    await page
      .locator('input[name="supplementDetails.0.name"]')
      .fill("Omega 3");
    await page
      .locator('input[name="supplementDetails.0.dose"]')
      .fill("1000 mg");
    await page
      .locator('select[name="supplementDetails.0.frequency"]')
      .selectOption("daily");
    await page
      .locator('input[name="supplementDetails.0.objective"]')
      .fill("Salud cardiovascular");
    await page
      .getByRole("button", {
        name: /agregar otro suplemento|add another supplement/i,
      })
      .click();
    await page
      .locator('input[name="supplementDetails.1.name"]')
      .fill("Vitamina D3");
    await page
      .locator('input[name="supplementDetails.1.dose"]')
      .fill("2000 UI");
    await page
      .locator('select[name="supplementDetails.1.frequency"]')
      .selectOption("daily");
    await page
      .locator('input[name="supplementDetails.1.objective"]')
      .fill("Salud ósea");
    await page
      .locator('input[name="medicationAllergies"][value="yes"]')
      .check({ force: true });
    await page
      .locator('input[name="medicationAllergyDetails.0.medication"]')
      .fill("Amoxicilina");
    await page
      .locator('input[name="medicationAllergyDetails.0.reaction"]')
      .fill("Erupción cutánea");
    await page
      .locator(
        'input[name="medicationAllergyDetails.0.severity"][value="moderate"]',
      )
      .check();
    await page
      .locator(
        'input[name="medicationAllergyDetails.0.requiredMedicalAttention"][value="yes"]',
      )
      .check();
    await page
      .getByRole("button", {
        name: /agregar otro medicamento causante|add another causative medication/i,
      })
      .click();
    await page
      .locator('input[name="medicationAllergyDetails.1.medication"]')
      .fill("Penicilina");
    await page
      .locator('input[name="medicationAllergyDetails.1.reaction"]')
      .fill("Urticaria");
    await page
      .locator(
        'input[name="medicationAllergyDetails.1.severity"][value="mild"]',
      )
      .check();
    await page
      .locator(
        'input[name="medicationAllergyDetails.1.requiredMedicalAttention"][value="no"]',
      )
      .check();
    await page
      .locator('input[name="medications"][value="yes"]')
      .check({ force: true });
    await page
      .locator('input[name="dailyMedicationDetails.0.name"]')
      .fill("Losartán");
    await page
      .locator('input[name="dailyMedicationDetails.0.dose"]')
      .fill("50 mg");
    await page
      .locator('select[name="dailyMedicationDetails.0.frequency"]')
      .selectOption("daily");
    await page
      .locator('input[name="dailyMedicationDetails.0.schedule"]')
      .fill("08:00");
    await page
      .locator('input[name="dailyMedicationDetails.0.reason"]')
      .fill("Hipertensión");
    await page
      .locator(
        'input[name="dailyMedicationDetails.0.prescribedByProfessional"][value="yes"]',
      )
      .check();
    await page
      .getByRole("button", {
        name: /agregar otro medicamento diario|add another daily medication/i,
      })
      .click();
    await page
      .locator('input[name="dailyMedicationDetails.1.name"]')
      .fill("Metformina");
    await page
      .locator('input[name="dailyMedicationDetails.1.dose"]')
      .fill("850 mg");
    await page
      .locator('select[name="dailyMedicationDetails.1.frequency"]')
      .selectOption("twiceDaily");
    await page
      .locator('input[name="dailyMedicationDetails.1.schedule"]')
      .fill("20:00");
    await page
      .locator('input[name="dailyMedicationDetails.1.reason"]')
      .fill("Diabetes");
    await page
      .locator(
        'input[name="dailyMedicationDetails.1.prescribedByProfessional"][value="yes"]',
      )
      .check();
    await page
      .locator('input[name="adverseMedicationOrSupplementEffects"][value="no"]')
      .check({ force: true });
    const hideMedicalDetails = page.getByRole("button", {
      name: /ocultar información capturada|hide captured information/i,
    });
    await expect(hideMedicalDetails).toHaveCount(3);
    await hideMedicalDetails.first().click();
    await hideMedicalDetails.first().click();
    await hideMedicalDetails.first().click();
    await expect(
      page.getByText(
        /2 suplemento\(s\) registrado\(s\)|2 supplement\(s\) recorded/i,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/2 alergia\(s\) registrada\(s\)|2 allergy record\(s\)/i),
    ).toBeVisible();
    await expect(
      page.getByText(
        /2 medicamento\(s\) registrado\(s\)|2 medication\(s\) recorded/i,
      ),
    ).toBeVisible();
    let fixedNutritionSidebarHeight: number | null = null;
    const expectNutritionWithoutScroll = async () => {
      const layout = await page
        .locator(".nc-new-patient")
        .evaluate((element) => {
          const sidebar = element.querySelector<HTMLElement>(
            ".nc-new-patient__sidebar",
          );
          const fields = element.querySelector<HTMLElement>(
            ".nc-new-patient__formFields[data-nutrition]",
          );
          const sectionNav = element.querySelector<HTMLElement>(
            ".nc-new-patient__medicalNav",
          );
          const formCard = element.querySelector<HTMLElement>(
            '.nc-new-patient__formCard[data-step="5"]',
          );
          if (!sidebar || !sectionNav || !formCard || !fields) {
            throw new Error("Nutrition layout missing");
          }
          return {
            sidebarHeight: sidebar.getBoundingClientRect().height,
            sectionNavHeight: sectionNav.getBoundingClientRect().height,
            formCardHeight: formCard.getBoundingClientRect().height,
            fieldsClientHeight: fields.clientHeight,
            fieldsScrollHeight: fields.scrollHeight,
            fieldsOverflowY: getComputedStyle(fields).overflowY,
          };
        });
      if (fixedNutritionSidebarHeight === null) {
        fixedNutritionSidebarHeight = layout.sidebarHeight;
      } else {
        expect(
          Math.abs(layout.sidebarHeight - fixedNutritionSidebarHeight),
        ).toBeLessThanOrEqual(1);
      }
      expect(
        Math.abs(layout.sectionNavHeight - layout.formCardHeight),
      ).toBeLessThanOrEqual(1);
      expect(["auto", "scroll"]).not.toContain(layout.fieldsOverflowY);
      expect(layout.fieldsScrollHeight).toBeLessThanOrEqual(
        layout.fieldsClientHeight + 1,
      );
      await expect(
        page.locator(
          '.nc-new-patient__formCard[data-step="5"] .nc-new-patient__navigationCard',
        ),
      ).toBeVisible();
    };
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await expect(
      page.getByTestId("optional-medical-info-dialog"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /omitir por ahora|skip for now/i })
      .click();
    await expect(page.getByTestId("optional-medical-info-dialog")).toBeHidden();
    await expectNutritionWithoutScroll();
    await page.locator('input[name="breakfastTime"]').fill("08:00");
    await page.locator('input[name="mainMealTime"]').fill("13:30");
    await page.locator('input[name="dinnerTime"]').fill("20:00");
    await page.locator('input[name="snackTimes.0.time"]').fill("10:30");
    await page.locator('select[name="mealsPerDay"]').selectOption("4");
    await page.locator('input[name="skipsMeals"][value="yes"]').check();
    await page
      .locator('select[name="mostSkippedMeal"]')
      .selectOption("breakfast");
    await expectConditionalFieldBelow("skipsMeals", "mostSkippedMeal", true);
    await page.locator('input[name="scheduleVaries"][value="yes"]').check();
    await page
      .locator('select[name="scheduleVariation"]')
      .selectOption("weekendsLater");
    await expectConditionalFieldBelow(
      "scheduleVaries",
      "scheduleVariation",
      true,
    );
    await page.locator('select[name="mealDuration"]').selectOption("20To30");
    await expectFirstControlsAligned(
      ".nc-new-patient__nutritionRoutine > fieldset:nth-of-type(2)",
      2,
    );
    await expectFirstControlsAligned(
      ".nc-new-patient__nutritionRoutine > fieldset:nth-of-type(3)",
      2,
    );
    await expectNutritionWithoutScroll();
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await expectNutritionWithoutScroll();
    await page
      .locator('select[name="eatingOutFrequency"]')
      .selectOption("oneToTwoPerWeek");
    await page.locator('input[name="snacksBetweenMeals"][value="yes"]').check();
    await page.locator('input[name="eatsLateAtNight"][value="no"]').check();
    await page.locator('input[name="frequentCravings"][value="yes"]').check();
    await page.locator('select[name="cravingTime"]').selectOption("afternoon");
    await expectConditionalFieldBelow("frequentCravings", "cravingTime");
    const cravingGroupWidth = await page
      .locator(".nc-new-patient__nutritionConditionalGroup--full")
      .evaluate((group) => ({
        group: group.getBoundingClientRect().width,
        container: group.parentElement?.getBoundingClientRect().width ?? 0,
      }));
    expect(
      Math.abs(cravingGroupWidth.group - cravingGroupWidth.container),
    ).toBeLessThanOrEqual(1);
    await page.locator('select[name="mealPreparer"]').selectOption("self");
    await page
      .locator('select[name="primaryMealLocation"]')
      .selectOption("home");
    await expectFirstControlsAligned(
      ".nc-new-patient__nutritionPatterns > fieldset:nth-of-type(3)",
      2,
    );
    await expectNutritionWithoutScroll();
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await expectNutritionWithoutScroll();
    await expect(
      page.locator(".nc-new-patient__medicalNav button[data-current] svg"),
    ).toHaveClass(/lucide-salad/);
    await page.locator('select[name="usualDietType"]').selectOption("other");
    await page
      .locator('input[name="otherDietDescription"]')
      .fill("Flexitariana");
    await expectConditionalFieldBelow("usualDietType", "otherDietDescription");
    await page.locator('input[name="avoidsFoods"][value="yes"]').check();
    await page.locator('[name="avoidedFoods"]').fill("Mariscos");
    await expectConditionalFieldBelow("avoidsFoods", "avoidedFoods");
    await page
      .locator('input[name="followsFoodRestrictions"][value="yes"]')
      .check();
    await page
      .locator('[name="foodRestrictionDetails"]')
      .fill("Sin carne roja");
    await expectConditionalFieldBelow(
      "followsFoodRestrictions",
      "foodRestrictionDetails",
    );
    await page.locator('input[name="hasFoodDiscomfort"][value="yes"]').check();
    await page.locator('[name="discomfortFoods"]').fill("Lácteos");
    await expectConditionalFieldBelow("hasFoodDiscomfort", "discomfortFoods");
    await expect(
      page.getByText(/^(Notas adicionales|Additional notes)$/i),
    ).toBeVisible();
    await page
      .locator('select[name="specialEatingPreference"]')
      .selectOption("lowSodium");
    await expectFirstControlsAligned(
      ".nc-new-patient__nutritionPreferences > fieldset:nth-of-type(3)",
      2,
    );
    await expectNutritionWithoutScroll();
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await expectNutritionWithoutScroll();
    await expect(
      page.locator(
        '.nc-new-patient__formCard[data-step="5"] .nc-new-patient__navigationCard',
      ),
    ).toBeInViewport();
    await page
      .locator('select[name="waterIntake"]')
      .selectOption("oneAndHalfToTwoLiters");
    await page
      .locator('input[name="drinksWaterThroughoutDay"][value="yes"]')
      .check();
    await page.locator('input[name="carriesWaterBottle"][value="yes"]').check();
    await page
      .locator('select[name="coffeeTeaFrequency"]')
      .selectOption("oneToTwoPerDay");
    await page
      .locator('select[name="sugaryDrinkFrequency"]')
      .selectOption("oneToTwoPerWeek");
    await page
      .locator('input[name="consumesEnergyDrinks"][value="no"]')
      .check();
    await page
      .locator('select[name="otherBeverage"]')
      .selectOption("infusions");
    await page.locator('select[name="alcoholFrequency"]').selectOption("never");
    await expectFirstControlsAligned(
      ".nc-new-patient__nutritionHydration > fieldset:nth-of-type(1)",
      3,
    );
    await expectFirstControlsAligned(
      ".nc-new-patient__nutritionHydration > fieldset:nth-of-type(2)",
      3,
    );
    await expectFirstControlsAligned(
      ".nc-new-patient__nutritionHydration > fieldset:nth-of-type(3)",
      2,
    );
    await expect(
      page.getByText(/^(Notas adicionales|Additional notes)$/i),
    ).toBeVisible();
    await expectNutritionWithoutScroll();
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await expectNutritionWithoutScroll();
    await expect(
      page.locator(".nc-new-patient__medicalNav button[data-current] svg"),
    ).toHaveClass(/lucide-digestive-stomach/);
    const digestiveNotesWidth = await page
      .locator(".nc-new-patient__nutritionField--notes")
      .evaluate((notes) => ({
        notes: notes.getBoundingClientRect().width,
        container: notes.parentElement?.getBoundingClientRect().width ?? 0,
      }));
    expect(
      Math.abs(digestiveNotesWidth.notes - digestiveNotesWidth.container),
    ).toBeLessThanOrEqual(1);
    await page.locator('input[name="appetiteLevel"][value="normal"]').check();
    await page.locator('input[name="earlySatiety"][value="no"]').check();
    await page
      .locator('input[name="hasDigestiveDiscomfort"][value="yes"]')
      .check();
    await page
      .locator('input[name="digestiveSymptoms"][value="reflux"]')
      .check();
    await page.locator('input[name="digestiveSymptoms"][value="gas"]').check();
    for (const symptom of [
      "heartburn",
      "vomiting",
      "belching",
      "abdominalCramps",
    ]) {
      await page
        .locator(`input[name="digestiveSymptoms"][value="${symptom}"]`)
        .check();
    }
    await expect(
      page.locator('input[name="otherDigestiveSymptom"]'),
    ).toHaveCount(0);
    await page
      .locator('input[name="digestiveSymptoms"][value="other"]')
      .check();
    await page
      .locator('input[name="otherDigestiveSymptom"]')
      .fill("Sensación de vacío");
    const otherSymptomLayout = await page
      .locator(".nc-new-patient__digestiveOtherField")
      .evaluate((element) => {
        const label = element.querySelector("label");
        const input = element.querySelector("input");
        if (!label || !input) throw new Error("Other symptom field is missing");
        return {
          labelBottom: label.getBoundingClientRect().bottom,
          inputTop: input.getBoundingClientRect().top,
        };
      });
    expect(otherSymptomLayout.inputTop).toBeGreaterThanOrEqual(
      otherSymptomLayout.labelBottom,
    );
    await expect(
      page.getByText(/^(Notas adicionales|Additional notes)$/i),
    ).toBeVisible();
    await expect(
      page
        .locator(
          'label:has(input[name="digestiveSymptoms"][value="reflux"]) > svg',
        )
        .first(),
    ).toHaveClass(/lucide-digestive-stomach/);
    await expect(
      page
        .locator(
          'label:has(input[name="digestiveSymptoms"][value="bloating"]) > svg',
        )
        .first(),
    ).toHaveClass(/lucide-bloating-symptom/);
    await expect(
      page
        .locator(
          'label:has(input[name="digestiveSymptoms"][value="constipation"]) > svg',
        )
        .first(),
    ).toHaveClass(/lucide-toilet/);
    const symptomColumns = await page
      .locator(".nc-new-patient__digestiveSymptomOptions")
      .evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(" "),
      );
    expect(symptomColumns).toHaveLength(4);
    await expectNutritionWithoutScroll();
    await page
      .locator('select[name="symptomTiming"]')
      .selectOption("afterMeals");
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page
      .locator('input[name="physicalActivity"][value="no"]')
      .check({ force: true });
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page
      .getByRole("button", { name: /crear expediente|create record/i })
      .last()
      .click();
    await page.waitForURL(/\/pacientes\/[a-f0-9-]{36}$/, { timeout: 15_000 });
    const patientId = page.url().match(/\/pacientes\/([a-f0-9-]{36})/)?.[1];
    expect(patientId).toBeTruthy();
    if (!patientId) throw new Error("Patient id was not found in the URL");
    const medicalIntake = await page.evaluate(async (id) => {
      return new Promise<Record<string, unknown> | null>((resolve, reject) => {
        const request = indexedDB.open("nutriclinica");
        request.onsuccess = () => {
          const transaction = request.result.transaction(
            "patients",
            "readonly",
          );
          const getRequest = transaction.objectStore("patients").get(id);
          getRequest.onsuccess = () => {
            const value = getRequest.result?.medical_intake;
            resolve(
              typeof value === "string"
                ? (JSON.parse(value) as Record<string, unknown>)
                : (value ?? null),
            );
          };
          getRequest.onerror = () => reject(getRequest.error);
        };
        request.onerror = () => reject(request.error);
      });
    }, patientId);
    expect(medicalIntake).toMatchObject({
      diagnosedConditions: true,
      diagnosedConditionDetails: [
        { diagnosis: "Diabetes mellitus tipo 2", status: "controlled" },
        { diagnosis: "Hipertensión arterial", status: "active" },
      ],
      previousSurgeryDetails: [{ procedure: "Apendicectomía" }],
      currentTreatmentDetails: [
        {
          name: "Terapia nutricional",
          reason: "Control glucémico",
          frequency: "Mensual",
        },
      ],
      intoleranceDetails: [
        {
          substance: "Lactosa",
          reaction: "Distensión abdominal",
          severity: "moderate",
        },
      ],
      familyHistoryMode: "recorded",
      nutritionIntake: {
        routine: {
          breakfastTime: "08:00",
          mainMealTime: "13:30",
          dinnerTime: "20:00",
          snackTimes: ["10:30"],
          mealsPerDay: 4,
          skipsMeals: true,
          mostSkippedMeal: "breakfast",
          scheduleVaries: true,
          scheduleVariation: "weekendsLater",
          mealDuration: "20To30",
        },
        patterns: {
          eatingOutFrequency: "oneToTwoPerWeek",
          snacksBetweenMeals: true,
          eatsLateAtNight: false,
          frequentCravings: true,
          cravingTime: "afternoon",
          mealPreparer: "self",
          primaryMealLocation: "home",
        },
        preferences: {
          usualDietType: "other",
          otherDietDescription: "Flexitariana",
          avoidsFoods: true,
          avoidedFoods: "Mariscos",
          followsFoodRestrictions: true,
          foodRestrictionDetails: "Sin carne roja",
          hasFoodDiscomfort: true,
          discomfortFoods: "Lácteos",
          specialPreference: "lowSodium",
          notes: null,
        },
        hydration: {
          waterIntake: "oneAndHalfToTwoLiters",
          drinksWaterThroughoutDay: true,
          carriesWaterBottle: true,
          coffeeTeaFrequency: "oneToTwoPerDay",
          sugaryDrinkFrequency: "oneToTwoPerWeek",
          consumesEnergyDrinks: false,
          otherBeverage: "infusions",
          alcoholFrequency: "never",
          notes: null,
        },
        digestive: {
          appetiteLevel: "normal",
          earlySatiety: false,
          hasDigestiveDiscomfort: true,
          symptoms: [
            "reflux",
            "gas",
            "heartburn",
            "vomiting",
            "belching",
            "abdominalCramps",
            "other",
          ],
          otherSymptomDescription: "Sensación de vacío",
          symptomTiming: "afterMeals",
          notes: null,
        },
      },
    });

    // 2) Navegar al submódulo de adherencia del paciente creado.
    await page.goto(hashUrl(`/pacientes/${patientId}/adherencia`));
    await page.waitForURL(/\/pacientes\/[a-f0-9-]{36}\/adherencia/, {
      timeout: 10_000,
    });

    // 3) Verificar que la página de adherencia cargó
    await expect(page.getByText(/Agregar registro/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // 4) Abrir el diálogo de nuevo registro
    await page
      .getByRole("button", { name: /Agregar registro/i })
      .first()
      .click();
    await expect(page.getByText(/Registro de adherencia/i).first()).toBeVisible(
      { timeout: 5_000 },
    );

    // 5) Llenar los sliders de scores usando JS para setear valores
    const sliders = page.locator('input[type="range"]');
    const sliderCount = await sliders.count();
    expect(sliderCount).toBe(5);

    // Setear cada slider a diferentes valores
    const scoreValues = [85, 70, 60, 90, 50];
    for (let i = 0; i < sliderCount; i++) {
      const slider = sliders.nth(i);
      await slider.evaluate((el, val) => {
        const input = el as HTMLInputElement;
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(input, String(val));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, scoreValues[i]);
    }

    // 6) Llenar barreras y facilitadores
    await page
      .locator("#barriers")
      .fill("Falta de tiempo para preparar alimentos");
    await page.locator("#facilitators").fill("Apoyo familiar en la dieta");
    await page
      .locator("#notes")
      .fill("Paciente motivada pero con horarios complicados");

    // 7) Guardar el registro
    await page.getByRole("button", { name: /Guardar registro/i }).click();

    // 8) Esperar que el diálogo se cierre y el registro aparezca en la lista
    await expect(page.getByText(/Registro de adherencia/i)).not.toBeVisible({
      timeout: 5_000,
    });

    // Verificar que el card del registro se muestra con los scores
    await expect(page.getByText(/Falta de tiempo/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Apoyo familiar/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/Paciente motivada/i).first()).toBeVisible({
      timeout: 5_000,
    });

    // Verificar que el badge de fuente "consulta" está presente
    await expect(page.getByText(/consulta/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { MealSlotLabel, DEFAULT_KCAL_DISTRIBUTION } from "@modules/mealplan/domain/MealSlot";
import type { PdfMealPlanData, PdfMeal } from "../types";

const COLORS = {
  primary: [41, 112, 207] as [number, number, number],
  secondary: [107, 114, 128] as [number, number, number],
  border: [209, 213, 219] as [number, number, number],
  bgLight: [249, 250, 251] as [number, number, number],
  bgHeader: [243, 244, 246] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
};

function addHeader(doc: jsPDF): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.primary);
  doc.text("NutriClinica", 14, 20);

  doc.setFontSize(16);
  doc.setTextColor(...COLORS.black);
  doc.text("Plan de Alimentaci\u00f3n", 14, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondary);
  doc.text(`Generado el ${new Date().toLocaleDateString("es-MX")}`, 14, 37);

  doc.setDrawColor(...COLORS.border);
  doc.line(14, 41, 196, 41);
}

function addPatientInfo(doc: jsPDF, data: PdfMealPlanData): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);
  doc.text("Datos del plan", 14, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);

  const lines = [
    `Paciente: ${data.patientName}`,
    `Plan: ${data.name}`,
    `Vigencia: ${data.startDate}${data.endDate ? ` al ${data.endDate}` : ""}`,
  ];
  lines.forEach((line, i) => doc.text(line, 14, 60 + i * 5));

  const targets = [
    `${data.kcalTarget} kcal`,
    `Prote\u00edna: ${data.proteinTargetG}g`,
    `Carbohidratos: ${data.carbsTargetG}g`,
    `Grasa: ${data.fatTargetG}g`,
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.text("Objetivo nutricional:", 120, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);
  targets.forEach((t, i) => doc.text(t, 120, 67 + i * 5));

  doc.setDrawColor(...COLORS.border);
  doc.line(14, 92, 196, 92);
}

function calcMealKcal(meal: PdfMeal): number {
  return meal.exchanges.reduce((sum, ex) => sum + ex.food.kcalPerServing * ex.count, 0);
}

function calcTotalKcal(meals: PdfMeal[]): number {
  return meals.reduce((sum, m) => sum + calcMealKcal(m), 0);
}

function calcTotalMacros(meals: PdfMeal[]): { proteinG: number; carbsG: number; fatG: number } {
  return meals.reduce(
    (acc, m) => {
      for (const ex of m.exchanges) {
        acc.proteinG += ex.food.proteinGPerServing * ex.count;
        acc.carbsG += ex.food.carbsGPerServing * ex.count;
        acc.fatG += ex.food.fatGPerServing * ex.count;
      }
      return acc;
    },
    { proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function addMealSection(doc: jsPDF, meal: PdfMeal, startY: number): number {
  const mealKcal = calcMealKcal(meal);
  const targetPct = DEFAULT_KCAL_DISTRIBUTION[meal.slot] * 100;
  const mealLabel = MealSlotLabel[meal.slot];
  let y = startY;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(...COLORS.bgHeader);
  doc.rect(14, y, 182, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);
  doc.text(`${mealLabel}`, 16, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);
  doc.text(`${Math.round(mealKcal)} kcal (${targetPct.toFixed(0)}%)`, 160, y + 6, { align: "right" as const });
  y += 12;

  if (meal.exchanges.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.secondary);
    doc.text("Sin alimentos registrados", 16, y + 4);
    y += 10;
  } else {
    const body = meal.exchanges.map((ex) => {
      const f = ex.food;
      const kcal = f.kcalPerServing * ex.count;
      const p = f.proteinGPerServing * ex.count;
      const c = f.carbsGPerServing * ex.count;
      const l = f.fatGPerServing * ex.count;
      return [
        `${f.name}${ex.count !== 1 ? ` (${ex.count}x)` : ""}`,
        `${kcal.toFixed(0)}`,
        `${p.toFixed(1)}g`,
        `${c.toFixed(1)}g`,
        `${l.toFixed(1)}g`,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Alimento", "kcal", "Prote\u00edna", "Carbohidratos", "Grasa"]],
      body,
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fontStyle: "bold", fontSize: 8, fillColor: COLORS.white, textColor: COLORS.secondary, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20, halign: "right" },
        2: { cellWidth: 25, halign: "right" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 20, halign: "right" },
      },
      margin: { left: 14 },
      tableWidth: 182,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  return y;
}

function addSummaryTable(doc: jsPDF, data: PdfMealPlanData, startY: number): number {
  let y = startY + 4;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.primary);
  doc.text("Resumen Nutricional", 14, y);
  y += 6;

  const totals = calcTotalMacros(data.meals);
  const totalKcal = calcTotalKcal(data.meals);

  const body = [
    ["Objetivo", `${data.kcalTarget}`, `${data.proteinTargetG}g`, `${data.carbsTargetG}g`, `${data.fatTargetG}g`],
    ["Total plan", `${Math.round(totalKcal)}`, `${totals.proteinG.toFixed(1)}g`, `${totals.carbsG.toFixed(1)}g`, `${totals.fatG.toFixed(1)}g`],
    [
      "Delta",
      `${Math.round(totalKcal - data.kcalTarget)}`,
      `${(totals.proteinG - data.proteinTargetG).toFixed(1)}g`,
      `${(totals.carbsG - data.carbsTargetG).toFixed(1)}g`,
      `${(totals.fatG - data.fatTargetG).toFixed(1)}g`,
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["", "kcal", "Prote\u00edna", "Carbohidratos", "Grasa"]],
    body,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: "bold" },
      1: { cellWidth: 35, halign: "right" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 38, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
    margin: { left: 14 },
    tableWidth: 182,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  return y;
}

function addNotes(doc: jsPDF, data: PdfMealPlanData, startY: number): void {
  if (!data.notes) return;
  let y = startY + 4;
  if (y > 265) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);
  doc.text("Recomendaciones y notas:", 14, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);

  const split = doc.splitTextToSize(data.notes, 175);
  doc.text(split, 14, y);
}

function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLORS.border);
    doc.line(14, 287, 196, 287);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.secondary);
    doc.text("NutriClinica \u2014 Plan de Alimentaci\u00f3n", 14, 293);
    doc.text(`P\u00e1gina ${i} de ${pageCount}`, 196, 293, { align: "right" as const });
  }
}

export function generateMealPlanPdf(data: PdfMealPlanData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  addHeader(doc);
  addPatientInfo(doc, data);

  let y = 96;
  for (const meal of data.meals) {
    y = addMealSection(doc, meal, y);
  }

  y = addSummaryTable(doc, data, y);
  addNotes(doc, data, y);
  addFooter(doc);

  return doc;
}

export function downloadPdf(doc: jsPDF, fileName: string): void {
  doc.save(fileName);
}

export function openPdfInNewTab(doc: jsPDF): void {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

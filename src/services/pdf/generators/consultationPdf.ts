import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ConsultationStatusLabel } from "@modules/consultation/domain/ConsultationStatus";
import type { PdfConsultationData } from "../types";

const COLORS = {
  primary: [41, 112, 207] as [number, number, number],
  secondary: [107, 114, 128] as [number, number, number],
  border: [209, 213, 219] as [number, number, number],
  bgHeader: [243, 244, 246] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
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
  doc.text("Nota de Consulta Nutricional", 14, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondary);
  doc.text(`Generado el ${new Date().toLocaleDateString("es-MX")}`, 14, 37);

  doc.setDrawColor(...COLORS.border);
  doc.line(14, 41, 196, 41);
}

function addPatientInfo(doc: jsPDF, data: PdfConsultationData): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);
  doc.text("Datos de la consulta", 14, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);

  const statusLabel = ConsultationStatusLabel[data.status];
  const lines = [
    `Paciente: ${data.patientName}`,
    `Consulta #${data.consultationNumber} - ${data.consultationDate}`,
    `Estado: ${statusLabel}`,
  ];
  lines.forEach((line, i) => doc.text(line, 14, 60 + i * 5));

  if (data.nextVisitDate) {
    doc.text(`Pr\u00f3xima cita: ${data.nextVisitDate}`, 120, 60);
  }

  doc.setDrawColor(...COLORS.border);
  doc.line(14, 78, 196, 78);
}

function addVitalsTable(doc: jsPDF, data: PdfConsultationData, startY: number): number {
  const v = data.vitals;
  const allEmpty = v.systolicMmHg === null && v.diastolicMmHg === null && v.heartRateBpm === null && v.temperatureC === null;
  if (allEmpty) return startY;

  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);
  doc.text("Signos vitales", 14, y);
  y += 4;

  const body = [
    ["Tensi\u00f3n arterial", v.systolicMmHg !== null && v.diastolicMmHg !== null ? `${v.systolicMmHg}/${v.diastolicMmHg} mmHg` : "—"],
    ["Frecuencia card\u00edaca", v.heartRateBpm !== null ? `${v.heartRateBpm} lpm` : "—"],
    ["Temperatura", v.temperatureC !== null ? `${v.temperatureC.toFixed(1)} \u00b0C` : "—"],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Par\u00e1metro", "Valor"]],
    body,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white },
    columnStyles: { 0: { cellWidth: 80, fontStyle: "bold" }, 1: { cellWidth: 102 } },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  return y;
}

function addAnthropometry(doc: jsPDF, a: PdfConsultationData["anthropometry"], startY: number): number {
  if (!a) return startY;
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);
  doc.text(`Antropometr\u00eda (${a.measuredAt})`, 14, y);
  y += 4;

  const body: string[][] = [];
  if (a.weightKg !== null) body.push(["Peso", `${a.weightKg.toFixed(1)} kg`]);
  if (a.heightCm !== null) body.push(["Talla", `${a.heightCm.toFixed(1)} cm`]);
  if (a.bmi !== null) body.push(["IMC", `${a.bmi.toFixed(1)} kg/m\u00b2`]);
  if (body.length === 0) return startY;

  autoTable(doc, {
    startY: y,
    head: [["Medida", "Valor"]],
    body,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5 },
    headStyles: { fontStyle: "bold", fontSize: 9, textColor: COLORS.secondary, fillColor: COLORS.white },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 102 } },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  return y;
}

function addLab(doc: jsPDF, l: PdfConsultationData["labPanel"], startY: number): number {
  if (!l) return startY;
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);
  doc.text(`Laboratorio (${l.takenAt})`, 14, y);
  y += 4;

  const body: string[][] = [];
  if (l.glucose !== null) body.push(["Glucosa", `${l.glucose} mg/dL`]);
  if (l.cholesterol !== null) body.push(["Colesterol total", `${l.cholesterol} mg/dL`]);
  if (l.triglycerides !== null) body.push(["Triglic\u00e9ridos", `${l.triglycerides} mg/dL`]);
  if (body.length === 0) return startY;

  autoTable(doc, {
    startY: y,
    head: [["Par\u00e1metro", "Valor"]],
    body,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5 },
    headStyles: { fontStyle: "bold", fontSize: 9, textColor: COLORS.secondary, fillColor: COLORS.white },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 102 } },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  return y;
}

function addSoapSection(doc: jsPDF, label: string, content: string | null, startY: number): number {
  let y = startY;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.text(label, 14, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);

  const text = content?.trim() || "—";
  const split = doc.splitTextToSize(text, 182);
  doc.text(split, 14, y);
  y += split.length * 4 + 4;
  return y;
}

function addReason(doc: jsPDF, data: PdfConsultationData, startY: number): number {
  let y = startY;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(...COLORS.bgHeader);
  doc.rect(14, y - 4, 182, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);
  doc.text("Motivo de consulta", 16, y + 1);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);
  const split = doc.splitTextToSize(data.reason, 182);
  doc.text(split, 14, y);
  y += split.length * 4 + 4;
  return y;
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
    doc.text("NutriClinica \u2014 Nota de consulta", 14, 293);
    doc.text(`P\u00e1gina ${i} de ${pageCount}`, 196, 293, { align: "right" as const });
  }
}

export function generateConsultationPdf(data: PdfConsultationData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addHeader(doc);
  addPatientInfo(doc, data);

  let y = 84;
  y = addVitalsTable(doc, data, y);
  y = addAnthropometry(doc, data.anthropometry, y);
  y = addLab(doc, data.labPanel, y);
  y = addReason(doc, data, y);
  y = addSoapSection(doc, "S — Subjetivo", data.subjective, y);
  y = addSoapSection(doc, "O — Objetivo", data.objective, y);
  y = addSoapSection(doc, "A — Diagn\u00f3stico nutricional", data.assessment, y);
  addSoapSection(doc, "P — Plan", data.plan, y);

  addFooter(doc);
  return doc;
}

export function downloadConsultationPdf(doc: jsPDF, fileName: string): void {
  doc.save(fileName);
}

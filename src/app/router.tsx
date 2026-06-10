import { Outlet, RouterProvider, createHashRouter, Navigate } from "react-router-dom";
import * as React from "react";
import { AppLayout } from "@app/layout/AppLayout";
import { NewPatientPage } from "@app/pages/patients/NewPatientPage";
import { NewConsultationPage } from "@app/pages/consultations/NewConsultationPage";
import { PatientConsultationsPage } from "@app/pages/consultations/PatientConsultationsPage";
import { PatientMeasurementsPage } from "@app/pages/anthropometry/PatientMeasurementsPage";
import { NewMeasurementPage } from "@app/pages/anthropometry/NewMeasurementPage";
import { PatientLabPage } from "@app/pages/laboratory/PatientLabPage";
import { NewLabPanelPage } from "@app/pages/laboratory/NewLabPanelPage";
import { CalculationsPage } from "@app/pages/CalculationsPage";
import { PatientMealPlansPage } from "@app/pages/plans/PatientMealPlansPage";
import { NewMealPlanPage } from "@app/pages/plans/NewMealPlanPage";
import { SettingsPage } from "@app/pages/SettingsPage";
import { SmaeCatalogPage } from "@app/pages/SmaeCatalogPage";
import { AgendaPage } from "@app/pages/agenda/AgendaPage";
import { RecipesPage } from "@app/pages/recipes/RecipesPage";
import { DocumentsPage } from "@app/pages/documents/DocumentsPage";
import { MealPlannerPage } from "@app/pages/meal-planner/MealPlannerPage";
import { GoalsPage } from "@app/pages/goals/GoalsPage";
import { AdherencePage } from "@app/pages/adherence/AdherencePage";
import { PatientAdherencePage } from "@app/pages/patients/PatientAdherencePage";
import { MedicationsPage } from "@app/pages/medications/MedicationsPage";
import { ReportsPage } from "@app/pages/reports/ReportsPage";
import { ImporterPage } from "@app/pages/ImporterPage";
import { HelpPage } from "@app/pages/HelpPage";
import { NotFoundPage } from "@app/pages/NotFoundPage";
import { NotificationsPage } from "@app/pages/NotificationsPage";
import { ProfilePage } from "@app/pages/ProfilePage";
import { TelemedicinaListPage } from "@app/pages/telemedicina/TelemedicinaListPage";
import { VideoCallRoomPage } from "@app/pages/telemedicina/VideoCallRoomPage";
import { NewTelemedicinaSalaPage } from "@app/pages/telemedicina/NewTelemedicinaSalaPage";
import { TwoFactorSetupPage } from "@modules/auth/ui/TwoFactorSetupPage";
import { ErrorBoundary } from "@app/ErrorBoundary";
import { PatientPortalPage } from "@app/pages/patient-portal/PatientPortalPage";
import { LoginPage } from "@modules/auth/ui/LoginPage";
import { RequireRole } from "@modules/auth/RequireRole";
import { BILLING_ROLES, BILLING_REPORT_ROLES } from "@modules/auth/authRoles";
import { useAuthStore } from "@store/authStore";

/**
 * Code-splitting con `React.lazy`.
 *
 * Cada chunk se carga on-demand al navegar a la ruta, lo que reduce
 * dramáticamente el bundle inicial y acelera el primer paint del
 * Dashboard / Login. Las páginas críticas de creación (NewXxxPage) y
 * las páginas con estado de URL directo se mantienen lazy también:
 *  - PacientesList, ConsultationsList, PlansList, Laboratory: listas pesadas con tablas / sort / paginación.
 *  - PatientDetail, Dashboard: vistas con muchos componentes UI.
 *  - ConsultationDetailPage, MealPlanDetailPage: importan `pdfService` que arrastra
 *    `jspdf` + `jspdf-autotable` + `html2canvas` (~600 KB total). Lazy para
 *    no penalizar el primer paint.
 *
 * Si una página es tan pequeña que el chunk es ridículo (<2KB), podría
 * dejarse eager, pero el patrón uniforme simplifica el mantenimiento.
 */
const DashboardPage = React.lazy(() =>
  import("@app/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const PatientsListPage = React.lazy(() =>
  import("@app/pages/patients/PatientsListPage").then((m) => ({ default: m.PatientsListPage })),
);
const PatientDetailPage = React.lazy(() =>
  import("@app/pages/patients/PatientDetailPage").then((m) => ({ default: m.PatientDetailPage })),
);
const ConsultationsListPage = React.lazy(() =>
  import("@app/pages/consultations/ConsultationsListPage").then((m) => ({
    default: m.ConsultationsListPage,
  })),
);
const ConsultationDetailPage = React.lazy(() =>
  import("@app/pages/consultations/ConsultationDetailPage").then((m) => ({
    default: m.ConsultationDetailPage,
  })),
);
const PlansListPage = React.lazy(() =>
  import("@app/pages/plans/PlansListPage").then((m) => ({ default: m.PlansListPage })),
);
const MealPlanDetailPage = React.lazy(() =>
  import("@app/pages/plans/MealPlanDetailPage").then((m) => ({ default: m.MealPlanDetailPage })),
);
const LaboratoryPage = React.lazy(() =>
  import("@app/pages/LaboratoryPage").then((m) => ({ default: m.LaboratoryPage })),
);
const BillingPage = React.lazy(() =>
  import("@app/pages/billing/BillingPage").then((m) => ({ default: m.BillingPage })),
);
const BillingReportPage = React.lazy(() =>
  import("@app/pages/billing/BillingReportPage").then((m) => ({ default: m.BillingReportPage })),
);
const ReceiptPage = React.lazy(() =>
  import("@app/pages/billing/ReceiptPage").then((m) => ({ default: m.ReceiptPage })),
);

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

const router = createHashRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/portal/:token",
    element: (
      <ErrorBoundary>
        <PatientPortalPage />
      </ErrorBoundary>
    ),
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <ErrorBoundary>
          <AppLayout />
        </ErrorBoundary>
      </RequireAuth>
    ),
    errorElement: <ErrorBoundaryRoute />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: "pacientes",
        children: [
          { index: true, element: <PatientsListPage /> },
          { path: "nuevo", element: <NewPatientPage /> },
          { path: ":patientId", element: <PatientDetailPage /> },
          { path: ":patientId/editar", element: <NewPatientPage /> },
          {
            path: ":patientId/antropometria",
            children: [
              { index: true, element: <PatientMeasurementsPage /> },
              { path: "nueva", element: <NewMeasurementPage /> },
            ],
          },
          {
            path: ":patientId/laboratorio",
            children: [
              { index: true, element: <PatientLabPage /> },
              { path: "nuevo", element: <NewLabPanelPage /> },
            ],
          },
          {
            path: ":patientId/consultas",
            children: [
              { index: true, element: <PatientConsultationsPage /> },
              { path: "nueva", element: <NewConsultationPage /> },
            ],
          },
          {
            path: ":patientId/planes",
            children: [
              { index: true, element: <PatientMealPlansPage /> },
              { path: "nuevo", element: <NewMealPlanPage /> },
            ],
          },
          {
            path: ":patientId/adherencia",
            children: [
              { index: true, element: <PatientAdherencePage /> },
            ],
          },
        ],
      },
      {
        path: "consultas",
        children: [
          { index: true, element: <ConsultationsListPage /> },
          { path: "nueva", element: <NewConsultationPage /> },
          { path: ":consultationId", element: <ConsultationDetailPage /> },
        ],
      },
      { path: "laboratorio", element: <LaboratoryPage /> },
      {
        path: "billing",
        children: [
          {
            index: true,
            element: (
              <RequireRole roles={BILLING_ROLES} redirectTo="/">
                <BillingPage />
              </RequireRole>
            ),
          },
          {
            path: "report",
            element: (
              <RequireRole roles={BILLING_REPORT_ROLES} redirectTo="/billing">
                <BillingReportPage />
              </RequireRole>
            ),
          },
          {
            path: ":consultationId/receipt",
            element: <ReceiptPage />,
          },
        ],
      },
      { path: "calculos", element: <CalculationsPage /> },
      { path: "smae", element: <SmaeCatalogPage /> },
      { path: "recetas", element: <RecipesPage /> },
      { path: "objetivos", element: <GoalsPage /> },
      { path: "adherencia", element: <AdherencePage /> },
      { path: "documentos", element: <DocumentsPage /> },
      { path: "plan-semanal", element: <MealPlannerPage /> },
      { path: "importar", element: <ImporterPage /> },
      {
        path: "planes",
        children: [
          { index: true, element: <PlansListPage /> },
          { path: ":planId", element: <MealPlanDetailPage /> },
        ],
      },
      { path: "medicamentos", element: <MedicationsPage /> },
      { path: "reportes", element: <ReportsPage /> },
      { path: "agenda", element: <AgendaPage /> },
      { path: "notificaciones", element: <NotificationsPage /> },
      { path: "perfil", element: <ProfilePage /> },
      { path: "configuracion", element: <SettingsPage /> },
      {
        path: "seguridad",
        children: [
          { index: true, element: <Navigate to="/seguridad/2fa" replace /> },
          { path: "2fa", element: <TwoFactorSetupPage /> },
        ],
      },
      {
        path: "telemedicina",
        children: [
          { index: true, element: <TelemedicinaListPage /> },
          { path: "nueva", element: <NewTelemedicinaSalaPage /> },
          { path: ":id", element: <VideoCallRoomPage /> },
        ],
      },
      { path: "ayuda", element: <HelpPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

function ErrorBoundaryRoute() {
  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  );
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}

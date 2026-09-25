import { Outlet, RouterProvider, createHashRouter, Navigate } from "react-router-dom";
import * as React from "react";
import { ErrorBoundary } from "@app/ErrorBoundary";
import { RequireRole } from "@modules/auth/RequireRole";
import { RequireModule } from "@modules/auth/RequireModule";
import { BILLING_ROLES, BILLING_REPORT_ROLES } from "@modules/auth/authRoles";
import { useAuthStore } from "@store/authStore";
import { dashboardRouteLoaders } from "@app/dashboardRoutePreloaders";

function lazyPage(loader: () => Promise<unknown>, exportName: string) {
  return React.lazy(async () => {
    const module = await loader() as Record<string, React.ComponentType>;
    return { default: module[exportName]! };
  });
}

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
const AppLayout = lazyPage(() => import("@app/layout/AppLayout"), "AppLayout");
const LoginPage = lazyPage(() => import("@modules/auth/ui/LoginPage"), "LoginPage");
const PatientPortalPage = lazyPage(() => import("@app/pages/patient-portal/PatientPortalPage"), "PatientPortalPage");
const DashboardPage = lazyPage(dashboardRouteLoaders["/"], "DashboardPage");
const PatientsListPage = lazyPage(dashboardRouteLoaders["/pacientes"], "PatientsListPage");
const NewPatientPage = lazyPage(() => import("@app/pages/patients/NewPatientPage"), "NewPatientPage");
const PatientDetailPage = lazyPage(() => import("@app/pages/patients/PatientDetailPage"), "PatientDetailPage");
const PatientMeasurementsPage = lazyPage(() => import("@app/pages/anthropometry/PatientMeasurementsPage"), "PatientMeasurementsPage");
const NewMeasurementPage = lazyPage(() => import("@app/pages/anthropometry/NewMeasurementPage"), "NewMeasurementPage");
const PatientLabPage = lazyPage(() => import("@app/pages/laboratory/PatientLabPage"), "PatientLabPage");
const NewLabPanelPage = lazyPage(() => import("@app/pages/laboratory/NewLabPanelPage"), "NewLabPanelPage");
const ScanLabPanelPage = lazyPage(() => import("@app/pages/laboratory/ScanLabPanelPage"), "ScanLabPanelPage");
const PatientConsultationsPage = lazyPage(() => import("@app/pages/consultations/PatientConsultationsPage"), "PatientConsultationsPage");
const NewConsultationPage = lazyPage(() => import("@app/pages/consultations/NewConsultationPage"), "NewConsultationPage");
const PatientMealPlansPage = lazyPage(() => import("@app/pages/plans/PatientMealPlansPage"), "PatientMealPlansPage");
const NewMealPlanPage = lazyPage(() => import("@app/pages/plans/NewMealPlanPage"), "NewMealPlanPage");
const PatientAdherencePage = lazyPage(() => import("@app/pages/patients/PatientAdherencePage"), "PatientAdherencePage");
const ConsultationsListPage = lazyPage(dashboardRouteLoaders["/consultas"], "ConsultationsListPage");
const ConsultationDetailPage = lazyPage(() => import("@app/pages/consultations/ConsultationDetailPage"), "ConsultationDetailPage");
const LaboratoryPage = lazyPage(() => import("@app/pages/LaboratoryPage"), "LaboratoryPage");
const BillingPage = lazyPage(dashboardRouteLoaders["/billing"], "BillingPage");
const BillingReportPage = lazyPage(() => import("@app/pages/billing/BillingReportPage"), "BillingReportPage");
const ReceiptPage = lazyPage(() => import("@app/pages/billing/ReceiptPage"), "ReceiptPage");
const ExpensesPage = lazyPage(() => import("@app/pages/expenses/ExpensesPage"), "ExpensesPage");
const PaymentsPage = lazyPage(() => import("@app/pages/payments/PaymentsPage"), "PaymentsPage");
const CalculationsPage = lazyPage(() => import("@app/pages/CalculationsPage"), "CalculationsPage");
const SmaeCatalogPage = lazyPage(dashboardRouteLoaders["/smae"], "SmaeCatalogPage");
const RecipesPage = lazyPage(() => import("@app/pages/recipes/RecipesPage"), "RecipesPage");
const GoalsPage = lazyPage(() => import("@app/pages/goals/GoalsPage"), "GoalsPage");
const AdherencePage = lazyPage(() => import("@app/pages/adherence/AdherencePage"), "AdherencePage");
const DocumentsPage = lazyPage(() => import("@app/pages/documents/DocumentsPage"), "DocumentsPage");
const MealPlannerPage = lazyPage(() => import("@app/pages/meal-planner/MealPlannerPage"), "MealPlannerPage");
const ImporterPage = lazyPage(() => import("@app/pages/ImporterPage"), "ImporterPage");
const PlansListPage = lazyPage(dashboardRouteLoaders["/planes"], "PlansListPage");
const MealPlanDetailPage = lazyPage(() => import("@app/pages/plans/MealPlanDetailPage"), "MealPlanDetailPage");
const MedicationsPage = lazyPage(() => import("@app/pages/medications/MedicationsPage"), "MedicationsPage");
const ReportsPage = lazyPage(() => import("@app/pages/reports/ReportsPage"), "ReportsPage");
const AgendaPage = lazyPage(dashboardRouteLoaders["/agenda"], "AgendaPage");
const NotificationsPage = lazyPage(() => import("@app/pages/NotificationsPage"), "NotificationsPage");
const ProfilePage = lazyPage(() => import("@app/pages/ProfilePage"), "ProfilePage");
const SettingsPage = lazyPage(dashboardRouteLoaders["/configuracion"], "SettingsPage");
const TwoFactorSetupPage = lazyPage(() => import("@modules/auth/ui/TwoFactorSetupPage"), "TwoFactorSetupPage");
const TelemedicinaListPage = lazyPage(() => import("@app/pages/telemedicina/TelemedicinaListPage"), "TelemedicinaListPage");
const NewTelemedicinaSalaPage = lazyPage(() => import("@app/pages/telemedicina/NewTelemedicinaSalaPage"), "NewTelemedicinaSalaPage");
const VideoCallRoomPage = lazyPage(() => import("@app/pages/telemedicina/VideoCallRoomPage"), "VideoCallRoomPage");
const HelpPage = lazyPage(() => import("@app/pages/HelpPage"), "HelpPage");
const NotFoundPage = lazyPage(() => import("@app/pages/NotFoundPage"), "NotFoundPage");

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
    element: (
      <ErrorBoundary>
        <LoginPage />
      </ErrorBoundary>
    ),
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
        element: (
          <RequireModule module="patients">
            <Outlet />
          </RequireModule>
        ),
        children: [
          { index: true, element: <PatientsListPage /> },
          {
            path: "nuevo",
            element: (
              <RequireModule module="patients" action="write">
                <NewPatientPage />
              </RequireModule>
            ),
          },
          {
            path: "importar",
            element: (
              <RequireModule module="patients" action="write">
                <ImporterPage />
              </RequireModule>
            ),
          },
          { path: ":patientId", element: <PatientDetailPage /> },
          {
            path: ":patientId/editar",
            element: (
              <RequireModule module="patients" action="write">
                <NewPatientPage />
              </RequireModule>
            ),
          },
          {
            path: ":patientId/antropometria",
            element: (
              <RequireModule module="anthropometry">
                <Outlet />
              </RequireModule>
            ),
            children: [
              { index: true, element: <PatientMeasurementsPage /> },
              {
                path: "nueva",
                element: (
                  <RequireModule module="anthropometry" action="write">
                    <NewMeasurementPage />
                  </RequireModule>
                ),
              },
            ],
          },
          {
            path: ":patientId/laboratorio",
            element: (
              <RequireModule module="laboratory">
                <Outlet />
              </RequireModule>
            ),
            children: [
              { index: true, element: <PatientLabPage /> },
              {
                path: "nuevo",
                element: (
                  <RequireModule module="laboratory" action="write">
                    <NewLabPanelPage />
                  </RequireModule>
                ),
              },
              {
                path: "scan",
                element: (
                  <RequireModule module="laboratory" action="write">
                    <ScanLabPanelPage />
                  </RequireModule>
                ),
              },
            ],
          },
          {
            path: ":patientId/consultas",
            element: (
              <RequireModule module="consultations">
                <Outlet />
              </RequireModule>
            ),
            children: [
              { index: true, element: <PatientConsultationsPage /> },
              {
                path: "nueva",
                element: (
                  <RequireModule module="consultations" action="write">
                    <NewConsultationPage />
                  </RequireModule>
                ),
              },
            ],
          },
          {
            path: ":patientId/planes",
            element: (
              <RequireModule module="mealplan">
                <Outlet />
              </RequireModule>
            ),
            children: [
              { index: true, element: <PatientMealPlansPage /> },
              {
                path: "nuevo",
                element: (
                  <RequireModule module="mealplan" action="write">
                    <NewMealPlanPage />
                  </RequireModule>
                ),
              },
            ],
          },
          {
            path: ":patientId/adherencia",
            element: (
              <RequireModule module="adherence">
                <Outlet />
              </RequireModule>
            ),
            children: [
              { index: true, element: <PatientAdherencePage /> },
            ],
          },
        ],
      },
      {
        path: "consultas",
        element: (
          <RequireRole
            roles={["admin", "nutriologa", "asistente", "soporte_tecnico", "auditor"]}
            redirectTo="/"
          >
            <Outlet />
          </RequireRole>
        ),
        children: [
          { index: true, element: <ConsultationsListPage /> },
          {
            path: "nueva",
            element: (
              <RequireModule module="consultations" action="write">
                <NewConsultationPage />
              </RequireModule>
            ),
          },
          { path: ":consultationId", element: <ConsultationDetailPage /> },
        ],
      },
      {
        path: "laboratorio",
        element: (
          <RequireModule module="laboratory">
            <LaboratoryPage />
          </RequireModule>
        ),
      },
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
            element: (
              <RequireRole roles={BILLING_ROLES} redirectTo="/billing">
                <ReceiptPage />
              </RequireRole>
            ),
          },
          {
            path: "expenses",
            element: (
              <RequireRole roles={BILLING_ROLES} redirectTo="/billing">
                <ExpensesPage />
              </RequireRole>
            ),
          },
          {
            path: "payments",
            element: (
              <RequireRole roles={BILLING_ROLES} redirectTo="/billing">
                <PaymentsPage />
              </RequireRole>
            ),
          },
        ],
      },
      { path: "calculos", element: <CalculationsPage /> },
      { path: "smae", element: <SmaeCatalogPage /> },
      {
        path: "recetas",
        element: (
          <RequireModule module="recipes">
            <RecipesPage />
          </RequireModule>
        ),
      },
      {
        path: "objetivos",
        element: (
          <RequireModule module="goals">
            <GoalsPage />
          </RequireModule>
        ),
      },
      {
        path: "adherencia",
        element: (
          <RequireModule module="adherence">
            <AdherencePage />
          </RequireModule>
        ),
      },
      {
        path: "documentos",
        element: (
          <RequireModule module="documents">
            <DocumentsPage />
          </RequireModule>
        ),
      },
      {
        path: "plan-semanal",
        element: (
          <RequireModule module="meal-planner">
            <MealPlannerPage />
          </RequireModule>
        ),
      },
      {
        path: "importar",
        element: (
          <RequireModule module="patients" action="write">
            <ImporterPage />
          </RequireModule>
        ),
      },
      {
        path: "planes",
        element: (
          <RequireModule module="mealplan">
            <Outlet />
          </RequireModule>
        ),
        children: [
          { index: true, element: <PlansListPage /> },
          { path: ":planId", element: <MealPlanDetailPage /> },
        ],
      },
      {
        path: "medicamentos",
        element: (
          <RequireModule module="medications">
            <MedicationsPage />
          </RequireModule>
        ),
      },
      {
        path: "reportes",
        element: (
          <RequireModule module="reports">
            <ReportsPage />
          </RequireModule>
        ),
      },
      {
        path: "agenda",
        element: (
          <RequireModule module="agenda">
            <AgendaPage />
          </RequireModule>
        ),
      },
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

function RouterFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8 text-sm text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        Cargando...
      </div>
    </div>
  );
}

export function AppRouter() {
  return (
    <React.Suspense fallback={<RouterFallback />}>
      <RouterProvider router={router} />
    </React.Suspense>
  );
}

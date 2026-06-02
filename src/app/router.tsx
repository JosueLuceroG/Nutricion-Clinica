import { Outlet, RouterProvider, createHashRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@app/layout/AppLayout";
import { DashboardPage } from "@app/pages/DashboardPage";
import { PatientsListPage } from "@app/pages/patients/PatientsListPage";
import { PatientDetailPage } from "@app/pages/patients/PatientDetailPage";
import { NewPatientPage } from "@app/pages/patients/NewPatientPage";
import { ConsultationsListPage } from "@app/pages/consultations/ConsultationsListPage";
import { NewConsultationPage } from "@app/pages/consultations/NewConsultationPage";
import { ConsultationDetailPage } from "@app/pages/consultations/ConsultationDetailPage";
import { PatientConsultationsPage } from "@app/pages/consultations/PatientConsultationsPage";
import { PatientMeasurementsPage } from "@app/pages/anthropometry/PatientMeasurementsPage";
import { NewMeasurementPage } from "@app/pages/anthropometry/NewMeasurementPage";
import { PatientLabPage } from "@app/pages/laboratory/PatientLabPage";
import { NewLabPanelPage } from "@app/pages/laboratory/NewLabPanelPage";
import { LaboratoryPage } from "@app/pages/LaboratoryPage";
import { CalculationsPage } from "@app/pages/CalculationsPage";
import { PlansListPage } from "@app/pages/plans/PlansListPage";
import { MealPlanDetailPage } from "@app/pages/plans/MealPlanDetailPage";
import { PatientMealPlansPage } from "@app/pages/plans/PatientMealPlansPage";
import { NewMealPlanPage } from "@app/pages/plans/NewMealPlanPage";
import { SettingsPage } from "@app/pages/SettingsPage";
import { SmaeCatalogPage } from "@app/pages/SmaeCatalogPage";
import { HelpPage } from "@app/pages/HelpPage";
import { NotFoundPage } from "@app/pages/NotFoundPage";
import { NotificationsPage } from "@app/pages/NotificationsPage";
import { ProfilePage } from "@app/pages/ProfilePage";
import { ErrorBoundary } from "@app/ErrorBoundary";

const router = createHashRouter([
  {
    path: "/",
    element: (
      <ErrorBoundary>
        <AppLayout />
      </ErrorBoundary>
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
      { path: "calculos", element: <CalculationsPage /> },
      { path: "smae", element: <SmaeCatalogPage /> },
      {
        path: "planes",
        children: [
          { index: true, element: <PlansListPage /> },
          { path: ":planId", element: <MealPlanDetailPage /> },
        ],
      },
      { path: "agenda", element: <Navigate to="/consultas" replace /> },
      { path: "notificaciones", element: <NotificationsPage /> },
      { path: "perfil", element: <ProfilePage /> },
      { path: "configuracion", element: <SettingsPage /> },
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

type RouteModuleLoader = () => Promise<unknown>;

export const dashboardRouteLoaders = {
  "/": () => import("@app/pages/dashboard/DashboardPage"),
  "/pacientes": () => import("@app/pages/patients/PatientsListPage"),
  "/consultas": () => import("@app/pages/consultations/ConsultationsListPage"),
  "/agenda": () => import("@app/pages/agenda/AgendaPage"),
  "/planes": () => import("@app/pages/plans/PlansListPage"),
  "/smae": () => import("@app/pages/SmaeCatalogPage"),
  "/billing": () => import("@app/pages/billing/BillingPage"),
  "/configuracion": () => import("@app/pages/SettingsPage"),
} satisfies Record<string, RouteModuleLoader>;

export function preloadDashboardRoute(path: string) {
  const loader = dashboardRouteLoaders[path as keyof typeof dashboardRouteLoaders];
  if (loader) void loader().catch(() => undefined);
}

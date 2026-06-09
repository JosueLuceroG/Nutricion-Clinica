import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Module mocks (hoisted before all imports) ───────────────────────────────

vi.mock("@modules/consultation/ui/useBillingHooks", () => ({
  usePendingPayments: vi.fn(),
  useConsultationLive: vi.fn(),
  usePatientLive: vi.fn(),
}));

vi.mock("@modules/consultation/ui/useFinancialReport", () => ({
  useFinancialReport: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("recharts", () => {
  const E = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: E,
    BarChart: E,
    Bar: () => <div />,
    CartesianGrid: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    Tooltip: () => <div />,
    Legend: () => <div />,
  };
});

vi.mock("@app/layout/AppLayout", () => ({
  PageHeader: ({ title, description, actions }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {description && <p data-testid="page-desc">{description}</p>}
      {actions}
    </div>
  ),
  PageContent: ({ children }: any) => <div data-testid="page-content">{children}</div>,
}));

vi.mock("@modules/consultation/ui/MarkAsPaidDialog", () => ({
  MarkAsPaidDialog: () => <div data-testid="mark-dialog" />,
}));

vi.mock("@store/uiStore", () => ({
  useUIStore: (selector: any) =>
    selector({ sidebarCollapsed: false, toggleSidebar: vi.fn() }),
}));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(() => null),
}));

vi.mock("@services/db", () => ({
  db: {},
}));

vi.mock("@components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("@components/ui/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher" />,
}));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty" as const, init: () => {} },
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "nav.main_menu": "Navegación principal",
        "nav.general": "General",
        "nav.finance": "Finanzas",
        "nav.billing": "Facturación",
        "nav.dashboard": "Dashboard",
        "nav.patients": "Pacientes",
        "nav.consultations": "Consultas",
        "nav.agenda": "Agenda",
        "nav.laboratory": "Laboratorio",
        "nav.calculations": "Cálculos clínicos",
        "nav.goals": "Objetivos clínicos",
        "nav.adherence": "Adherencia",
        "nav.medications": "Medicamentos",
        "nav.meal_plans": "Planes alimentarios",
        "nav.recipes": "Recetario",
        "nav.documents": "Documentos",
        "nav.reports": "Reportes",
        "nav.smae_catalog": "Catálogo SMAE",
        "nav.import": "Importar pacientes",
        "nav.settings": "Configuración",
        "nav.help": "Ayuda",
        "nav.expand": "Expandir menú",
        "nav.collapse": "Colapsar",
        "common.app_name": "NutriClinica",
      };
      return map[key] ?? key;
    },
    i18n: { language: "es-MX", changeLanguage: () => {} },
  }),
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: (selector: any) =>
    selector({ user: { rol: "facturacion" } }),
}));

vi.mock("@modules/auth/authRoles", () => ({
  isBillingRole: vi.fn(),
  isBillingReportRole: vi.fn(),
  useCurrentRole: vi.fn(() => "facturacion"),
  hasAnyRole: vi.fn(),
  BILLING_ROLES: ["admin", "facturacion", "asistente"],
  BILLING_REPORT_ROLES: ["admin", "facturacion"],
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useParams: vi.fn() };
});

// ─── Component imports ───────────────────────────────────────────────────────

import { usePendingPayments, useConsultationLive } from "@modules/consultation/ui/useBillingHooks";
import { useFinancialReport } from "@modules/consultation/ui/useFinancialReport";
import { useParams } from "react-router-dom";
import * as authRoles from "@modules/auth/authRoles";
import { BillingPage } from "@app/pages/billing/BillingPage";
import { BillingReportPage } from "@app/pages/billing/BillingReportPage";
import { ReceiptPage } from "@app/pages/billing/ReceiptPage";
import { Sidebar } from "@app/layout/Sidebar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

const mockPendingItem = (overrides: Record<string, any> = {}) => ({
  consultation: {
    id: overrides.id ?? "1",
    consultationDate: new Date("2026-06-01"),
    consultationNumber: 1,
    reason: "Control de rutina",
    cost: 500,
    patientId: overrides.patientId ?? "p1",
    ...(overrides.consultation ?? {}),
  },
  patientName: overrides.patientName ?? "Ana Pérez",
  patientId: overrides.patientId ?? "p1",
});

const mockReport = () => ({
  totalIncome: 5000,
  totalPending: 1000,
  paidCount: 10,
  pendingCount: 2,
  activePatients: 5,
  monthly: [
    { monthKey: "2026-01", label: "Ene 2026", income: 3000, pending: 500, paidCount: 6, pendingCount: 1 },
    { monthKey: "2026-02", label: "Feb 2026", income: 2000, pending: 500, paidCount: 4, pendingCount: 1 },
  ],
  rangeStart: new Date("2026-01-01"),
  rangeEnd: new Date("2026-06-01"),
  topPatients: [
    { patientId: "1", patientName: "Ana Pérez", consultations: 3, totalPaid: 3000 },
    { patientId: "2", patientName: "Luis López", consultations: 2, totalPaid: 2000 },
  ],
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("BillingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is exported", () => {
    expect(BillingPage).toBeDefined();
  });

  it("renders empty state when there are no pending payments", () => {
    vi.mocked(usePendingPayments).mockReturnValue({ items: [], total: 0, totalAmount: 0, registerPayment: vi.fn() });
    render(<BillingPage />, { wrapper });
    expect(screen.getByText("billing.no_pending")).toBeInTheDocument();
    expect(screen.getByText("billing.title · billing.pending_payments")).toBeInTheDocument();
  });

  it("renders table with pending payments when items exist", () => {
    vi.mocked(usePendingPayments).mockReturnValue({
      items: [mockPendingItem()],
      total: 1,
      totalAmount: 500,
      registerPayment: vi.fn(),
    });
    render(<BillingPage />, { wrapper });
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("billing.pay")).toBeInTheDocument();
  });
});

describe("BillingReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is exported", () => {
    expect(BillingReportPage).toBeDefined();
  });

  it("renders loading state while report is null", () => {
    vi.mocked(useFinancialReport).mockReturnValue(null);
    render(<BillingReportPage />, { wrapper });
    expect(screen.getByText("billing.report_title")).toBeInTheDocument();
  });

  it("renders KPIs and top patients when report data is loaded", () => {
    vi.mocked(useFinancialReport).mockReturnValue(mockReport());
    render(<BillingReportPage />, { wrapper });
    expect(screen.getByText("billing.paid_consultations")).toBeInTheDocument();
    expect(screen.getByText("billing.active_patients")).toBeInTheDocument();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("Luis López")).toBeInTheDocument();
  });
});

describe("ReceiptPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is exported", () => {
    expect(ReceiptPage).toBeDefined();
  });

  it("shows missing-ID message when consultationId param is absent", () => {
    vi.mocked(useParams).mockReturnValue({});
    render(
      <MemoryRouter initialEntries={["/billing/recibo"]}>
        <ReceiptPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("billing.receipt_title")).toBeInTheDocument();
  });

  it("shows loading skeleton while consultation is being fetched", () => {
    vi.mocked(useConsultationLive).mockReturnValue(null);
    vi.mocked(useParams).mockReturnValue({ consultationId: "abc-123" });
    render(
      <MemoryRouter initialEntries={["/billing/recibo/abc-123"]}>
        <ReceiptPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("common.loading billing.receipt_title")).toBeInTheDocument();
  });

});

describe("Sidebar billing section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Finanzas / Facturación when user has a billing role", () => {
    vi.mocked(authRoles.isBillingRole).mockReturnValue(true);
    render(<Sidebar />, { wrapper });
    expect(screen.getByText("Finanzas")).toBeInTheDocument();
    expect(screen.getByText("Facturación")).toBeInTheDocument();
  });

  it("hides Finanzas / Facturación when user does NOT have a billing role", () => {
    vi.mocked(authRoles.isBillingRole).mockReturnValue(false);
    render(<Sidebar />, { wrapper });
    expect(screen.queryByText("Finanzas")).not.toBeInTheDocument();
    expect(screen.queryByText("Facturación")).not.toBeInTheDocument();
  });
});

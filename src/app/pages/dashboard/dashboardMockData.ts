import {
  AlarmClock,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  ReceiptText,
  Send,
  Star,
  UserPlus,
  UsersRound,
  UtensilsCrossed,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { DashboardPremiumKpiId } from "@store/preferencesStore";

export type DashboardKpiTone = "green" | "blue" | "purple" | "orange";

export interface DashboardKpiItem {
  id: DashboardPremiumKpiId;
  label: string;
  value: string;
  trend?: string;
  hint: string;
  tone: DashboardKpiTone;
  icon: LucideIcon;
  to: string;
}

export const dashboardKpis: DashboardKpiItem[] = [
  {
    id: "activePatients",
    label: "Pacientes activos",
    value: "38",
    trend: "↑ 12 %",
    hint: "Total registrados",
    tone: "green",
    icon: UsersRound,
    to: "/pacientes",
  },
  {
    id: "consultationsToday",
    label: "Consultas de hoy",
    value: "8",
    hint: "De 10 agendadas",
    tone: "blue",
    icon: CalendarDays,
    to: "/agenda",
  },
  {
    id: "incomeThisMonth",
    label: "Ingresos del mes",
    value: "$850.50",
    trend: "↑ 8 %",
    hint: "Del 1 al 16 de jun.",
    tone: "purple",
    icon: CircleDollarSign,
    to: "/billing/report",
  },
  {
    id: "pendingPayments",
    label: "Pendiente de cobro",
    value: "$24,750.00",
    hint: "33 consultas pendientes",
    tone: "orange",
    icon: WalletCards,
    to: "/billing",
  },
];

export type ConsultationStatus = "Confirmada" | "Pendiente" | "En curso";

export interface UpcomingConsultationItem {
  time: string;
  patient: string;
  type: string;
  status: ConsultationStatus;
  avatar: string;
  avatarTone: "warm" | "cool" | "rose" | "slate";
}

export const upcomingConsultations: UpcomingConsultationItem[] = [
  {
    time: "09:00 a. m.",
    patient: "María González",
    type: "Control nutricional",
    status: "Confirmada",
    avatar: "MG",
    avatarTone: "warm",
  },
  {
    time: "10:30 a. m.",
    patient: "Carlos Ramírez",
    type: "Plan de alimentación",
    status: "Confirmada",
    avatar: "CR",
    avatarTone: "cool",
  },
  {
    time: "12:00 p. m.",
    patient: "Laura Méndez",
    type: "Evaluación inicial",
    status: "Confirmada",
    avatar: "LM",
    avatarTone: "rose",
  },
  {
    time: "04:00 p. m.",
    patient: "Jorge Torres",
    type: "Seguimiento",
    status: "Pendiente",
    avatar: "JT",
    avatarTone: "slate",
  },
];

export interface WeeklyActivityPoint {
  day: string;
  consultas: number;
  nuevos: number;
}

export const weeklyActivityData: WeeklyActivityPoint[] = [
  { day: "Lun", consultas: 6, nuevos: 2 },
  { day: "Mar", consultas: 12, nuevos: 6 },
  { day: "Mié", consultas: 11, nuevos: 6 },
  { day: "Jue", consultas: 20, nuevos: 11 },
  { day: "Vie", consultas: 14, nuevos: 7 },
  { day: "Sáb", consultas: 15, nuevos: 8 },
  { day: "Dom", consultas: 8, nuevos: 3 },
];

export interface ActivitySummaryItem {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const weeklyActivitySummary: ActivitySummaryItem[] = [
  { value: "69", label: "Consultas", icon: CalendarDays },
  { value: "18", label: "Nuevos pacientes", icon: UsersRound },
  { value: "87%", label: "Adherencia prom.", icon: AlarmClock },
];

export type DashboardAlertTone = "pink" | "orange" | "amber";

export interface DashboardAlertItem {
  title: string;
  detail: string;
  count: string;
  tone: DashboardAlertTone;
  icon: LucideIcon;
}

export const dashboardAlerts: DashboardAlertItem[] = [
  {
    title: "33 consultas pendientes de cobro",
    detail: "Total: $24,750.00",
    count: "›",
    tone: "pink",
    icon: CircleDollarSign,
  },
  {
    title: "5 consultas sin confirmar",
    detail: "Requieren confirmación",
    count: "5",
    tone: "orange",
    icon: ClipboardCheck,
  },
  {
    title: "2 planes por vencer",
    detail: "Próximos 7 días",
    count: "2",
    tone: "amber",
    icon: Star,
  },
];

export type FinancialSummaryTone = "blue" | "green" | "orange";

export interface FinancialSummaryItem {
  label: string;
  value: string;
  detail: string;
  percent: number;
  tone: FinancialSummaryTone;
  icon: LucideIcon;
}

export interface FinancialSummaryData {
  total: string;
  trend: string;
  objective: string;
  collectionRate: string;
  items: FinancialSummaryItem[];
}

export const financialSummary: FinancialSummaryData = {
  total: "$25,600.50",
  trend: "+8.4% vs. mes anterior",
  objective: "72% del objetivo mensual",
  collectionRate: "72%",
  items: [
    {
      label: "Cobrado",
      value: "$850.50",
      detail: "Pagos confirmados",
      percent: 72,
      tone: "green",
      icon: Banknote,
    },
    {
      label: "Por cobrar",
      value: "$24,750.00",
      detail: "33 consultas pendientes",
      percent: 54,
      tone: "orange",
      icon: WalletCards,
    },
    {
      label: "Ticket promedio",
      value: "$750.00",
      detail: "Consulta presencial",
      percent: 82,
      tone: "blue",
      icon: CreditCard,
    },
  ],
};

export type RecentPaymentStatus = "Pagado" | "Pendiente" | "Parcial";

export interface RecentPaymentItem {
  patient: string;
  concept: string;
  amount: string;
  date: string;
  method: string;
  status: RecentPaymentStatus;
  avatar: string;
  avatarTone: "warm" | "cool" | "rose";
}

export const recentPayments: RecentPaymentItem[] = [
  {
    patient: "Ana López",
    concept: "Consulta inicial",
    amount: "$850.50",
    date: "Hoy",
    method: "Tarjeta",
    status: "Pagado",
    avatar: "AL",
    avatarTone: "warm",
  },
  {
    patient: "Luis Pérez",
    concept: "Seguimiento mensual",
    amount: "$750.00",
    date: "Ayer",
    method: "Transferencia",
    status: "Parcial",
    avatar: "LP",
    avatarTone: "cool",
  },
  {
    patient: "Sofía Hernández",
    concept: "Plan nutricional",
    amount: "$1,200.00",
    date: "15 jun.",
    method: "Efectivo",
    status: "Pendiente",
    avatar: "SH",
    avatarTone: "rose",
  },
];

export type QuickActionTone = "blue" | "green" | "purple" | "orange";

export interface QuickActionItem {
  label: string;
  detail: string;
  to: string;
  tone: QuickActionTone;
  icon: LucideIcon;
}

export const quickActions: QuickActionItem[] = [
  {
    label: "Agregar paciente",
    detail: "Crear expediente",
    to: "/pacientes/nuevo",
    tone: "blue",
    icon: UserPlus,
  },
  {
    label: "Nueva consulta",
    detail: "Registrar atención",
    to: "/consultas/nueva",
    tone: "green",
    icon: ClipboardCheck,
  },
  {
    label: "Registrar pago",
    detail: "Actualizar cobros",
    to: "/billing/payments",
    tone: "orange",
    icon: ReceiptText,
  },
  {
    label: "Crear plan",
    detail: "Ver planes activos",
    to: "/planes",
    tone: "purple",
    icon: UtensilsCrossed,
  },
  {
    label: "Enviar recordatorio",
    detail: "Pacientes pendientes",
    to: "/notificaciones",
    tone: "blue",
    icon: Send,
  },
];

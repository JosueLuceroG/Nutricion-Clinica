import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, LineChart as LineChartIcon } from "lucide-react";
import { DashboardSectionCard } from "./DashboardSectionCard";
import type { ActivitySummaryItem, WeeklyActivityPoint } from "./dashboardMockData";

interface WeeklyActivityCardProps {
  data: WeeklyActivityPoint[];
  summary: ActivitySummaryItem[];
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number | string;
}

function WeeklyTooltip({ active, label, payload }: { active?: boolean; label?: string; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const consultas = payload.find((item) => item.dataKey === "consultas")?.value ?? 0;
  const nuevos = payload.find((item) => item.dataKey === "nuevos")?.value ?? 0;
  const dayLabel = {
    Lun: "Lunes",
    Mar: "Martes",
    Mié: "Miércoles",
    Jue: "Jueves",
    Vie: "Viernes",
    Sáb: "Sábado",
    Dom: "Domingo",
  }[label ?? ""] ?? label;

  return (
    <div className="nc-dashboard-weekly-tooltip">
      <strong>{dayLabel}</strong>
      <span>{consultas} consultas</span>
      <span>{nuevos} nuevos pacientes</span>
    </div>
  );
}

export function WeeklyActivityCard({ data, summary }: WeeklyActivityCardProps) {
  const maxActivityValue = Math.max(0, ...data.flatMap((item) => [item.consultas, item.nuevos]));
  const yAxisMax = Math.max(5, Math.ceil(maxActivityValue / 5) * 5);

  return (
    <DashboardSectionCard
      title="Actividad semanal"
      icon={<LineChartIcon size={20} strokeWidth={1.9} />}
      action={
        <button type="button" className="nc-dashboard-period-button">
          Esta semana
          <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      }
      className="nc-dashboard-section-card--activity"
    >
      <div className="nc-dashboard-chart-legend" aria-hidden="true">
        <span className="nc-dashboard-chart-legend__item nc-dashboard-chart-legend__item--blue">Consultas</span>
        <span className="nc-dashboard-chart-legend__item nc-dashboard-chart-legend__item--teal">Nuevos pacientes</span>
      </div>

      <div className="nc-dashboard-weekly-chart" aria-label="Actividad semanal">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="weeklyBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563ff" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#2563ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e8eef8" strokeDasharray="4 5" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#52617f", fontSize: 12, fontWeight: 700 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#52617f", fontSize: 12, fontWeight: 700 }} domain={[0, yAxisMax]} tickCount={5} allowDecimals={false} />
            <Tooltip content={<WeeklyTooltip />} cursor={{ stroke: "#c9d8f3", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="consultas" stroke="#2563ff" strokeWidth={3} dot={false} activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 4, fill: "#2563ff" }} />
            <Line type="monotone" dataKey="nuevos" stroke="#10b7c8" strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 3, fill: "#10b7c8" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="nc-dashboard-weekly-summary">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="nc-dashboard-weekly-summary__item">
              <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
              <span>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </span>
            </div>
          );
        })}
      </div>
    </DashboardSectionCard>
  );
}

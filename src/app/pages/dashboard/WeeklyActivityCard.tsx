import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import { DashboardSectionCard } from "./DashboardSectionCard";
import type { ActivitySummaryItem, WeeklyActivityPoint } from "./dashboardMockData";

interface WeeklyActivityCardProps {
  weeklyData: WeeklyActivityPoint[];
  monthlyData: WeeklyActivityPoint[];
  weeklySummary: ActivitySummaryItem[];
  monthlySummary: ActivitySummaryItem[];
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

export function WeeklyActivityCard({ weeklyData, monthlyData, weeklySummary, monthlySummary }: WeeklyActivityCardProps) {
  const [period, setPeriod] = React.useState<"week" | "month">("week");
  const data = period === "week" ? weeklyData : monthlyData;
  const summary = period === "week" ? weeklySummary : monthlySummary;
  const maxActivityValue = Math.max(0, ...data.flatMap((item) => [item.consultas, item.nuevos]));
  const yAxisMax = Math.max(5, Math.ceil(maxActivityValue / 5) * 5);

  return (
    <DashboardSectionCard
      title={period === "week" ? "Actividad semanal" : "Actividad mensual"}
      icon={<LineChartIcon size={20} strokeWidth={1.9} />}
      action={
        <select
          className="nc-dashboard-period-button"
          value={period}
          onChange={(event) => setPeriod(event.target.value as "week" | "month")}
          aria-label="Periodo de actividad"
        >
          <option value="week">Semanal</option>
          <option value="month">Mensual</option>
        </select>
      }
      className="nc-dashboard-section-card--activity"
    >
      <div className="nc-dashboard-chart-legend" aria-hidden="true">
        <span className="nc-dashboard-chart-legend__item nc-dashboard-chart-legend__item--blue">Consultas</span>
        <span className="nc-dashboard-chart-legend__item nc-dashboard-chart-legend__item--teal">Nuevos pacientes</span>
      </div>

      <div className="nc-dashboard-weekly-chart" aria-label={period === "week" ? "Actividad semanal" : "Actividad mensual"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="weeklyBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563ff" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#2563ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--nc-chart-grid)" strokeDasharray="4 5" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--nc-chart-text)", fontSize: 12, fontWeight: 700 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--nc-chart-text)", fontSize: 12, fontWeight: 700 }} domain={[0, yAxisMax]} tickCount={5} allowDecimals={false} />
            <Tooltip content={<WeeklyTooltip />} cursor={{ stroke: "var(--nc-chart-cursor)", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="consultas" stroke="var(--nc-chart-blue)" strokeWidth={3} dot={false} activeDot={{ r: 6, stroke: "var(--nc-chart-active-dot)", strokeWidth: 4, fill: "var(--nc-chart-blue)" }} />
            <Line type="monotone" dataKey="nuevos" stroke="var(--nc-chart-cyan)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: "var(--nc-chart-active-dot)", strokeWidth: 3, fill: "var(--nc-chart-cyan)" }} />
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

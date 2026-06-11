import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  EvolutionVariableLabel,
  IndicatorStatusLabel,
  StagnationSeverityLabel,
  type EvolutionIndicatorProps,
  type StagnationAlertProps,
  type EvolutionRecordProps,
} from "@modules/evolution/domain";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "logrado":
    case "superado":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "en_retroceso":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case "estancado":
      return <Minus className="h-4 w-4 text-yellow-500" />;
    default:
      return <TrendingUp className="h-4 w-4 text-blue-500" />;
  }
}

export function IndicatorCard({ indicator }: { indicator: EvolutionIndicatorProps }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{EvolutionVariableLabel[indicator.variable] ?? indicator.variable}</CardTitle>
          <div className="flex items-center gap-1">
            <StatusIcon status={indicator.status} />
            <Badge variant="outline" className="text-[10px]">
              {IndicatorStatusLabel[indicator.status] ?? indicator.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-xs">
        <div className="grid grid-cols-2 gap-1 text-muted-foreground">
          <span>Inicial: {indicator.initialValue}</span>
          <span>Actual: {indicator.currentValue}</span>
          <span>Cambio: {indicator.percentChange > 0 ? "+" : ""}{indicator.percentChange}%</span>
          {indicator.progressPercent !== undefined && (
            <span>Avance: {indicator.progressPercent}%</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StagnationAlertCard({ alert }: { alert: StagnationAlertProps }) {
  const severityColor: Record<string, string> = {
    baja: "bg-yellow-100 text-yellow-800",
    media: "bg-orange-100 text-orange-800",
    alta: "bg-red-100 text-red-800",
    critica: "bg-red-200 text-red-900",
  };

  return (
    <Card className={alert.resolvedAt ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-sm">
              {EvolutionVariableLabel[alert.variable] ?? alert.variable}
            </CardTitle>
          </div>
          <Badge className={(severityColor[alert.severity] ?? "") + " text-[10px]"}>
            {StagnationSeverityLabel[alert.severity]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        {alert.notes || "Sin observaciones"}
      </CardContent>
    </Card>
  );
}

export function EvolutionHistoryTimeline({ records }: { records: EvolutionRecordProps[] }) {
  const { t } = useTranslation();
  if (!records.length) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{t("evolution.no_records")}</p>;
  }

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <Card key={r.id}>
          <CardContent className="pt-4 text-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span>{new Date(r.createdAt).toLocaleDateString()}</span>
              <span>{t("evolution.compliance")}: {r.perceivedCompliance}/10</span>
            </div>
            {r.changesSinceLastConsultation && (
              <p className="mb-1"><strong>{t("evolution.changes")}:</strong> {r.changesSinceLastConsultation}</p>
            )}
            {r.barriersIdentified && (
              <p className="mb-1"><strong>{t("evolution.barriers")}:</strong> {r.barriersIdentified}</p>
            )}
            {r.facilitatorsIdentified && (
              <p><strong>{t("evolution.facilitators")}:</strong> {r.facilitatorsIdentified}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

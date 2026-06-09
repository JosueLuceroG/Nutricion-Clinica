import * as React from "react";
import { useTranslation } from "react-i18next";
import { evaluateAlerts, type MedicationAlert } from "../application/medicationAlertEngine";
import type { MedicationCatalog } from "../domain/MedicationCatalog";
import type { NutrientInteraction } from "../domain/NutrientInteraction";
import { InteractionSeverityLabel } from "../domain/MedicationCatalogTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { AlertTriangle, Info } from "lucide-react";

interface MedicationAlertsPanelProps {
  medications: MedicationCatalog[];
  interactions: NutrientInteraction[];
}

const severityColor: Record<string, string> = {
  leve: "bg-gray-100 text-gray-700",
  moderada: "bg-amber-100 text-amber-700",
  severa: "bg-red-100 text-red-700",
};

export function MedicationAlertsPanel({ medications, interactions }: MedicationAlertsPanelProps) {
  const { t } = useTranslation();
  const alerts = React.useMemo(
    () => evaluateAlerts(medications, interactions),
    [medications, interactions],
  );

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 text-muted-foreground" />
            {t("medication.alerts_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("medication.no_nutrient_interactions")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {t("medication.alerts_count", { count: alerts.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert, idx) => (
          <AlertCard key={idx} alert={alert} />
        ))}
      </CardContent>
    </Card>
  );
}

function AlertCard({ alert }: { alert: MedicationAlert }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">{alert.medicamento_nombre}</span>
        <Badge className={`h-5 text-[10px] ${severityColor[alert.severidad] ?? ""}`}>
          {InteractionSeverityLabel[alert.severidad]}
        </Badge>
      </div>
      <p className="mb-1 text-xs text-muted-foreground">
        <span className="font-medium">{alert.principio_activo}</span> + {alert.nutriente}
      </p>
      <p className="text-xs">{alert.recomendacion}</p>
    </div>
  );
}

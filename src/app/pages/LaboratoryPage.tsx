import * as React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FlaskConical, Calendar, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Skeleton } from "@components/ui/skeleton";
import { EmptyState } from "@components/layout/EmptyState";
import { labPanelService } from "@services/labPanelService";
import { patientService } from "@services/patientService";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { LabPanel } from "@modules/laboratory/domain/LabPanel";
import type { Patient } from "@modules/patient/domain/Patient";

export function LaboratoryPage() {
  const { t } = useTranslation();
  const [panels, setPanels] = React.useState<LabPanel[]>([]);
  const [patientMap, setPatientMap] = React.useState<Map<string, Patient>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await labPanelService.list.execute();
      const uniqueIds = [...new Set(items.map((p) => p.patientId.toString()))];
      const patients = await Promise.all(
        uniqueIds.map((id) =>
          patientService.get
            .execute(PatientId.fromUnsafe(id))
            .then((p) => [id, p] as const)
            .catch(() => [id, null] as const),
        ),
      );
      setPanels(items);
      const map = new Map<string, Patient>();
      for (const [id, p] of patients) {
        if (p !== null) map.set(id, p);
      }
      setPatientMap(map);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title={t("lab.title")}
        description={t("lab.description")}
        actions={
          <Button variant="ghost" size="icon-sm" onClick={load} aria-label={t("common.refresh")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />
      <PageContent>
        {error && (
          <Card className="mb-4 border-destructive">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error.message}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : panels.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title={t("lab.no_panels")}
            description={t("lab.no_panels_desc")}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {t("lab.all_panels")}
                <Badge variant="secondary">{panels.length}</Badge>
              </CardTitle>
              <CardDescription>
                {t("lab.all_panels_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">{t("common.patient")}</th>
                      <th className="pb-2 pr-4 font-medium">{t("common.date")}</th>
                      <th className="pb-2 pr-4 font-medium">{t("lab.title")}</th>
                      <th className="pb-2 pr-4 font-medium">{t("lab.results")}</th>
                      <th className="pb-2 pr-4 font-medium">{t("common.notes")}</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {panels.map((panel) => {
                      const patient = patientMap.get(panel.patientId.toString());
                      return (
                        <tr key={panel.id.toString()} className="border-b last:border-0 hover:bg-accent/50">
                          <td className="py-2.5 pr-4">
                            {patient ? (
                              <span className="font-medium">{patient.fullName}</span>
                            ) : (
                              <span className="text-muted-foreground">
                                {panel.patientId.toString().slice(0, 8)}…
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Intl.DateTimeFormat("es-MX", {
                                dateStyle: "medium",
                              }).format(panel.takenAt)}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4">
                            {panel.labName ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge variant="outline">{panel.results.length}</Badge>
                          </td>
                          <td className="max-w-[200px] truncate py-2.5 pr-4 text-muted-foreground">
                            {panel.notes ?? "—"}
                          </td>
                          <td className="py-2.5 text-right">
                            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2">
                              <Link to={`/pacientes/${panel.patientId.toString()}/laboratorio`}>
                                {t("lab.view_panel")}
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </>
  );
}

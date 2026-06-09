import * as React from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, RefreshCcw } from "lucide-react";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import {
  listPatientPortalAdherence,
  type PortalAdherenceRecord,
} from "@services/api/patientPortalApi";

export function PatientPortalAdherenceCard({ patientId }: { patientId: string }) {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = React.useState<PortalAdherenceRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadRecords = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPatientPortalAdherence(patientId, signal);
      setRecords(result);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : t("patient_portal.adherence_load_error"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [patientId, t]);

  React.useEffect(() => {
    const controller = new AbortController();
    void loadRecords(controller.signal);
    return () => controller.abort();
  }, [loadRecords]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden />
          {t("patient_portal.adherence_records_title")}
        </CardTitle>
        <CardDescription>{t("patient_portal.adherence_records_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
            <p className="text-sm text-destructive">{error}</p>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => void loadRecords()}>
              <RefreshCcw className="h-4 w-4" aria-hidden />
              {t("common.retry")}
            </Button>
          </div>
        ) : records.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            {t("patient_portal.adherence_no_records")}
          </p>
        ) : (
          <ul className="space-y-3">
            {records.map((record) => (
              <li key={record.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {formatDate(record.date, i18n.language)}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {sourceLabel(t, record.source)}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  <ScoreBadge label={t("adherence.score_menu")} value={record.adherenceMenu} />
                  <ScoreBadge label={t("adherence.score_water")} value={record.adherenceWater} />
                  <ScoreBadge label={t("adherence.score_activity")} value={record.adherenceActivity} />
                  <ScoreBadge label={t("adherence.score_supplements")} value={record.adherenceSupplements} />
                  <ScoreBadge label={t("adherence.score_sleep")} value={record.adherenceSleep} />
                </div>
                {record.barriers && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">{t("adherence.barriers")}:</span> {record.barriers}
                  </p>
                )}
                {record.facilitators && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">{t("adherence.facilitators")}:</span> {record.facilitators}
                  </p>
                )}
                {record.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">{t("common.notes")}:</span> {record.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreBadge({ label, value }: { label: string; value?: number }) {
  if (value === undefined || value === null) return null;
  const variant = value >= 80 ? "success" : value >= 50 ? "warning" : "secondary";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Badge variant={variant} className="text-xs tabular-nums">
        {Math.round(value)}
      </Badge>
    </div>
  );
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function sourceLabel(t: ReturnType<typeof useTranslation>["t"], source?: string): string {
  if (!source) return "-";
  return t(`adherence.source_${source}`);
}

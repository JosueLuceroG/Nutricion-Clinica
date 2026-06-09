import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus } from "lucide-react";
import { useAdherence, useCreateAdherenceRecord } from "@modules/adherence/ui/useAdherenceHooks";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { Badge } from "@components/ui/badge";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { ErrorState, EmptyState } from "@components/layout/EmptyState";
import { AdherenceRecordDialog } from "@modules/adherence/ui/AdherenceRecordDialog";
import type { AdherenceRecord } from "@modules/adherence/domain/AdherenceRecord";
import type { AdherenceFormInput } from "@modules/adherence/application/adherenceFormSchema";

function scoreVariant(v: number) {
  if (v >= 80) return "success" as const;
  if (v >= 50) return "warning" as const;
  return "secondary" as const;
}

export function PatientAdherencePage() {
  const { t } = useTranslation();
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { records, loading, refresh } = useAdherence(patientId ?? "");
  const { create, creating } = useCreateAdherenceRecord();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleCreate = async (data: AdherenceFormInput) => {
    await create(data);
    await refresh();
  };

  if (!patientId) {
    return (
      <>
        <PageHeader title={t("common.error_title")} />
        <PageContent>
          <ErrorState message={t("common.invalid_id")} />
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("adherence.title")}
        description={t("adherence.record_desc")}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(`/pacientes/${patientId}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.back")}
            </Button>
            <Button onClick={() => setDialogOpen(true)} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              {t("adherence.add_record")}
            </Button>
          </>
        }
      />
      <PageContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            title={t("adherence.no_records")}
            action={{ label: t("adherence.add_record"), onClick: () => setDialogOpen(true) }}
          />
        ) : (
          <div className="space-y-3">
            {records.map((r) => <AdherenceRecordCard key={r.id} record={r} t={t} />)}
          </div>
        )}
      </PageContent>

      <AdherenceRecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patientId={patientId}
        onSubmit={handleCreate}
      />
    </>
  );
}

function AdherenceRecordCard({ record, t }: { record: AdherenceRecord; t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{record.date}</CardTitle>
          <Badge variant="outline" className="text-xs">{t(`adherence.source_${record.source}`, { defaultValue: record.source })}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          <ScoreCol label={t("adherence.score_menu")} value={record.adherenceMenu} />
          <ScoreCol label={t("adherence.score_water")} value={record.adherenceWater} />
          <ScoreCol label={t("adherence.score_activity")} value={record.adherenceActivity} />
          <ScoreCol label={t("adherence.score_supplements")} value={record.adherenceSupplements} />
          <ScoreCol label={t("adherence.score_sleep")} value={record.adherenceSleep} />
        </div>
        {record.barriers && <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium">{t("adherence.barriers")}:</span> {record.barriers}</p>}
        {record.facilitators && <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium">{t("adherence.facilitators")}:</span> {record.facilitators}</p>}
        {record.notes && <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium">{t("common.notes")}:</span> {record.notes}</p>}
      </CardContent>
    </Card>
  );
}

function ScoreCol({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Badge variant={scoreVariant(value)} className="text-xs tabular-nums">{Math.round(value)}</Badge>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

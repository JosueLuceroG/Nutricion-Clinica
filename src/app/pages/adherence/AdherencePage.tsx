import * as React from "react";
import { useAdherence, useCreateAdherenceRecord } from "@modules/adherence/ui/useAdherenceHooks";
import { adherenceService } from "@services/adherenceService";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { Badge } from "@components/ui/badge";
import { Plus, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdherenceRecordDialog } from "@modules/adherence/ui/AdherenceRecordDialog";
import { BarrierEventDialog } from "@modules/adherence/ui/BarrierEventDialog";
import type { AdherenceRecord } from "@modules/adherence/domain/AdherenceRecord";
import type { AdherenceFormInput } from "@modules/adherence/application/adherenceFormSchema";

const scoreColor = (v: number) =>
  v >= 80 ? "bg-green-100 text-green-800" : v >= 50 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";

function AdherenceRow({ record }: { record: AdherenceRecord }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{record.date}</CardTitle>
          <Badge className={scoreColor(record.adherenceMenu)}>
            {record.source}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        <div className="grid grid-cols-5 gap-2 text-center">
          <div>
            <p className="font-medium text-foreground">{record.adherenceMenu}%</p>
            <p>{t("adherence.score_menu")}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{record.adherenceWater}%</p>
            <p>{t("adherence.score_water")}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{record.adherenceActivity}%</p>
            <p>{t("adherence.score_activity")}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{record.adherenceSupplements}%</p>
            <p>{t("adherence.score_supplements")}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{record.adherenceSleep}%</p>
            <p>{t("adherence.score_sleep")}</p>
          </div>
        </div>
        {record.barriers && <p className="mt-2">{t("adherence.barriers")}: {record.barriers}</p>}
        {record.facilitators && <p>{t("adherence.facilitators")}: {record.facilitators}</p>}
      </CardContent>
    </Card>
  );
}

export function AdherencePage() {
  const { t } = useTranslation();
  const { records, loading, refresh } = useAdherence("all");
  const { create } = useCreateAdherenceRecord();
  const [recordDialogOpen, setRecordDialogOpen] = React.useState(false);
  const [barrierDialogOpen, setBarrierDialogOpen] = React.useState(false);

  const globalAvg = React.useMemo(() => {
    if (records.length === 0) return 0;
    return Math.round(records.reduce((s, r) => s + r.adherenceMenu, 0) / records.length);
  }, [records]);

  const handleCreateRecord = async (data: AdherenceFormInput) => {
    await create(data);
    await refresh();
  };

  const handleCreateBarrier = async (data: { date: string; type: string; description: string; actionTaken?: string }) => {
    await adherenceService.createBarrier({ ...data, patientId: "all" });
    await refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t("adherence.treatment_title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("adherence.records_menu_average", { count: records.length, average: globalAvg })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBarrierDialogOpen(true)}>
              <ShieldAlert className="mr-1 h-4 w-4" /> {t("adherence.add_barrier")}
            </Button>
            <Button onClick={() => setRecordDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> {t("adherence.add_record")}
            </Button>
          </div>
        </div>
      </div>

      <AdherenceRecordDialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen} patientId="all" onSubmit={handleCreateRecord} />

      <BarrierEventDialog open={barrierDialogOpen} onOpenChange={setBarrierDialogOpen} patientId="all" onSubmit={handleCreateBarrier} />
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : records.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("adherence.no_records")}
          </p>
        ) : (
          <div className="space-y-3">
            {records.map((r) => <AdherenceRow key={r.id} record={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}

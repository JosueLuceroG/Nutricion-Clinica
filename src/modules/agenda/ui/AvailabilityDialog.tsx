import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Separator } from "@components/ui/separator";
import { useProfessionalBlocks, useProfessionalSchedules } from "./useAgendaHooks";
import type { Block, DayOfWeek, Schedule, ScheduleId } from "../domain";
import type { BlockFormInput } from "../application";

const WEEK_DAYS: Array<{ value: DayOfWeek; labelKey: string }> = [
  { value: 1, labelKey: "agenda.day_monday" },
  { value: 2, labelKey: "agenda.day_tuesday" },
  { value: 3, labelKey: "agenda.day_wednesday" },
  { value: 4, labelKey: "agenda.day_thursday" },
  { value: 5, labelKey: "agenda.day_friday" },
  { value: 6, labelKey: "agenda.day_saturday" },
  { value: 0, labelKey: "agenda.day_sunday" },
];

interface ScheduleRowState {
  id?: ScheduleId;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  active: boolean;
}

interface AvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockStartDate: string;
  blockEndDate: string;
  initialBlockDate: string;
  onChanged?: () => void | Promise<void>;
}

export function AvailabilityDialog({ open, onOpenChange, blockStartDate, blockEndDate, initialBlockDate, onChanged }: AvailabilityDialogProps) {
  const { t } = useTranslation();
  const { list: listSchedules, save: saveSchedule, remove: removeSchedule, loading: schedulesLoading } = useProfessionalSchedules();
  const { list: listBlocks, create: createBlock, remove: removeBlock, loading: blocksLoading } = useProfessionalBlocks(blockStartDate, blockEndDate);
  const [scheduleRows, setScheduleRows] = React.useState<ScheduleRowState[]>(() => defaultScheduleRows());
  const [blocks, setBlocks] = React.useState<Block[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [blockForm, setBlockForm] = React.useState<BlockFormInput>(() => defaultBlockForm(initialBlockDate));

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const [schedules, loadedBlocks] = await Promise.all([
        listSchedules(),
        listBlocks(),
      ]);
      setScheduleRows(buildScheduleRows(schedules));
      setBlocks(loadedBlocks.sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime ?? "").localeCompare(b.startTime ?? "")));
    } catch (err) {
      toast.error(t("common.error_occurred"), { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }, [listBlocks, listSchedules, t]);

  React.useEffect(() => {
    if (!open) return;
    setBlockForm(defaultBlockForm(initialBlockDate));
    void reload();
  }, [initialBlockDate, open, reload]);

  const updateScheduleRow = (dayOfWeek: DayOfWeek, patch: Partial<ScheduleRowState>) => {
    setScheduleRows((rows) => rows.map((row) => row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row));
  };

  const handleSaveSchedules = async () => {
    setSaving(true);
    try {
      await Promise.all(scheduleRows.map((row) => {
        if (row.active) {
          return saveSchedule({ dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime, active: true });
        }
        return row.id ? removeSchedule(row.id) : Promise.resolve();
      }));
      await reload();
      await onChanged?.();
      toast.success(t("agenda.availability_saved"));
    } catch (err) {
      toast.error(t("common.error_occurred"), { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBlock = async () => {
    setSaving(true);
    try {
      await createBlock(blockForm);
      setBlockForm(defaultBlockForm(blockForm.startDate));
      await reload();
      await onChanged?.();
      toast.success(t("agenda.block_created"));
    } catch (err) {
      toast.error(t("common.error_occurred"), { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (block: Block) => {
    setSaving(true);
    try {
      await removeBlock(block.id);
      await reload();
      await onChanged?.();
      toast.success(t("agenda.block_deleted"));
    } catch (err) {
      toast.error(t("common.error_occurred"), { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const busy = loading || saving || schedulesLoading || blocksLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{t("agenda.availability_title")}</DialogTitle>
          <DialogDescription>{t("agenda.availability_description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{t("agenda.weekly_schedule")}</h3>
              <Button type="button" size="sm" onClick={handleSaveSchedules} disabled={busy}>
                {saving ? t("common.saving") : t("agenda.save_schedule")}
              </Button>
            </div>
            <div className="rounded-md border">
              {scheduleRows.map((row) => (
                <div key={row.dayOfWeek} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-3 py-2 last:border-b-0 sm:grid-cols-[1fr_auto_auto_auto]">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={row.active}
                      onChange={(event) => updateScheduleRow(row.dayOfWeek, { active: event.target.checked })}
                    />
                    {t(WEEK_DAYS.find((day) => day.value === row.dayOfWeek)?.labelKey ?? "")}
                  </label>
                  <Input
                    aria-label={t("agenda.schedule_start_for", { day: t(WEEK_DAYS.find((day) => day.value === row.dayOfWeek)?.labelKey ?? "") })}
                    type="time"
                    className="w-28"
                    value={row.startTime}
                    disabled={!row.active}
                    onChange={(event) => updateScheduleRow(row.dayOfWeek, { startTime: event.target.value })}
                  />
                  <Input
                    aria-label={t("agenda.schedule_end_for", { day: t(WEEK_DAYS.find((day) => day.value === row.dayOfWeek)?.labelKey ?? "") })}
                    type="time"
                    className="w-28"
                    value={row.endTime}
                    disabled={!row.active}
                    onChange={(event) => updateScheduleRow(row.dayOfWeek, { endTime: event.target.value })}
                  />
                  <span className="hidden text-xs text-muted-foreground sm:inline">{row.active ? t("agenda.available") : t("agenda.inactive")}</span>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("agenda.blocks")}</h3>
            <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="block-start-date">{t("agenda.block_start_date")}</Label>
                <Input id="block-start-date" type="date" value={blockForm.startDate} onChange={(event) => setBlockForm((value) => ({ ...value, startDate: event.target.value, endDate: value.endDate < event.target.value ? event.target.value : value.endDate }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="block-end-date">{t("agenda.block_end_date")}</Label>
                <Input id="block-end-date" type="date" value={blockForm.endDate} onChange={(event) => setBlockForm((value) => ({ ...value, endDate: event.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={blockForm.allDay} onChange={(event) => setBlockForm((value) => ({ ...value, allDay: event.target.checked }))} />
                {t("agenda.block_all_day")}
              </label>
              {!blockForm.allDay && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="block-start-time">{t("agenda.start_time")}</Label>
                    <Input id="block-start-time" type="time" value={blockForm.startTime ?? "09:00"} onChange={(event) => setBlockForm((value) => ({ ...value, startTime: event.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="block-end-time">{t("agenda.end_time")}</Label>
                    <Input id="block-end-time" type="time" value={blockForm.endTime ?? "10:00"} onChange={(event) => setBlockForm((value) => ({ ...value, endTime: event.target.value }))} />
                  </div>
                </>
              )}
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="block-reason">{t("agenda.block_reason")}</Label>
                <Input id="block-reason" value={blockForm.reason ?? ""} placeholder={t("agenda.block_reason_placeholder")} onChange={(event) => setBlockForm((value) => ({ ...value, reason: event.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Button type="button" onClick={handleCreateBlock} disabled={busy}>{t("agenda.add_block")}</Button>
              </div>
            </div>

            <div className="space-y-2">
              {blocks.length === 0 ? (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("agenda.no_blocks")}</p>
              ) : blocks.map((block) => (
                <div key={block.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{formatBlock(block)}</p>
                    <p className="text-muted-foreground">{block.reason || t("agenda.block_without_reason")}</p>
                  </div>
                  <Button type="button" size="icon" variant="ghost" aria-label={t("agenda.delete_block")} onClick={() => handleDeleteBlock(block)} disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function defaultScheduleRows(): ScheduleRowState[] {
  return WEEK_DAYS.map((day) => ({ dayOfWeek: day.value, startTime: "09:00", endTime: "17:00", active: false }));
}

function buildScheduleRows(schedules: Schedule[]): ScheduleRowState[] {
  const byDay = new Map<DayOfWeek, Schedule>();
  for (const schedule of schedules) {
    if (!byDay.has(schedule.dayOfWeek)) byDay.set(schedule.dayOfWeek, schedule);
  }
  return defaultScheduleRows().map((row) => {
    const schedule = byDay.get(row.dayOfWeek);
    return schedule ? { id: schedule.id, dayOfWeek: schedule.dayOfWeek, startTime: schedule.startTime, endTime: schedule.endTime, active: schedule.active } : row;
  });
}

function defaultBlockForm(date: string): BlockFormInput {
  return { startDate: date, endDate: date, allDay: true, startTime: "09:00", endTime: "10:00", reason: "" };
}

function formatBlock(block: Block): string {
  const dateRange = block.startDate === block.endDate ? block.startDate : `${block.startDate} - ${block.endDate}`;
  if (block.allDay || !block.startTime || !block.endTime) return dateRange;
  return `${dateRange} · ${block.startTime} - ${block.endTime}`;
}

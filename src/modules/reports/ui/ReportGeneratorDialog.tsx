import * as React from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Label } from "@components/ui/label";
import { Input } from "@components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Loader2 } from "lucide-react";
import type { ReportService } from "./useReportHooks";

const REPORT_TYPES = [
  { value: "operativo", label: "reports.type_operative" },
  { value: "financiero", label: "reports.type_financial" },
  { value: "kpi", label: "reports.type_kpi" },
  { value: "regulatorio", label: "reports.type_regulatory" },
] as const;

interface ReportGeneratorDialogProps {
  service: ReportService;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportGeneratorDialog({ service, open, onOpenChange }: ReportGeneratorDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<string>("operativo");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setType("operativo");
      setDateFrom("");
      setDateTo("");
      setPreview(null);
      setError(null);
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!title.trim()) { setError(t("errors.required")); return; }
    setGenerating(true);
    setError(null);
    try {
      const selectedType = REPORT_TYPES.find((rt) => rt.value === type);
      const typeLabel = selectedType ? t(selectedType.label) : type;
      const contentHtml = `<h1>${title}</h1><p>${t("common.type")}: ${typeLabel}</p><p>${t("reports.period")}: ${dateFrom || "N/A"} - ${dateTo || "N/A"}</p><p>${t("reports.generated_on", { date: new Date().toLocaleDateString("es-MX") })}</p>`;
      setPreview(contentHtml);
      await service.generateReport({
        title: title.trim(),
        type: type as "operativo" | "financiero" | "kpi" | "regulatorio",
        generatedBy: "current-user",
        contentHtml,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("reports.generate_error"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("reports.generate_title")}</DialogTitle>
          <DialogDescription>
            {t("reports.generate")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="title">{t("reports.report_title_field")}</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("reports.report_title_field")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-type">{t("reports.report_type")}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="report-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value}>{t(rt.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="dateFrom">{t("billing.from")}</Label>
              <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dateTo">{t("billing.to")}</Label>
              <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {preview && (
            <div className="rounded border bg-muted p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("reports.content")}:</p>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {generating ? t("reports.generating") : t("reports.generate_button")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

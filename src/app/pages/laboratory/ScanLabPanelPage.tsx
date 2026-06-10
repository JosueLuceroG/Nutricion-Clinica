import { Link, useParams } from "react-router-dom";
import * as React from "react";
import { ArrowLeft, Camera, Upload, Scan, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState } from "@components/layout/EmptyState";
import { Badge } from "@components/ui/badge";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { Sex } from "@modules/patient/domain/Sex";
import { LabPanelForm } from "@modules/laboratory/ui/LabPanelForm";
import { recognizeImageFromFile, terminateWorker } from "@services/ocr/ocrService";
import { parseLabOcrText, parsedToLabResults, type ParsedLabValue } from "@modules/laboratory/ocr/labOcrParser";
import { LAB_TEST_DEFINITIONS } from "@modules/laboratory/domain/LabTest";

type Phase = "idle" | "processing" | "review" | "done" | "error";

export function ScanLabPanelPage() {
  const { t } = useTranslation();
  const { patientId } = useParams();
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading, error: patientError, reload } = usePatient(id);

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [progress, setProgress] = React.useState(0);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<ParsedLabValue[]>([]);
  const [unrecognized, setUnrecognized] = React.useState(0);
  const [ocrError, setOcrError] = React.useState<string | null>(null);
  const [accepted, setAccepted] = React.useState<Set<string>>(new Set());
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return () => { terminateWorker(); };
  }, []);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    setPreview(url);
    setPhase("processing");
    setProgress(0);
    setOcrError(null);

    try {
      const result = await recognizeImageFromFile(file, (p) => setProgress(p));
      const parseResult = parseLabOcrText(result.text);
      setParsed(parseResult.results);
      setUnrecognized(parseResult.unrecognizedLines.length);
      const acceptedSet = new Set(parseResult.results.map((r) => r.test));
      setAccepted(acceptedSet);
      setPhase("review");
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "OCR failed");
      setPhase("error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const toggleAccepted = (test: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(test)) next.delete(test);
      else next.add(test);
      return next;
    });
  };

  const acceptedValues = React.useMemo(() => {
    return parsed.filter((r) => accepted.has(r.test));
  }, [parsed, accepted]);

  const [showForm, setShowForm] = React.useState(false);

  if (loading || !patient) {
    return (
      <>
        <PageHeader title={t("lab.scan_title")} />
        <PageContent>
          <div className="mx-auto max-w-4xl space-y-4">
            <Skeleton className="h-32 w-full" />
          </div>
        </PageContent>
      </>
    );
  }

  if (patientError) {
    return (
      <>
        <PageHeader title={t("common.error_occurred")} />
        <PageContent>
          <ErrorState message={patientError.message} onRetry={reload} />
        </PageContent>
      </>
    );
  }

  if (showForm && id) {
    return (
      <>
        <PageHeader
          title={t("lab.new_panel_title")}
          description={`${t("common.patient")}: ${patient.fullName} · ${patient.age} ${t("patient.title_single").toLowerCase()}`}
          actions={
            <Button asChild variant="outline">
              <Link to={`/pacientes/${id.toString()}/laboratorio`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.previous")}
              </Link>
            </Button>
          }
        />
        <PageContent>
          <div className="mx-auto max-w-4xl">
            <LabPanelForm
              key={acceptedValues.length}
              patientId={id}
              patientAge={patient.age}
              patientSex={patient.sex as Sex}
              initialResults={parsedToLabResults(acceptedValues)}
            />
          </div>
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("lab.scan_title")}
        description={`${t("common.patient")}: ${patient.fullName}`}
        actions={
          <Button asChild variant="outline">
            <Link to={`/pacientes/${patient.id.toString()}/laboratorio`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.previous")}
            </Link>
          </Button>
        }
      />
      <PageContent>
        <div className="mx-auto max-w-4xl space-y-6">
          {phase === "idle" && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 transition-colors hover:border-primary/50"
            >
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-lg font-medium">{t("lab.scan_drop")}</p>
                <p className="text-sm text-muted-foreground">{t("lab.scan_formats")}</p>
              </div>
              <Button variant="secondary">
                <Camera className="mr-2 h-4 w-4" />
                {t("lab.scan_select")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFilePick}
              />
            </div>
          )}

          {phase === "processing" && preview && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border">
                <img src={preview} alt="Lab report" className="max-h-96 w-full object-contain" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("lab.scan_processing")}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(progress * 100)}%
                </p>
              </div>
            </div>
          )}

          {phase === "review" && (
            <div className="space-y-6">
              {preview && (
                <div className="overflow-hidden rounded-lg border">
                  <img src={preview} alt="Lab report" className="max-h-48 w-full object-contain" />
                </div>
              )}

              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Scan className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{t("lab.scan_results")}</h3>
                  <Badge variant="secondary" className="ml-auto">
                    {parsed.length} {t("lab.results").toLowerCase()}
                  </Badge>
                </div>

                {parsed.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("lab.scan_no_results")}</p>
                )}

                <div className="space-y-1">
                  {parsed.map((item) => {
                    const def = LAB_TEST_DEFINITIONS[item.test];
                    const isAccepted = accepted.has(item.test);
                    return (
                      <div
                        key={item.test}
                        onClick={() => toggleAccepted(item.test)}
                        className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                          isAccepted ? "bg-primary/5" : "opacity-50"
                        } hover:bg-accent`}
                      >
                        <div className={`h-4 w-4 rounded border ${
                          isAccepted ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                        } flex items-center justify-center`}>
                          {isAccepted && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <span className="flex-1 font-medium">{def?.shortName ?? item.test}</span>
                        <span className="tabular-nums">{item.value}</span>
                        <span className="text-xs text-muted-foreground">{def?.unit ?? ""}</span>
                        <Badge
                          variant={
                            item.confidence === "high" ? "default" :
                            item.confidence === "medium" ? "secondary" : "destructive"
                          }
                          className="text-[10px]"
                        >
                          {item.confidence}
                        </Badge>
                      </div>
                    );
                  })}
                </div>

                {unrecognized > 0 && (
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertCircle className="h-3 w-3" />
                    {unrecognized} {t("lab.scan_unrecognized")}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="default"
                  onClick={() => setShowForm(true)}
                >
                  {t("lab.scan_apply")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPhase("idle");
                    setPreview(null);
                    setParsed([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-4">
              <ErrorState
                message={ocrError ?? t("lab.scan_error")}
                onRetry={() => setPhase("idle")}
              />
            </div>
          )}
        </div>
      </PageContent>
    </>
  );
}

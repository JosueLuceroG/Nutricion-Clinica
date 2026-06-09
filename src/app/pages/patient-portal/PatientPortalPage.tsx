import * as React from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Bell,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCcw,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Skeleton } from "@components/ui/skeleton";
import { Textarea } from "@components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@components/ui/tooltip";
import { getSystemFoodById } from "@modules/smae/domain";
import { MEAL_SLOT_ORDER } from "@modules/mealplan/domain/MealSlot";
import {
  getDocumentDownloadUrl,
  getDocumentPreviewUrl,
  getPatientPortalPayload,
  getPortalNotifications,
  sendPortalReminder,
  submitPatientPortalAdherence,
  type PatientPortalMeal,
  type PatientPortalPayload,
  type PatientPortalPlan,
  type SubmitPortalAdherenceInput,
} from "@services/api/patientPortalApi";

type PortalState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: PatientPortalPayload; error: null }
  | { status: "error"; data: null; error: string };

export function PatientPortalPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [reloadKey, setReloadKey] = React.useState(0);
  const [state, setState] = React.useState<PortalState>({ status: "loading", data: null, error: null });

  React.useEffect(() => {
    if (!token) {
      setState({ status: "error", data: null, error: t("patient_portal.missing_token") });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", data: null, error: null });
    getPatientPortalPayload(token, controller.signal)
      .then((data) => setState({ status: "ready", data, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          data: null,
          error: err instanceof Error ? err.message : t("patient_portal.load_error"),
        });
      });

    return () => controller.abort();
  }, [token, reloadKey, t]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_32rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-2xl border bg-card/90 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {t("patient_portal.eyebrow")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("patient_portal.title")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t("patient_portal.subtitle")}
            </p>
          </div>
          <Badge variant="success" className="w-fit gap-1.5 py-1">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t("patient_portal.read_only")}
          </Badge>
        </header>

        {state.status === "loading" && <PortalLoading />}
        {state.status === "error" && (
          <PortalError
            message={state.error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        )}
        {state.status === "ready" && (
          <PortalContent data={state.data} locale={i18n.language} token={token ?? ""} />
        )}
      </div>
    </main>
  );
}

function PortalContent({ data, locale, token }: { data: PatientPortalPayload; locale: string; token: string }) {
  const { t } = useTranslation();
  const patientFirstName = data.patient.fullName.split(" ")[0] ?? data.patient.fullName;
  const nextAppointment = data.upcomingAppointments[0];
  const canSubmitAdherence = data.portal.scopes.includes("adherence");

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden border-primary/20 bg-primary text-primary-foreground shadow-md">
          <CardHeader className="pb-3">
            <CardDescription className="text-primary-foreground/80">
              {t("patient_portal.patient_summary")}
            </CardDescription>
            <CardTitle className="text-3xl sm:text-4xl">
              {t("patient_portal.hello", { name: patientFirstName })}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <InfoLine label={t("patient_portal.full_name")} value={data.patient.fullName} />
            <InfoLine label={t("patient_portal.birth_date")} value={formatDate(data.patient.birthDate, locale)} />
            {data.patient.email && <InfoLine label={t("patient_portal.email")} value={data.patient.email} icon={Mail} />}
            {data.patient.phone && <InfoLine label={t("patient_portal.phone")} value={data.patient.phone} icon={Phone} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LockKeyhole className="h-4 w-4 text-primary" aria-hidden />
              {t("patient_portal.security_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{t("patient_portal.security_desc")}</p>
            <p>{t("patient_portal.expires_at", { date: formatDateTime(data.portal.expiresAt, locale) })}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={UtensilsCrossed}
          label={t("patient_portal.active_plan")}
          value={data.summary?.activePlanName ?? t("patient_portal.no_active_plan_short")}
        />
        <SummaryCard
          icon={CalendarClock}
          label={t("patient_portal.next_appointment")}
          value={nextAppointment ? formatDateTime(nextAppointment.consultationDate, locale) : t("patient_portal.no_appointments_short")}
        />
        <SummaryCard
          icon={FileText}
          label={t("patient_portal.documents")}
          value={t("patient_portal.documents_count", { count: data.documents.length })}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <ActivePlanCard plan={data.activePlan} locale={locale} />
        <div className="space-y-4">
          {canSubmitAdherence && <AdherenceSubmissionCard token={token} />}
          <AppointmentsCard token={token ?? ""} appointments={data.upcomingAppointments} locale={locale} />
          <NotificationsCard token={token ?? ""} />
          <DocumentsCard token={token ?? ""} documents={data.documents} locale={locale} />
        </div>
      </section>
    </>
  );
}

type ScoreKey = "adherenceMenu" | "adherenceWater" | "adherenceActivity" | "adherenceSupplements" | "adherenceSleep";

const SCORE_FIELDS: Array<{ key: ScoreKey; labelKey: string }> = [
  { key: "adherenceMenu", labelKey: "patient_portal.adherence_menu" },
  { key: "adherenceWater", labelKey: "patient_portal.adherence_water" },
  { key: "adherenceActivity", labelKey: "patient_portal.adherence_activity" },
  { key: "adherenceSupplements", labelKey: "patient_portal.adherence_supplements" },
  { key: "adherenceSleep", labelKey: "patient_portal.adherence_sleep" },
];

function AdherenceSubmissionCard({ token }: { token: string }) {
  const { t } = useTranslation();
  const [form, setForm] = React.useState<SubmitPortalAdherenceInput>(() => defaultAdherenceForm());
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const updateScore = (key: ScoreKey, value: number) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateText = (key: "barriers" | "facilitators" | "notes", value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSuccess(false);
    setError(null);
    try {
      await submitPatientPortalAdherence(token, form);
      setSuccess(true);
      setForm(defaultAdherenceForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("patient_portal.adherence_error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" aria-hidden />
          {t("patient_portal.adherence_title")}
        </CardTitle>
        <CardDescription>{t("patient_portal.adherence_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="portal-adherence-date">{t("common.date")}</Label>
            <Input
              id="portal-adherence-date"
              type="date"
              value={form.date ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            />
          </div>

          <div className="space-y-3">
            {SCORE_FIELDS.map((field) => (
              <PortalScoreSlider
                key={field.key}
                id={`portal-${field.key}`}
                label={t(field.labelKey)}
                value={form[field.key]}
                onChange={(value) => updateScore(field.key, value)}
              />
            ))}
          </div>

          <div className="grid gap-3">
            <PortalTextarea
              id="portal-adherence-barriers"
              label={t("patient_portal.adherence_barriers")}
              value={form.barriers ?? ""}
              onChange={(value) => updateText("barriers", value)}
            />
            <PortalTextarea
              id="portal-adherence-facilitators"
              label={t("patient_portal.adherence_facilitators")}
              value={form.facilitators ?? ""}
              onChange={(value) => updateText("facilitators", value)}
            />
            <PortalTextarea
              id="portal-adherence-notes"
              label={t("common.notes")}
              value={form.notes ?? ""}
              onChange={(value) => updateText("notes", value)}
            />
          </div>

          {success && (
            <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success" role="status">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {t("patient_portal.adherence_success")}
            </p>
          )}
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t("patient_portal.adherence_saving") : t("patient_portal.adherence_submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PortalScoreSlider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <Badge variant={value >= 80 ? "success" : value >= 60 ? "warning" : "destructive"}>{value}%</Badge>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground" aria-hidden>
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

function PortalTextarea({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={2} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function defaultAdherenceForm(): SubmitPortalAdherenceInput {
  return {
    date: new Date().toISOString().slice(0, 10),
    adherenceMenu: 80,
    adherenceWater: 80,
    adherenceActivity: 80,
    adherenceSupplements: 80,
    adherenceSleep: 80,
    barriers: "",
    facilitators: "",
    notes: "",
  };
}

function ActivePlanCard({ plan, locale }: { plan: PatientPortalPlan | null; locale: string }) {
  const { t } = useTranslation();

  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("patient_portal.plan_title")}</CardTitle>
          <CardDescription>{t("patient_portal.no_active_plan")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardDescription>{t("patient_portal.plan_title")}</CardDescription>
            <CardTitle className="mt-1 text-2xl">{plan.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(plan.startDate, locale)}
              {plan.endDate ? ` - ${formatDate(plan.endDate, locale)}` : ""}
            </p>
          </div>
          <Badge variant="success">{t(`patient_portal.status_${plan.status.replace(/-/g, "_")}`)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
        <div className="grid gap-3 sm:grid-cols-4">
          <TargetStat label="kcal" value={plan.kcalTarget} />
          <TargetStat label={t("patient_portal.protein")} value={plan.proteinTargetG} unit="g" />
          <TargetStat label={t("patient_portal.carbs")} value={plan.carbsTargetG} unit="g" />
          <TargetStat label={t("patient_portal.fat")} value={plan.fatTargetG} unit="g" />
        </div>
        <MealsList meals={plan.meals} />
        {plan.notes && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("patient_portal.plan_notes")}</p>
            <p className="mt-1 whitespace-pre-wrap">{plan.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MealsList({ meals }: { meals: PatientPortalMeal[] }) {
  const { t } = useTranslation();
  const orderedMeals = [
    ...MEAL_SLOT_ORDER.map((slot) => meals.find((meal) => meal.slot === slot)).filter((meal): meal is PatientPortalMeal => Boolean(meal)),
    ...meals.filter((meal) => !MEAL_SLOT_ORDER.some((slot) => slot === meal.slot)),
  ].filter((meal) => meal.exchanges.length > 0);

  if (orderedMeals.length === 0) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("patient_portal.no_meals")}</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">{t("patient_portal.meals_title")}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {orderedMeals.map((meal) => (
          <div key={meal.slot} className="rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-semibold">{mealSlotLabel(t, meal.slot)}</p>
            <ul className="mt-2 space-y-2">
              {meal.exchanges.map((exchange, index) => {
                const food = getSystemFoodById(exchange.foodId);
                return (
                  <li key={`${exchange.foodId}-${index}`} className="text-sm">
                    <span className="font-medium">{exchange.count}x {food?.shortName ?? exchange.foodId}</span>
                    {food && <span className="text-muted-foreground"> - {food.serving}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppointmentsCard({ token, appointments, locale }: { token: string; appointments: PatientPortalPayload["upcomingAppointments"]; locale: string }) {
  const { t } = useTranslation();
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const handleSendReminder = async () => {
    setSending(true);
    try {
      await sendPortalReminder(token);
      setSent(true);
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
          {t("patient_portal.appointments_title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("patient_portal.no_appointments")}</p>
        ) : (
          <ul className="space-y-3">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{formatDateTime(appointment.consultationDate, locale)}</p>
                  <Badge variant="info">{t(`patient_portal.status_${appointment.status.replace(/-/g, "_")}`)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{appointment.reason}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleSendReminder} disabled={sending}>
            <Mail className="mr-1 h-3 w-3" />
            {sending ? t("common.sending") : t("patient_portal.reminder_send")}
          </Button>
          {sent && <span className="text-xs text-green-600">{t("patient_portal.reminder_sent")}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsCard({ token }: { token: string }) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = React.useState<Array<{ id: string; type: string; to: string; subject: string; error: string | null; sentAt: string }>>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    setLoading(true);
    getPortalNotifications(token)
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" aria-hidden />
          {t("patient_portal.notifications_title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("patient_portal.no_notifications")}</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-center justify-between rounded-lg border p-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{n.subject}</p>
                  <p className="text-muted-foreground">{formatDateTime(n.sentAt, "es-MX")}</p>
                </div>
                {n.error ? (
                  <Badge variant="destructive" className="shrink-0 text-[10px]">{t("common.error")}</Badge>
                ) : (
                  <Badge variant="success" className="shrink-0 text-[10px]">{t("patient_portal.notification_sent")}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsCard({ token, documents, locale }: { token: string; documents: PatientPortalPayload["documents"]; locale: string }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" aria-hidden />
          {t("patient_portal.documents_title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("patient_portal.no_documents")}</p>
        ) : (
          <ul className="space-y-3">
            {documents.map((document) => (
              <li key={document.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">{document.fileName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(`patient_portal.document_type_${document.type}`, { defaultValue: document.type })} &middot; {formatFileSize(document.sizeBytes)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(document.documentDate ?? document.createdAt, locale)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3 text-green-600" aria-hidden />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-xs text-green-600 underline decoration-dotted underline-offset-2 hover:text-green-700" onClick={(e) => e.preventDefault()}>
                              {t("patient_portal.document_sha_verified")}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[300px] break-all text-xs">
                            <p className="font-medium">{t("patient_portal.document_sha_title")}</p>
                            <code className="mt-1 block font-mono text-[10px]">{document.sha256}</code>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button asChild variant="outline" size="sm">
                      <a href={getDocumentPreviewUrl(token, document.id)} target="_blank" rel="noreferrer">
                        <Eye className="mr-1 h-3 w-3" />
                        {t("patient_portal.document_preview")}
                      </a>
                    </Button>
                    <Button asChild variant="default" size="sm">
                      <a href={getDocumentDownloadUrl(token, document.id)} download={document.fileName}>
                        <Download className="mr-1 h-3 w-3" />
                        {t("patient_portal.document_download")}
                      </a>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PortalLoading() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function PortalError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle>{t("patient_portal.unavailable_title")}</CardTitle>
        <CardDescription>{t("patient_portal.unavailable_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{message}</p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCcw className="h-4 w-4" aria-hidden />
          {t("common.retry")}
        </Button>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TargetStat({ label, value, unit = "" }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value}{unit}
      </p>
    </div>
  );
}

function InfoLine({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div>
      <p className="text-xs text-primary-foreground/70">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 font-medium">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {value}
      </p>
    </div>
  );
}

function mealSlotLabel(t: ReturnType<typeof useTranslation>["t"], slot: string): string {
  return t(`patient_portal.meal_slot_${slot.replace(/-/g, "_")}`, { defaultValue: slot });
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string | null, locale: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

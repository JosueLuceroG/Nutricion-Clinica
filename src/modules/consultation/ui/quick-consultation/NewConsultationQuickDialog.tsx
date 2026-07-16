import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  Check,
  Clock3,
  FileText,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Target,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@components/ui/dialog";
import type {
  QuickConsultationAction,
  QuickConsultationPatient,
} from "../../application/quickConsultationTypes";
import { useQuickConsultationPatients } from "./useQuickConsultationPatients";
import { usePatientClinicalSummary } from "./usePatientClinicalSummary";
import "./NewConsultationQuickDialog.css";

interface NewConsultationQuickDialogProps {
  open: boolean;
  initialPatientId?: string;
  onOpenChange: (open: boolean) => void;
  onRegisterPatient: () => void;
  onContinue: (
    patient: QuickConsultationPatient,
    action: QuickConsultationAction,
  ) => void;
}

const formatDate = (value: string | null, locale: string): string => {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getDaysAgo = (value: string): number => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
};

export function NewConsultationQuickDialog({
  open,
  initialPatientId,
  onOpenChange,
  onRegisterPatient,
  onContinue,
}: NewConsultationQuickDialogProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = React.useState("");
  const [selectedPatientId, setSelectedPatientId] = React.useState<
    string | null
  >(initialPatientId ?? null);
  const [action, setAction] = React.useState<QuickConsultationAction | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const { patients, visiblePatients, loading, error, searching } =
    useQuickConsultationPatients(query);
  const selectedPatient =
    patients.find((patient) => patient.id === selectedPatientId) ?? null;
  const summary = usePatientClinicalSummary(selectedPatientId);

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedPatientId(initialPatientId ?? null);
    setAction(null);
    setSubmitting(false);
  }, [initialPatientId, open]);

  React.useEffect(() => {
    if (!open || !initialPatientId || loading) return;
    if (patients.some((patient) => patient.id === initialPatientId)) {
      setSelectedPatientId(initialPatientId);
    }
  }, [initialPatientId, loading, open, patients]);

  const continueFlow = () => {
    if (!selectedPatient || !action || submitting) return;
    setSubmitting(true);
    onContinue(selectedPatient, action);
  };

  const footerMessage =
    action === "schedule-later"
      ? t("quickConsultation.footer.schedule")
      : t("quickConsultation.footer.start");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="nc-quick-consultation"
        overlayClassName="nc-quick-consultation__overlay"
        showClose={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          window.requestAnimationFrame(() => searchRef.current?.focus());
        }}
      >
        <header className="nc-quick-consultation__header">
          <span
            className="nc-quick-consultation__headerIcon"
            aria-hidden="true"
          >
            <CalendarPlus />
          </span>
          <div>
            <DialogTitle>{t("quickConsultation.title")}</DialogTitle>
            <DialogDescription>
              {t("quickConsultation.description")}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              className="nc-quick-consultation__close"
              aria-label={t("common.close")}
            >
              <X aria-hidden="true" />
            </button>
          </DialogClose>
        </header>

        <div className="nc-quick-consultation__body">
          <section
            className="nc-quick-consultation__section"
            aria-labelledby="quick-consultation-patient-step"
          >
            <div className="nc-quick-consultation__stepHeading">
              <span aria-hidden="true">1</span>
              <h3 id="quick-consultation-patient-step">
                {t("quickConsultation.patientStep")}
              </h3>
            </div>

            <div className="nc-quick-consultation__searchRow">
              <label className="nc-quick-consultation__search">
                <Search aria-hidden="true" />
                <span className="sr-only">
                  {t("quickConsultation.searchLabel")}
                </span>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("quickConsultation.searchPlaceholder")}
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label={t("quickConsultation.clearSearch")}
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </label>
              <button
                type="button"
                className="nc-quick-consultation__register"
                onClick={onRegisterPatient}
              >
                <UserPlus aria-hidden="true" />
                <span>{t("quickConsultation.registerPatient")}</span>
              </button>
            </div>

            <div
              className="nc-quick-consultation__patients"
              role="group"
              aria-label={t("quickConsultation.patientResults")}
            >
              {loading && (
                <div
                  className="nc-quick-consultation__patientState"
                  role="status"
                >
                  <LoaderCircle
                    className="nc-quick-consultation__spin"
                    aria-hidden="true"
                  />
                  <span>{t("quickConsultation.loadingPatients")}</span>
                </div>
              )}
              {!loading && error && (
                <div
                  className="nc-quick-consultation__patientState nc-quick-consultation__patientState--error"
                  role="alert"
                >
                  <AlertCircle aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              {!loading && !error && visiblePatients.length === 0 && (
                <div className="nc-quick-consultation__patientState">
                  <UserPlus aria-hidden="true" />
                  <div>
                    <strong>
                      {searching
                        ? t("quickConsultation.noResults")
                        : t("quickConsultation.noPatients")}
                    </strong>
                    <span>{t("quickConsultation.noResultsHint")}</span>
                  </div>
                  <button type="button" onClick={onRegisterPatient}>
                    <Plus aria-hidden="true" />
                    {t("quickConsultation.registerPatient")}
                  </button>
                </div>
              )}
              {!loading &&
                !error &&
                visiblePatients.map((patient) => {
                  const selected = patient.id === selectedPatientId;
                  return (
                    <button
                      type="button"
                      className="nc-quick-consultation__patientCard"
                      data-selected={selected || undefined}
                      aria-pressed={selected}
                      onClick={() => setSelectedPatientId(patient.id)}
                      key={patient.id}
                    >
                      <span
                        className="nc-quick-consultation__avatar"
                        aria-hidden="true"
                      >
                        {patient.photoUrl ? (
                          <img src={patient.photoUrl} alt="" />
                        ) : (
                          patient.initials
                        )}
                      </span>
                      <span className="nc-quick-consultation__patientIdentity">
                        <strong>{patient.fullName}</strong>
                        <small>EXP-{patient.recordNumber}</small>
                      </span>
                      {selected && (
                        <span
                          className="nc-quick-consultation__patientCheck"
                          aria-hidden="true"
                        >
                          <Check />
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </section>

          <section
            className="nc-quick-consultation__section"
            aria-labelledby="quick-consultation-action-step"
          >
            <div className="nc-quick-consultation__stepHeading">
              <span aria-hidden="true">2</span>
              <h3 id="quick-consultation-action-step">
                {t("quickConsultation.actionStep")}
              </h3>
            </div>
            <div
              className="nc-quick-consultation__actions"
              role="radiogroup"
              aria-labelledby="quick-consultation-action-step"
            >
              <button
                type="button"
                role="radio"
                aria-checked={action === "start-now"}
                data-selected={action === "start-now" || undefined}
                onClick={() => setAction("start-now")}
              >
                <span
                  className="nc-quick-consultation__actionIcon nc-quick-consultation__actionIcon--start"
                  aria-hidden="true"
                >
                  <Zap />
                </span>
                <span>
                  <strong>{t("quickConsultation.startNow")}</strong>
                  <small>{t("quickConsultation.startNowDescription")}</small>
                </span>
                {action === "start-now" && <Check aria-hidden="true" />}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={action === "schedule-later"}
                data-selected={action === "schedule-later" || undefined}
                onClick={() => setAction("schedule-later")}
              >
                <span
                  className="nc-quick-consultation__actionIcon nc-quick-consultation__actionIcon--schedule"
                  aria-hidden="true"
                >
                  <CalendarClock />
                </span>
                <span>
                  <strong>{t("quickConsultation.scheduleLater")}</strong>
                  <small>
                    {t("quickConsultation.scheduleLaterDescription")}
                  </small>
                </span>
                {action === "schedule-later" && <Check aria-hidden="true" />}
              </button>
            </div>
          </section>

          <section
            className="nc-quick-consultation__section"
            aria-labelledby="quick-consultation-summary-step"
          >
            <div className="nc-quick-consultation__stepHeading">
              <span aria-hidden="true">3</span>
              <h3 id="quick-consultation-summary-step">
                {t("quickConsultation.summaryStep")}
              </h3>
            </div>
            {!selectedPatient && (
              <div className="nc-quick-consultation__summaryEmpty">
                <FileText aria-hidden="true" />
                <span>{t("quickConsultation.selectPatientForSummary")}</span>
              </div>
            )}
            {selectedPatient && summary.loading && (
              <div
                className="nc-quick-consultation__summaryLoading"
                role="status"
              >
                {Array.from({ length: 4 }).map((_, index) => (
                  <span key={index} />
                ))}
              </div>
            )}
            {selectedPatient && summary.error && (
              <div className="nc-quick-consultation__summaryEmpty" role="alert">
                <AlertCircle aria-hidden="true" />
                <span>{summary.error}</span>
              </div>
            )}
            {selectedPatient && summary.summary && (
              <div className="nc-quick-consultation__summaryGrid">
                <article>
                  <Clock3 aria-hidden="true" />
                  <span>
                    <small>
                      {t("quickConsultation.summary.lastConsultation")}
                    </small>
                    <strong>
                      {summary.summary.latestConsultation
                        ? formatDate(
                            summary.summary.latestConsultation.date,
                            i18n.language,
                          )
                        : t("quickConsultation.summary.noInformation")}
                    </strong>
                    <em>
                      {summary.summary.latestConsultation
                        ? t("quickConsultation.summary.daysAgo", {
                            count: getDaysAgo(
                              summary.summary.latestConsultation.date,
                            ),
                          })
                        : t(
                            "quickConsultation.summary.noPreviousConsultations",
                          )}
                    </em>
                  </span>
                </article>
                <article>
                  <Target aria-hidden="true" />
                  <span>
                    <small>{t("quickConsultation.summary.currentGoal")}</small>
                    <strong>
                      {summary.summary.activeGoal?.label ??
                        t("quickConsultation.summary.noActiveGoal")}
                    </strong>
                    <em>
                      {summary.summary.activeGoal
                        ? formatDate(
                            summary.summary.activeGoal.targetDate,
                            i18n.language,
                          )
                        : t("quickConsultation.summary.noInformation")}
                    </em>
                  </span>
                </article>
                <article>
                  <FileText aria-hidden="true" />
                  <span>
                    <small>{t("quickConsultation.summary.activePlan")}</small>
                    <strong>
                      {summary.summary.activePlan?.name ??
                        t("quickConsultation.summary.noActivePlan")}
                    </strong>
                    <em>
                      {summary.summary.activePlan
                        ? t("quickConsultation.summary.active")
                        : t("quickConsultation.summary.noInformation")}
                    </em>
                  </span>
                </article>
                <article
                  data-tone={
                    summary.summary.alerts.length > 0 ? "warning" : "success"
                  }
                >
                  <ShieldCheck aria-hidden="true" />
                  <span>
                    <small>{t("quickConsultation.summary.alerts")}</small>
                    <strong>
                      {summary.summary.alerts[0]?.message ??
                        t("quickConsultation.summary.noAlerts")}
                    </strong>
                    <em>
                      {summary.summary.alerts.length > 1
                        ? t("quickConsultation.summary.moreAlerts", {
                            count: summary.summary.alerts.length - 1,
                          })
                        : t("quickConsultation.summary.allGood")}
                    </em>
                  </span>
                </article>
              </div>
            )}
          </section>

          <p className="nc-quick-consultation__notice">
            <AlertCircle aria-hidden="true" />
            <span>{footerMessage}</span>
          </p>
        </div>

        <footer className="nc-quick-consultation__footer">
          <DialogClose asChild>
            <button type="button" className="nc-quick-consultation__cancel">
              {t("common.cancel")}
            </button>
          </DialogClose>
          <button
            type="button"
            className="nc-quick-consultation__continue"
            disabled={!selectedPatient || !action || submitting}
            onClick={continueFlow}
          >
            <span>{t("quickConsultation.continue")}</span>
            {submitting ? (
              <LoaderCircle
                className="nc-quick-consultation__spin"
                aria-hidden="true"
              />
            ) : (
              <ArrowRight aria-hidden="true" />
            )}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

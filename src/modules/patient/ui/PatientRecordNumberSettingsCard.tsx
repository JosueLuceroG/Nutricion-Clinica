import * as React from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CaseUpper,
  CircleCheck,
  Hash,
  Minus,
  Plus,
  RotateCcw,
  Save,
  TextCursorInput,
  Trash2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { Switch } from "@components/ui/switch";
import {
  DEFAULT_PATIENT_RECORD_NUMBER_CONFIG,
  createPatientRecordNumberSegment,
  formatPatientRecordNumber,
  hasPatientRecordNumberSequence,
  isDefaultPatientRecordNumberConfig,
  normalizePatientRecordNumberConfig,
  type PatientRecordNumberConfig,
  type PatientRecordNumberSegment,
  type PatientRecordNumberSegmentType,
} from "../application/patientRecordNumber";
import { usePreferencesStore } from "@store/preferencesStore";

type ConfigurationMode = "default" | "custom";

const SEGMENT_OPTIONS: Array<{
  type: PatientRecordNumberSegmentType;
  labelKey: string;
  icon: LucideIcon;
}> = [
  {
    type: "text",
    labelKey: "settings.patient_record_number_block_text",
    icon: TextCursorInput,
  },
  {
    type: "separator",
    labelKey: "settings.patient_record_number_block_separator",
    icon: Minus,
  },
  {
    type: "firstName",
    labelKey: "settings.patient_record_number_block_first_name",
    icon: UserRound,
  },
  {
    type: "lastName",
    labelKey: "settings.patient_record_number_block_last_name",
    icon: UsersRound,
  },
  {
    type: "secondLastName",
    labelKey: "settings.patient_record_number_block_second_last_name",
    icon: UsersRound,
  },
  {
    type: "day",
    labelKey: "settings.patient_record_number_block_day",
    icon: CalendarDays,
  },
  {
    type: "month",
    labelKey: "settings.patient_record_number_block_month",
    icon: CalendarDays,
  },
  {
    type: "year",
    labelKey: "settings.patient_record_number_block_year",
    icon: CalendarDays,
  },
  {
    type: "sequence",
    labelKey: "settings.patient_record_number_block_sequence",
    icon: Hash,
  },
];

export function PatientRecordNumberSettingsCard() {
  const { t } = useTranslation();
  const nextId = React.useRef(0);
  const storedConfig = usePreferencesStore(
    (state) => state.patientRecordNumberConfig,
  );
  const nextSequence = usePreferencesStore(
    (state) => state.patientRecordNumberNextSequence,
  );
  const saveConfig = usePreferencesStore(
    (state) => state.setPatientRecordNumberConfig,
  );
  const normalizedStoredConfig = React.useMemo(
    () =>
      storedConfig ? normalizePatientRecordNumberConfig(storedConfig) : null,
    [storedConfig],
  );
  const [mode, setMode] = React.useState<ConfigurationMode>(() =>
    normalizedStoredConfig &&
    !isDefaultPatientRecordNumberConfig(normalizedStoredConfig)
      ? "custom"
      : "default",
  );
  const [draft, setDraft] = React.useState<PatientRecordNumberConfig>(() =>
    normalizedStoredConfig &&
    !isDefaultPatientRecordNumberConfig(normalizedStoredConfig)
      ? normalizedStoredConfig
      : { uppercase: true, segments: [] },
  );
  const [feedback, setFeedback] = React.useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const previewInput = {
    firstName: "Ana",
    lastName: "Rivera",
    secondLastName: "López",
    sequence: nextSequence,
  };
  const defaultPreview = formatPatientRecordNumber(
    DEFAULT_PATIENT_RECORD_NUMBER_CONFIG,
    previewInput,
  );
  const customPreview = formatPatientRecordNumber(draft, previewInput);
  const hasSequence = hasPatientRecordNumberSequence(draft);
  const canSaveCustom = draft.segments.length > 0 && Boolean(customPreview);

  const addSegment = (type: PatientRecordNumberSegmentType) => {
    nextId.current += 1;
    const segment = createPatientRecordNumberSegment(
      type,
      `${type}-${Date.now()}-${nextId.current}`,
    );
    setDraft((current) => ({
      ...current,
      segments: [...current.segments, segment],
    }));
  };

  const updateSegment = (
    id: string,
    update: Partial<PatientRecordNumberSegment>,
  ) => {
    setDraft((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id === id
          ? ({ ...segment, ...update } as PatientRecordNumberSegment)
          : segment,
      ),
    }));
  };

  const removeSegment = (id: string) => {
    setDraft((current) => ({
      ...current,
      segments: current.segments.filter((segment) => segment.id !== id),
    }));
  };

  const moveSegment = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= draft.segments.length) return;
    setDraft((current) => {
      const segments = [...current.segments];
      [segments[index], segments[destination]] = [
        segments[destination]!,
        segments[index]!,
      ];
      return { ...current, segments };
    });
  };

  const handleSave = () => {
    const config =
      mode === "default"
        ? DEFAULT_PATIENT_RECORD_NUMBER_CONFIG
        : normalizePatientRecordNumberConfig(draft);
    if (mode === "custom" && !canSaveCustom) {
      setFeedback({
        tone: "error",
        message: t("settings.patient_record_number_empty_error"),
      });
      return;
    }
    saveConfig(config);
    if (mode === "custom") setDraft(config);
    setFeedback({
      tone: "success",
      message: t("settings.patient_record_number_saved"),
    });
  };

  const handleClear = () => {
    saveConfig(null);
    setMode("default");
    setDraft({ uppercase: true, segments: [] });
    setFeedback({
      tone: "success",
      message: t("settings.patient_record_number_removed"),
    });
  };

  return (
    <Card
      id="patient-record-number-settings"
      data-settings-section="patient-record-number"
      tabIndex={-1}
      className="scroll-mt-6 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
      data-testid="patient-record-number-settings"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          {t("settings.patient_record_number_title")}
        </CardTitle>
        <CardDescription>
          {t("settings.patient_record_number_description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!storedConfig && (
          <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">
                {t("settings.patient_record_number_not_configured")}
              </p>
              <p className="mt-1 text-sm opacity-80">
                {t("settings.patient_record_number_not_configured_help")}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <ModeButton
            selected={mode === "default"}
            icon={Hash}
            title={t("settings.patient_record_number_default_option")}
            description={t(
              "settings.patient_record_number_default_option_help",
            )}
            onClick={() => setMode("default")}
          />
          <ModeButton
            selected={mode === "custom"}
            icon={Plus}
            title={t("settings.patient_record_number_custom_option")}
            description={t("settings.patient_record_number_custom_option_help")}
            onClick={() => setMode("custom")}
          />
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
            {t("settings.patient_record_number_default_preview")}
          </p>
          <code className="mt-2 block break-all text-lg font-semibold text-blue-950 dark:text-blue-100">
            {defaultPreview}
          </code>
          <p className="mt-2 text-xs text-blue-700/80 dark:text-blue-300/80">
            {t("settings.patient_record_number_default_formula")}
          </p>
        </div>

        {mode === "custom" && (
          <div className="space-y-5 rounded-lg border p-4">
            <div>
              <h4 className="font-semibold">
                {t("settings.patient_record_number_canvas_title")}
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("settings.patient_record_number_canvas_help")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("settings.patient_record_number_add_elements")}</Label>
              <div className="flex flex-wrap gap-2">
                {SEGMENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <Button
                      key={option.type}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSegment(option.type)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {t(option.labelKey)}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div
              className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3"
              data-testid="patient-record-number-canvas"
            >
              {draft.segments.length === 0 ? (
                <div className="grid min-h-28 place-items-center text-center text-sm text-muted-foreground">
                  <span>
                    <Plus className="mx-auto mb-2 h-6 w-6" />
                    {t("settings.patient_record_number_canvas_empty")}
                  </span>
                </div>
              ) : (
                draft.segments.map((segment, index) => (
                  <SegmentEditor
                    key={segment.id}
                    segment={segment}
                    index={index}
                    total={draft.segments.length}
                    onUpdate={(update) => updateSegment(segment.id, update)}
                    onRemove={() => removeSegment(segment.id)}
                    onMove={moveSegment}
                  />
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <Label className="flex items-center gap-2">
                <CaseUpper className="h-4 w-4" />
                {t("settings.patient_record_number_uppercase")}
              </Label>
              <Switch
                checked={draft.uppercase}
                onCheckedChange={(uppercase) =>
                  setDraft((current) => ({ ...current, uppercase }))
                }
                aria-label={t("settings.patient_record_number_uppercase")}
              />
            </div>

            {!hasSequence && draft.segments.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t("settings.patient_record_number_sequence_warning")}
              </div>
            )}

            <div className="rounded-md bg-muted/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("settings.patient_record_number_custom_preview")}
              </p>
              <code className="mt-2 block min-h-7 break-all text-lg font-semibold">
                {customPreview ||
                  t("settings.patient_record_number_preview_empty")}
              </code>
            </div>
          </div>
        )}

        {feedback ? (
          <div
            className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
              feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100"
                : "border-red-200 bg-red-50/80 text-red-950 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100"
            }`}
            role={feedback.tone === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {feedback.tone === "success" ? (
              <CircleCheck
                className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className="h-5 w-5 shrink-0 text-red-600 dark:text-red-300"
                aria-hidden="true"
              />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {storedConfig && (
            <Button type="button" variant="outline" onClick={handleClear}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("settings.patient_record_number_remove")}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={mode === "custom" && !canSaveCustom}
          >
            <Save className="mr-2 h-4 w-4" />
            {t("settings.patient_record_number_save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ModeButton({
  selected,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded-lg border p-4 text-left transition ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "hover:border-primary/50"
      }`}
      onClick={onClick}
      data-selected={selected || undefined}
    >
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <strong className="block text-sm">{title}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

function SegmentEditor({
  segment,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  segment: PatientRecordNumberSegment;
  index: number;
  total: number;
  onUpdate: (update: Partial<PatientRecordNumberSegment>) => void;
  onRemove: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const option = SEGMENT_OPTIONS.find((item) => item.type === segment.type)!;
  const Icon = option.icon;

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          aria-label={t("settings.patient_record_number_move_up")}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          aria-label={t("settings.patient_record_number_move_down")}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(140px,0.8fr)_minmax(0,1fr)] sm:items-center">
        <Label className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {t(option.labelKey)}
        </Label>
        <SegmentControl segment={segment} onUpdate={onUpdate} />
      </div>

      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onRemove}
        aria-label={t("settings.patient_record_number_remove_block")}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function SegmentControl({
  segment,
  onUpdate,
}: {
  segment: PatientRecordNumberSegment;
  onUpdate: (update: Partial<PatientRecordNumberSegment>) => void;
}) {
  const { t } = useTranslation();

  switch (segment.type) {
    case "text":
      return (
        <Input
          value={segment.value}
          maxLength={30}
          onChange={(event) => onUpdate({ value: event.target.value })}
          placeholder={t("settings.patient_record_number_text_placeholder")}
          aria-label={t("settings.patient_record_number_text_value")}
        />
      );
    case "separator":
      return (
        <Input
          value={segment.value}
          maxLength={3}
          onChange={(event) => onUpdate({ value: event.target.value })}
          placeholder="-"
          aria-label={t("settings.patient_record_number_separator")}
        />
      );
    case "firstName":
    case "lastName":
    case "secondLastName":
      return (
        <NumberInput
          value={segment.length}
          min={1}
          max={10}
          onChange={(length) => onUpdate({ length })}
          ariaLabel={t("settings.patient_record_number_character_count")}
        />
      );
    case "year":
      return (
        <Select
          value={String(segment.digits)}
          onValueChange={(value) =>
            onUpdate({ digits: Number(value) as 2 | 4 })
          }
        >
          <SelectTrigger
            aria-label={t("settings.patient_record_number_year_digits")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="4">4</SelectItem>
          </SelectContent>
        </Select>
      );
    case "sequence":
      return (
        <NumberInput
          value={segment.digits}
          min={1}
          max={6}
          onChange={(digits) => onUpdate({ digits })}
          ariaLabel={t("settings.patient_record_number_sequence_digits")}
        />
      );
    case "day":
    case "month":
      return (
        <span className="text-sm text-muted-foreground">
          {t("settings.patient_record_number_automatic_value")}
        </span>
      );
  }
}

function NumberInput({
  value,
  min,
  max,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={ariaLabel}
    />
  );
}

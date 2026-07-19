import * as React from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import {
  Save,
  X,
  User,
  Mail,
  Phone,
  Calendar,
  FileText,
  Heart,
  Tags,
  IdCard,
} from "lucide-react";
import { toast } from "sonner";
import {
  PatientFormSchema,
  patientFormDefaultValues,
  type PatientFormValues,
} from "@modules/patient/application/patientFormSchema";
import type { Sex } from "@modules/patient/domain/Sex";
import { Email, Phone as PhoneVO } from "@modules/patient/domain/Contact";
import { patientService } from "@services/patientService";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { Label } from "@components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import type { Patient } from "@modules/patient/domain/Patient";
import type { PatientId } from "@modules/patient/domain/PatientId";
import { useUnsavedChangesGuard } from "@hooks/useUnsavedChangesGuard";

interface PatientFormProps {
  mode: "create" | "edit";
  patientId?: PatientId;
  initialPatient?: Patient;
  onCreated?: (patient: Patient) => void;
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function PatientForm({
  mode,
  patientId,
  initialPatient,
  onCreated,
}: PatientFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);
  // Ref-based lock: protege contra dos `onSubmit` consecutivos dentro del
  // mismo tick (doble-click o Enter repetido) antes de que React procese
  // el `setSubmitting(true)` y deshabilite el botón. Sin este ref, dos
  // submits rápidos crearían DOS pacientes con IDs distintos.
  const submitLockRef = React.useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<PatientFormValues>({
    resolver: zodResolver(PatientFormSchema),
    defaultValues: patientFormDefaultValues,
  });
  useUnsavedChangesGuard(
    isDirty && !submitting,
    t("common.unsaved_changes_warning"),
  );

  React.useEffect(() => {
    if (initialPatient) {
      reset({
        firstName: initialPatient.firstName,
        lastName: initialPatient.lastName,
        secondLastName: initialPatient.secondLastName ?? "",
        birthDate: toDateInputValue(initialPatient.birthDate),
        sex: initialPatient.sex,
        gender: initialPatient.gender ?? undefined,
        maritalStatus: initialPatient.maritalStatus ?? undefined,
        occupation: initialPatient.occupation ?? "",
        education: initialPatient.education ?? undefined,
        email: initialPatient.email?.toString() ?? "",
        phone: initialPatient.phone?.toString() ?? "",
        secondaryPhone: initialPatient.secondaryPhone?.toString() ?? "",
        emergencyContactName: initialPatient.emergencyContactName ?? "",
        emergencyContactRelationship:
          initialPatient.emergencyContactRelationship ?? "",
        emergencyContactPhone:
          initialPatient.emergencyContactPhone?.toString() ?? "",
        generalNotes: initialPatient.generalNotes ?? "",
        clinicalTags: initialPatient.clinicalTags.join(", "),
        claveInterna: initialPatient.claveInterna ?? "",
        birthPlace: initialPatient.birthPlace ?? "",
        address: initialPatient.address ?? "",
        nationality: initialPatient.nationality ?? "",
        idType: initialPatient.idType ?? "",
        idNumber: initialPatient.idNumber ?? "",
        dischargeReason: initialPatient.dischargeReason ?? "",
        responsibleProfessionalId:
          initialPatient.responsibleProfessionalId ?? "",
        externalRecordNumber: initialPatient.externalRecordNumber ?? "",
        admissionReason: initialPatient.admissionReason ?? "",
        photoUrl: initialPatient.photoUrl ?? "",
      });
    }
  }, [initialPatient, reset]);

  const onSubmit = async (values: PatientFormValues) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const parseStr = (v: string | undefined): string | null =>
        v && v.trim() ? v.trim() : null;
      const parseTags = (v: string | undefined): string[] =>
        v
          ? v
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];

      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        secondLastName: parseStr(values.secondLastName),
        birthDate: new Date(values.birthDate),
        sex: values.sex as Sex,
        gender: values.gender ?? null,
        maritalStatus: values.maritalStatus ?? null,
        occupation: parseStr(values.occupation),
        education: values.education ?? null,
        email: values.email ? Email.from(values.email) : null,
        phone: values.phone ? PhoneVO.from(values.phone) : null,
        secondaryPhone: values.secondaryPhone
          ? PhoneVO.from(values.secondaryPhone)
          : null,
        emergencyContactName: parseStr(values.emergencyContactName),
        emergencyContactRelationship: parseStr(
          values.emergencyContactRelationship,
        ),
        emergencyContactPhone: values.emergencyContactPhone
          ? PhoneVO.from(values.emergencyContactPhone)
          : null,
        generalNotes: parseStr(values.generalNotes),
        clinicalTags: parseTags(values.clinicalTags),
        claveInterna: parseStr(values.claveInterna),
        birthPlace: parseStr(values.birthPlace),
        address: parseStr(values.address),
        nationality: parseStr(values.nationality),
        idType: parseStr(values.idType),
        idNumber: parseStr(values.idNumber),
        dischargeReason: parseStr(values.dischargeReason),
        responsibleProfessionalId: parseStr(values.responsibleProfessionalId),
        externalRecordNumber: parseStr(values.externalRecordNumber),
        admissionReason: parseStr(values.admissionReason),
        photoUrl: parseStr(values.photoUrl),
      };

      if (mode === "create") {
        const created = await patientService.create.execute(payload);
        toast.success(t("patient.created_success"), {
          description: created.fullName,
        });
        if (onCreated) {
          onCreated(created);
        } else {
          navigate(`/pacientes/${created.id.toString()}`);
        }
      } else if (patientId) {
        const updated = await patientService.update.execute(patientId, payload);
        toast.success(t("patient.updated_success"), {
          description: updated.fullName,
        });
        navigate(`/pacientes/${updated.id.toString()}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("common.unexpected_error");
      toast.error(
        mode === "create"
          ? t("patient.create_error")
          : t("patient.update_error"),
        {
          description: message,
        },
      );
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t("patient.personal_data")}
          </CardTitle>
          <CardDescription>{t("patient.personal_data_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("patient.names")}
            error={errors.firstName?.message}
            required
            htmlFor="field-patient-first-name"
          >
            <Input
              id="field-patient-first-name"
              {...register("firstName")}
              placeholder={t("patient.first_name_placeholder")}
              autoComplete="given-name"
              aria-invalid={!!errors.firstName}
              aria-describedby={
                errors.firstName ? "field-patient-first-name-error" : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.first_surname")}
            error={errors.lastName?.message}
            required
            htmlFor="field-patient-last-name"
          >
            <Input
              id="field-patient-last-name"
              {...register("lastName")}
              placeholder={t("patient.last_name_placeholder")}
              autoComplete="family-name"
              aria-invalid={!!errors.lastName}
              aria-describedby={
                errors.lastName ? "field-patient-last-name-error" : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.second_surname")}
            error={errors.secondLastName?.message}
            htmlFor="field-patient-second-last-name"
          >
            <Input
              id="field-patient-second-last-name"
              {...register("secondLastName")}
              placeholder={t("patient.second_last_name_placeholder")}
              aria-describedby={
                errors.secondLastName
                  ? "field-patient-second-last-name-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.birth_date")}
            error={errors.birthDate?.message}
            required
            htmlFor="field-patient-birth-date"
          >
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="field-patient-birth-date"
                type="date"
                {...register("birthDate")}
                className="pl-9"
                aria-invalid={!!errors.birthDate}
                aria-describedby={
                  errors.birthDate
                    ? "field-patient-birth-date-error"
                    : undefined
                }
              />
            </div>
          </FormField>
          <FormField
            label={t("patient.sex")}
            error={errors.sex?.message}
            required
            htmlFor="field-patient-sex"
          >
            <select
              id="field-patient-sex"
              {...register("sex")}
              className={selectClass}
              aria-invalid={!!errors.sex}
              aria-describedby={
                errors.sex ? "field-patient-sex-error" : undefined
              }
            >
              {(["female", "male", "intersex", "undisclosed"] as Sex[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {t(`patient.sex_${s}`)}
                  </option>
                ),
              )}
            </select>
          </FormField>
          <FormField
            label={t("patient.occupation")}
            error={errors.occupation?.message}
            className="sm:col-span-2"
            htmlFor="field-patient-occupation"
          >
            <Input
              id="field-patient-occupation"
              {...register("occupation")}
              placeholder={t("patient.occupation_placeholder")}
              aria-describedby={
                errors.occupation ? "field-patient-occupation-error" : undefined
              }
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("patient.contact")}</CardTitle>
          <CardDescription>{t("patient.contact_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("patient.email")}
            error={errors.email?.message}
            htmlFor="field-patient-email"
          >
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="field-patient-email"
                type="email"
                {...register("email")}
                placeholder="paciente@correo.com"
                autoComplete="email"
                className="pl-9"
                aria-invalid={!!errors.email}
                aria-describedby={
                  errors.email ? "field-patient-email-error" : undefined
                }
              />
            </div>
          </FormField>
          <FormField
            label={t("patient.primary_phone")}
            error={errors.phone?.message}
            htmlFor="field-patient-phone"
          >
            <div className="relative">
              <Phone
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="field-patient-phone"
                type="tel"
                {...register("phone")}
                placeholder="+52 55 1234 5678"
                autoComplete="tel"
                className="pl-9"
                aria-invalid={!!errors.phone}
                aria-describedby={
                  errors.phone ? "field-patient-phone-error" : undefined
                }
              />
            </div>
          </FormField>
          <FormField
            label={t("patient.secondary_phone")}
            error={errors.secondaryPhone?.message}
            htmlFor="field-patient-secondary-phone"
          >
            <Input
              id="field-patient-secondary-phone"
              type="tel"
              {...register("secondaryPhone")}
              placeholder="+52 55 8765 4321"
              aria-describedby={
                errors.secondaryPhone
                  ? "field-patient-secondary-phone-error"
                  : undefined
              }
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            {t("patient.emergency_contact")}
          </CardTitle>
          <CardDescription>
            {t("patient.emergency_contact_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField
            label={t("patient.full_name")}
            error={errors.emergencyContactName?.message}
            htmlFor="field-patient-emergency-name"
          >
            <Input
              id="field-patient-emergency-name"
              {...register("emergencyContactName")}
              placeholder={t("patient.emergency_name_placeholder")}
              aria-describedby={
                errors.emergencyContactName
                  ? "field-patient-emergency-name-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.relationship")}
            error={errors.emergencyContactRelationship?.message}
            htmlFor="field-patient-emergency-relationship"
          >
            <Input
              id="field-patient-emergency-relationship"
              {...register("emergencyContactRelationship")}
              placeholder={t("patient.relationship_placeholder")}
              aria-describedby={
                errors.emergencyContactRelationship
                  ? "field-patient-emergency-relationship-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.phone")}
            error={errors.emergencyContactPhone?.message}
            htmlFor="field-patient-emergency-phone"
          >
            <Input
              id="field-patient-emergency-phone"
              type="tel"
              {...register("emergencyContactPhone")}
              placeholder="+52 55 1234 5678"
              aria-describedby={
                errors.emergencyContactPhone
                  ? "field-patient-emergency-phone-error"
                  : undefined
              }
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="h-4 w-4" />
            {t("patient.identification_and_record")}
          </CardTitle>
          <CardDescription>
            {t("patient.identification_and_record_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("patient.clave_interna")}
            error={errors.claveInterna?.message}
            htmlFor="field-patient-clave-interna"
          >
            <Input
              id="field-patient-clave-interna"
              {...register("claveInterna")}
              aria-describedby={
                errors.claveInterna
                  ? "field-patient-clave-interna-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.birth_place")}
            error={errors.birthPlace?.message}
            htmlFor="field-patient-birth-place"
          >
            <Input
              id="field-patient-birth-place"
              {...register("birthPlace")}
              aria-describedby={
                errors.birthPlace
                  ? "field-patient-birth-place-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.address")}
            error={errors.address?.message}
            className="sm:col-span-2"
            htmlFor="field-patient-address"
          >
            <Textarea
              id="field-patient-address"
              {...register("address")}
              rows={2}
              aria-describedby={
                errors.address ? "field-patient-address-error" : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.nationality")}
            error={errors.nationality?.message}
            htmlFor="field-patient-nationality"
          >
            <Input
              id="field-patient-nationality"
              {...register("nationality")}
              aria-describedby={
                errors.nationality
                  ? "field-patient-nationality-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.id_type")}
            error={errors.idType?.message}
            htmlFor="field-patient-id-type"
          >
            <Input
              id="field-patient-id-type"
              {...register("idType")}
              aria-describedby={
                errors.idType ? "field-patient-id-type-error" : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.id_number")}
            error={errors.idNumber?.message}
            htmlFor="field-patient-id-number"
          >
            <Input
              id="field-patient-id-number"
              {...register("idNumber")}
              aria-describedby={
                errors.idNumber ? "field-patient-id-number-error" : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.discharge_reason")}
            error={errors.dischargeReason?.message}
            className="sm:col-span-2"
            htmlFor="field-patient-discharge-reason"
          >
            <Textarea
              id="field-patient-discharge-reason"
              {...register("dischargeReason")}
              rows={2}
              aria-describedby={
                errors.dischargeReason
                  ? "field-patient-discharge-reason-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.responsible_professional_id")}
            error={errors.responsibleProfessionalId?.message}
            htmlFor="field-patient-responsible-professional-id"
          >
            <Input
              id="field-patient-responsible-professional-id"
              {...register("responsibleProfessionalId")}
              aria-describedby={
                errors.responsibleProfessionalId
                  ? "field-patient-responsible-professional-id-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.external_record_number")}
            error={errors.externalRecordNumber?.message}
            htmlFor="field-patient-external-record-number"
          >
            <Input
              id="field-patient-external-record-number"
              {...register("externalRecordNumber")}
              aria-describedby={
                errors.externalRecordNumber
                  ? "field-patient-external-record-number-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.wizard.admission_reason")}
            error={errors.admissionReason?.message}
            className="sm:col-span-2"
            htmlFor="field-patient-admission-reason"
          >
            <Textarea
              id="field-patient-admission-reason"
              {...register("admissionReason")}
              rows={2}
              aria-describedby={
                errors.admissionReason
                  ? "field-patient-admission-reason-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.photo_url")}
            error={errors.photoUrl?.message}
            className="sm:col-span-2"
            htmlFor="field-patient-photo-url"
          >
            <Input
              id="field-patient-photo-url"
              {...register("photoUrl")}
              aria-describedby={
                errors.photoUrl ? "field-patient-photo-url-error" : undefined
              }
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("patient.notes_and_tags")}
          </CardTitle>
          <CardDescription>{t("patient.notes_and_tags_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField
            label={t("patient.general_notes")}
            error={errors.generalNotes?.message}
            htmlFor="field-patient-general-notes"
          >
            <Textarea
              id="field-patient-general-notes"
              {...register("generalNotes")}
              placeholder={t("patient.general_notes_placeholder")}
              rows={3}
              aria-invalid={!!errors.generalNotes}
              aria-describedby={
                errors.generalNotes
                  ? "field-patient-general-notes-error"
                  : undefined
              }
            />
          </FormField>
          <FormField
            label={t("patient.clinical_tags")}
            error={errors.clinicalTags?.message}
            htmlFor="field-patient-clinical-tags"
          >
            <div className="relative">
              <Tags
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="field-patient-clinical-tags"
                {...register("clinicalTags")}
                placeholder={t("patient.clinical_tags_placeholder")}
                className="pl-9"
                aria-describedby={
                  errors.clinicalTags
                    ? "field-patient-clinical-tags-error"
                    : undefined
                }
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("patient.comma_separated")}
            </p>
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(-1)}
          disabled={submitting}
        >
          <X className="mr-2 h-4 w-4" />
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={submitting || (mode === "edit" && !isDirty)}
        >
          <Save className="mr-2 h-4 w-4" />
          {submitting
            ? t("common.saving")
            : mode === "create"
              ? t("patient.create")
              : t("settings.save_changes")}
        </Button>
      </div>
    </form>
  );
}

function FormField({
  label,
  error,
  required,
  className,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function toDateInputValue(date: Date): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function PatientFormSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-72" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

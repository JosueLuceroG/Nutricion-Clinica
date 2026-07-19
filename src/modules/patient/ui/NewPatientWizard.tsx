import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleCheck,
  CloudUpload,
  FolderOpen,
  Heart,
  Info,
  Mail,
  MessageCircle,
  MessageCircleOff,
  Phone,
  Save,
  ShieldCheck,
  Tags,
  Trash2,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useForm, type FieldError, type Path } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageContent, PageHeader } from "@app/layout/AppLayout";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { useUnsavedChangesGuard } from "@hooks/useUnsavedChangesGuard";
import {
  Email,
  EmailSchema,
  Phone as PhoneVO,
  PhoneSchema,
} from "@modules/patient/domain/Contact";
import type { Patient } from "@modules/patient/domain/Patient";
import { SexSchema, type Sex } from "@modules/patient/domain/Sex";
import { patientService } from "@services/patientService";
import { useAuthStore } from "@store/authStore";
import "./NewPatientWizard.css";

const NewPatientWizardSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(100, "Máximo 100 caracteres"),
  lastName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(100, "Máximo 100 caracteres"),
  secondLastName: z.string().trim().max(100).optional().or(z.literal("")),
  age: z
    .string()
    .trim()
    .min(1, "Requerido")
    .refine((value) => /^\d{1,3}$/.test(value), "Ingresa una edad válida")
    .refine((value) => Number(value) <= 125, "La edad máxima es 125 años"),
  sex: z
    .union([SexSchema, z.literal("")])
    .refine((value): boolean => value !== "", "Requerido"),
  occupation: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .optional()
    .or(z.literal("")),
  email: requiredContact(EmailSchema, "Correo electrónico inválido"),
  phone: requiredContact(PhoneSchema, "Teléfono inválido"),
  secondaryPhone: optionalContact(PhoneSchema, "Teléfono inválido"),
  whatsappEnabled: z.enum(["yes", "no"]),
  emergencyContactName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(200, "Máximo 200 caracteres"),
  emergencyContactRelationship: z
    .string()
    .trim()
    .min(1, "Requerido")
    .max(100, "Máximo 100 caracteres"),
  emergencyContactPhone: requiredContact(PhoneSchema, "Teléfono inválido"),
  externalRecordNumber: z
    .string()
    .trim()
    .min(1, "Requerido")
    .max(100, "Máximo 100 caracteres"),
  admissionReason: z
    .string()
    .trim()
    .min(5, "Mínimo 5 caracteres")
    .max(500, "Máximo 500 caracteres"),
  photoUrl: z.string().max(7_000_000, "La imagen no puede superar 5 MB"),
  clinicalTags: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
  generalNotes: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .optional()
    .or(z.literal("")),
});

type NewPatientWizardValues = z.infer<typeof NewPatientWizardSchema>;

interface NewPatientWizardProps {
  onCreated?: (patient: Patient) => void;
}

interface WizardStep {
  title: string;
  cardTitle?: string;
  description: string;
  cardDescription: string;
  icon: LucideIcon;
  fields: Path<NewPatientWizardValues>[];
}

const DEFAULT_VALUES: NewPatientWizardValues = {
  firstName: "",
  lastName: "",
  secondLastName: "",
  age: "",
  sex: "",
  occupation: "",
  email: "",
  phone: "",
  secondaryPhone: "",
  whatsappEnabled: "yes",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactPhone: "",
  externalRecordNumber: "",
  admissionReason: "",
  photoUrl: "",
  clinicalTags: "",
  generalNotes: "",
};

const EMERGENCY_RELATIONSHIPS = [
  ["Madre", "mother"],
  ["Padre", "father"],
  ["Cónyuge", "spouse"],
  ["Pareja", "partner"],
  ["Hijo/a", "child"],
  ["Hermano/a", "sibling"],
  ["Tutor(a)", "guardian"],
  ["Otro", "other"],
] as const;

export function NewPatientWizard({ onCreated }: NewPatientWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [showContactNotice, setShowContactNotice] = React.useState(true);
  const [showClinicalNotice, setShowClinicalNotice] = React.useState(true);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [draggingPhoto, setDraggingPhoto] = React.useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const submitLockRef = React.useRef(false);
  const steps: WizardStep[] = [
    {
      title: t("patient.wizard.personal_short"),
      description: t("patient.wizard.personal_menu_description"),
      cardDescription: t("patient.wizard.personal_card_description"),
      icon: UserRound,
      fields: [
        "firstName",
        "lastName",
        "secondLastName",
        "age",
        "sex",
        "occupation",
      ],
    },
    {
      title: t("patient.wizard.contact_short"),
      cardTitle: t("patient.wizard.contact_title"),
      description: t("patient.wizard.contact_menu_description"),
      cardDescription: t("patient.contact_desc"),
      icon: Phone,
      fields: ["email", "phone", "secondaryPhone", "whatsappEnabled"],
    },
    {
      title: t("patient.wizard.emergency_short"),
      cardTitle: t("patient.wizard.emergency_title"),
      description: t("patient.wizard.emergency_menu_description"),
      cardDescription: t("patient.emergency_contact_desc"),
      icon: Heart,
      fields: [
        "emergencyContactName",
        "emergencyContactRelationship",
        "emergencyContactPhone",
      ],
    },
    {
      title: t("patient.wizard.clinical_record_short"),
      description: t("patient.wizard.clinical_record_menu_description"),
      cardDescription: t("patient.wizard.clinical_record_menu_description"),
      icon: FolderOpen,
      fields: ["externalRecordNumber", "admissionReason", "photoUrl"],
    },
    {
      title: t("patient.wizard.notes_short"),
      description: t("patient.wizard.notes_menu_description"),
      cardDescription: t("patient.wizard.notes_menu_description"),
      icon: Tags,
      fields: ["clinicalTags", "generalNotes"],
    },
  ];

  const {
    register,
    handleSubmit,
    trigger,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<NewPatientWizardValues>({
    resolver: zodResolver(NewPatientWizardSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const navigationBlocker = useUnsavedChangesGuard(
    isDirty && !submitting,
    t("common.unsaved_changes_warning"),
    { useNativeNavigationConfirm: false },
  );
  const whatsappEnabled = watch("whatsappEnabled");
  const photoUrl = watch("photoUrl");

  const goToNextStep = async () => {
    if (step === 3 && !user) {
      toast.error(t("patient.wizard.responsible_unavailable"));
      return;
    }
    const isValid = await trigger(steps[step].fields, { shouldFocus: true });
    if (!isValid) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const onSubmit = async (formValues: NewPatientWizardValues) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      if (!user) throw new Error(t("patient.wizard.responsible_unavailable"));
      const created = await patientService.create.execute({
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        secondLastName: optionalString(formValues.secondLastName),
        birthDate: birthDateFromAge(Number(formValues.age)),
        sex: formValues.sex as Sex,
        occupation: optionalString(formValues.occupation),
        email: Email.from(formValues.email),
        phone: PhoneVO.from(formValues.phone),
        secondaryPhone: formValues.secondaryPhone
          ? PhoneVO.from(formValues.secondaryPhone)
          : null,
        whatsappEnabled: formValues.whatsappEnabled === "yes",
        emergencyContactName: optionalString(formValues.emergencyContactName),
        emergencyContactRelationship: optionalString(
          formValues.emergencyContactRelationship,
        ),
        emergencyContactPhone: formValues.emergencyContactPhone
          ? PhoneVO.from(formValues.emergencyContactPhone)
          : null,
        responsibleProfessionalId: user.id,
        externalRecordNumber: formValues.externalRecordNumber.trim(),
        admissionReason: formValues.admissionReason.trim(),
        photoUrl: optionalString(formValues.photoUrl),
        clinicalTags: parseTags(formValues.clinicalTags),
        generalNotes: optionalString(formValues.generalNotes),
      });
      reset(formValues);
      toast.success(t("patient.created_success"), {
        description: created.fullName,
      });
      if (onCreated) onCreated(created);
      else navigate(`/pacientes/${created.id.toString()}`);
    } catch (error) {
      toast.error(t("patient.create_error"), {
        description:
          error instanceof Error ? error.message : t("common.unexpected_error"),
      });
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const currentStep = steps[step];
  const CurrentStepIcon = currentStep.icon;
  const isLastStep = step === steps.length - 1;
  const responsibleInitials = getInitials(user?.nombreCompleto ?? "");

  const selectPatientPhoto = async (file?: File) => {
    if (!file) return;
    setPhotoError(null);
    if (!PATIENT_PHOTO_TYPES.includes(file.type)) {
      setPhotoError(t("patient.wizard.photo_type_error"));
      return;
    }
    if (file.size > MAX_PATIENT_PHOTO_BYTES) {
      setPhotoError(t("patient.wizard.photo_size_error"));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setValue("photoUrl", dataUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch {
      setPhotoError(t("patient.wizard.photo_read_error"));
    }
  };

  return (
    <>
      <PageHeader
        title={t("patient.wizard.registration_title")}
        description={t("patient.wizard.registration_subtitle")}
        className="nc-new-patient__pageHeader"
      />

      <PageContent className="nc-new-patient-page">
        <div className="nc-new-patient">
          <aside className="nc-new-patient__sidebar">
            <nav aria-label={t("patient.wizard.progress_label")}>
              {steps.map((wizardStep, index) => {
                const StepIcon = wizardStep.icon;
                const current = index === step;
                const completed = index < step;
                return (
                  <button
                    key={wizardStep.title}
                    type="button"
                    className="nc-new-patient__menuStep"
                    data-current={current || undefined}
                    data-completed={completed || undefined}
                    disabled={index > step}
                    onClick={() => index < step && setStep(index)}
                    aria-current={current ? "step" : undefined}
                  >
                    <span className="nc-new-patient__stepNumber">
                      {index + 1}
                    </span>
                    <span
                      className="nc-new-patient__menuIcon"
                      aria-hidden="true"
                    >
                      <StepIcon />
                    </span>
                    <span className="nc-new-patient__menuText">
                      <strong>{wizardStep.title}</strong>
                      <small>{wizardStep.description}</small>
                    </span>
                    {completed && (
                      <CircleCheck
                        className="nc-new-patient__completedIcon"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="nc-new-patient__main">
            <form
              id="new-patient-wizard-form"
              noValidate
              onSubmit={(event) => {
                if (!isLastStep) {
                  event.preventDefault();
                  void goToNextStep();
                  return;
                }
                void handleSubmit(onSubmit)(event);
              }}
            >
              <section
                className="nc-new-patient__formCard"
                data-step={step}
                aria-labelledby="new-patient-step-title"
              >
                <header className="nc-new-patient__formHeader">
                  <span
                    className="nc-new-patient__formHeaderIcon"
                    aria-hidden="true"
                  >
                    <CurrentStepIcon />
                  </span>
                  <div>
                    <h2 id="new-patient-step-title">
                      {currentStep.cardTitle ?? currentStep.title}
                    </h2>
                    <p>{currentStep.cardDescription}</p>
                  </div>
                </header>

                {step === 0 && <PatientIllustration />}

                <div
                  className="nc-new-patient__formFields"
                  data-has-illustration={step === 0 || undefined}
                  data-contact={step === 1 || undefined}
                  data-emergency={step === 2 || undefined}
                  data-clinical-record={step === 3 || undefined}
                >
                  {step === 0 && (
                    <>
                      <WizardField
                        label={t("patient.names")}
                        htmlFor="field-new-patient-first-name"
                        error={errors.firstName}
                        required
                      >
                        <IconInput icon={UserRound}>
                          <Input
                            id="field-new-patient-first-name"
                            autoComplete="given-name"
                            placeholder={t("patient.first_name_placeholder")}
                            {...register("firstName")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.first_surname")}
                        htmlFor="field-new-patient-last-name"
                        error={errors.lastName}
                        required
                      >
                        <IconInput icon={UsersRound}>
                          <Input
                            id="field-new-patient-last-name"
                            autoComplete="family-name"
                            placeholder={t("patient.last_name_placeholder")}
                            {...register("lastName")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.second_surname")}
                        htmlFor="field-new-patient-second-last-name"
                        error={errors.secondLastName}
                      >
                        <IconInput icon={UserRound}>
                          <Input
                            id="field-new-patient-second-last-name"
                            placeholder={t(
                              "patient.second_last_name_placeholder",
                            )}
                            {...register("secondLastName")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.age")}
                        htmlFor="field-new-patient-age"
                        error={errors.age}
                        required
                      >
                        <IconInput icon={CalendarDays}>
                          <Input
                            id="field-new-patient-age"
                            type="number"
                            min="0"
                            max="125"
                            inputMode="numeric"
                            placeholder={t(
                              "patient.wizard.age_input_placeholder",
                            )}
                            {...register("age")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.sex")}
                        htmlFor="field-new-patient-sex"
                        error={errors.sex}
                        required
                      >
                        <IconInput icon={UserRound}>
                          <select
                            id="field-new-patient-sex"
                            {...register("sex")}
                          >
                            <option value="" disabled>
                              {t("patient.wizard.select_option")}
                            </option>
                            {(
                              [
                                "female",
                                "male",
                                "intersex",
                                "undisclosed",
                              ] as Sex[]
                            ).map((sex) => (
                              <option key={sex} value={sex}>
                                {t(`patient.sex_${sex}`)}
                              </option>
                            ))}
                          </select>
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.occupation")}
                        htmlFor="field-new-patient-occupation"
                        error={errors.occupation}
                      >
                        <IconInput icon={BriefcaseBusiness}>
                          <Input
                            id="field-new-patient-occupation"
                            placeholder={t("patient.occupation_placeholder")}
                            {...register("occupation")}
                          />
                        </IconInput>
                      </WizardField>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <WizardField
                        label={t("patient.email")}
                        htmlFor="field-new-patient-email"
                        error={errors.email}
                        required
                      >
                        <IconInput icon={Mail}>
                          <Input
                            id="field-new-patient-email"
                            type="email"
                            autoComplete="email"
                            placeholder="ejemplo@correo.com"
                            {...register("email")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.primary_phone")}
                        htmlFor="field-new-patient-phone"
                        error={errors.phone}
                        required
                      >
                        <IconInput icon={Phone}>
                          <Input
                            id="field-new-patient-phone"
                            type="tel"
                            autoComplete="tel"
                            placeholder="+52 55 1234 5678"
                            {...register("phone")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.wizard.secondary_phone_optional")}
                        htmlFor="field-new-patient-secondary-phone"
                        error={errors.secondaryPhone}
                        className="nc-new-patient__field--full"
                      >
                        <IconInput icon={Phone}>
                          <Input
                            id="field-new-patient-secondary-phone"
                            type="tel"
                            autoComplete="tel-national"
                            placeholder="+52 55 8765 4321"
                            {...register("secondaryPhone")}
                          />
                        </IconInput>
                      </WizardField>
                      <div
                        className="nc-new-patient__whatsappField"
                        data-enabled={whatsappEnabled === "yes"}
                        role="radiogroup"
                        aria-labelledby="new-patient-whatsapp-label"
                      >
                        <div className="nc-new-patient__whatsappQuestion">
                          <strong>
                            <span id="new-patient-whatsapp-label">
                              {t("patient.wizard.whatsapp_question")}
                            </span>
                          </strong>
                          <small>
                            {t("patient.wizard.whatsapp_description")}
                          </small>
                        </div>
                        <div className="nc-new-patient__whatsappOptions">
                          <label>
                            <input
                              type="radio"
                              value="yes"
                              {...register("whatsappEnabled")}
                            />
                            <span>
                              <MessageCircle aria-hidden="true" />
                              {t("common.yes")}
                            </span>
                          </label>
                          <label>
                            <input
                              type="radio"
                              value="no"
                              {...register("whatsappEnabled")}
                            />
                            <span>
                              <MessageCircleOff aria-hidden="true" />
                              {t("common.no")}
                            </span>
                          </label>
                        </div>
                        {whatsappEnabled === "yes" && (
                          <div className="nc-new-patient__whatsappSame">
                            <MessageCircle aria-hidden="true" />
                            <span>
                              <strong>
                                {t("patient.wizard.whatsapp_same_number")}
                              </strong>
                              <small>
                                {t(
                                  "patient.wizard.whatsapp_same_number_description",
                                )}
                              </small>
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <WizardField
                        label={t("patient.full_name")}
                        htmlFor="field-new-patient-emergency-name"
                        error={errors.emergencyContactName}
                        required
                      >
                        <IconInput icon={UserRound}>
                          <Input
                            id="field-new-patient-emergency-name"
                            placeholder={t(
                              "patient.wizard.emergency_name_placeholder",
                            )}
                            {...register("emergencyContactName")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.relationship")}
                        htmlFor="field-new-patient-emergency-relationship"
                        error={errors.emergencyContactRelationship}
                        required
                      >
                        <IconInput icon={UsersRound}>
                          <select
                            id="field-new-patient-emergency-relationship"
                            {...register("emergencyContactRelationship")}
                          >
                            <option value="" disabled>
                              {t(
                                "patient.wizard.relationship_select_placeholder",
                              )}
                            </option>
                            {EMERGENCY_RELATIONSHIPS.map(([value, key]) => (
                              <option key={key} value={value}>
                                {t(`patient.wizard.relationship_${key}`)}
                              </option>
                            ))}
                          </select>
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.phone")}
                        htmlFor="field-new-patient-emergency-phone"
                        error={errors.emergencyContactPhone}
                        required
                      >
                        <IconInput icon={Phone}>
                          <Input
                            id="field-new-patient-emergency-phone"
                            type="tel"
                            placeholder="+52 55 1234 5678"
                            {...register("emergencyContactPhone")}
                          />
                        </IconInput>
                      </WizardField>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <div className="nc-new-patient__clinicalTop">
                        <div className="nc-new-patient__clinicalDetails">
                          <WizardField
                            label={t("patient.wizard.clinical_record_number")}
                            htmlFor="field-new-patient-record"
                            error={errors.externalRecordNumber}
                            required
                          >
                            <IconInput icon={FolderOpen}>
                              <Input
                                id="field-new-patient-record"
                                placeholder={t(
                                  "patient.wizard.clinical_record_number_placeholder",
                                )}
                                {...register("externalRecordNumber")}
                              />
                            </IconInput>
                          </WizardField>

                          <div className="nc-new-patient__responsibleField">
                            <Label>
                              {t("patient.wizard.record_responsible")}
                            </Label>
                            {user ? (
                              <div className="nc-new-patient__responsibleCard">
                                <span className="nc-new-patient__responsibleAvatar">
                                  {responsibleInitials}
                                  <i aria-hidden="true" />
                                </span>
                                <span className="nc-new-patient__responsibleIdentity">
                                  <strong>{user.nombreCompleto}</strong>
                                  <small>{t(`auth.role_${user.rol}`)}</small>
                                </span>
                                <span className="nc-new-patient__responsibleAssignment">
                                  <b>
                                    <ShieldCheck aria-hidden="true" />
                                    {t("patient.wizard.assigned_automatically")}
                                  </b>
                                  <small>
                                    {t(
                                      "patient.wizard.assigned_automatically_description",
                                    )}
                                  </small>
                                </span>
                              </div>
                            ) : (
                              <p
                                className="nc-new-patient__responsibleError"
                                role="alert"
                              >
                                {t("patient.wizard.responsible_unavailable")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className="nc-new-patient__clinicalDivider"
                          aria-hidden="true"
                        />

                        <div className="nc-new-patient__photoField">
                          <Label>
                            {t("patient.wizard.patient_photo_optional")}
                          </Label>
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="nc-new-patient__photoInput"
                            onChange={(event) => {
                              void selectPatientPhoto(event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                          {photoUrl ? (
                            <div className="nc-new-patient__photoPreview">
                              <img
                                src={photoUrl}
                                alt={t("patient.wizard.patient_photo_preview")}
                              />
                              <div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => photoInputRef.current?.click()}
                                >
                                  <CloudUpload aria-hidden="true" />
                                  {t("patient.wizard.replace_photo")}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => {
                                    setValue("photoUrl", "", {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                    setPhotoError(null);
                                  }}
                                >
                                  <Trash2 aria-hidden="true" />
                                  {t("common.delete")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="nc-new-patient__photoDropzone"
                              data-dragging={draggingPhoto || undefined}
                              onClick={() => photoInputRef.current?.click()}
                              onDragEnter={(event) => {
                                event.preventDefault();
                                setDraggingPhoto(true);
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDragLeave={() => setDraggingPhoto(false)}
                              onDrop={(event) => {
                                event.preventDefault();
                                setDraggingPhoto(false);
                                void selectPatientPhoto(
                                  event.dataTransfer.files[0],
                                );
                              }}
                            >
                              <CloudUpload aria-hidden="true" />
                              <strong>
                                {t("patient.wizard.photo_drop_title")}
                              </strong>
                              <span>
                                {t("patient.wizard.photo_drop_action")}
                              </span>
                              <small>
                                {t("patient.wizard.photo_requirements")}
                              </small>
                            </button>
                          )}
                          {photoError && <p role="alert">{photoError}</p>}
                        </div>
                      </div>

                      <WizardField
                        label={t("patient.wizard.admission_reason")}
                        htmlFor="field-new-patient-admission-reason"
                        error={errors.admissionReason}
                        className="nc-new-patient__field--full"
                        required
                      >
                        <Textarea
                          id="field-new-patient-admission-reason"
                          rows={3}
                          placeholder={t(
                            "patient.wizard.admission_reason_placeholder",
                          )}
                          {...register("admissionReason")}
                        />
                      </WizardField>
                    </>
                  )}

                  {step === 4 && (
                    <>
                      <WizardField
                        label={t("patient.clinical_tags")}
                        htmlFor="field-new-patient-tags"
                        error={errors.clinicalTags}
                        className="nc-new-patient__field--full"
                      >
                        <IconInput icon={Tags}>
                          <Input
                            id="field-new-patient-tags"
                            placeholder={t("patient.clinical_tags_placeholder")}
                            {...register("clinicalTags")}
                          />
                        </IconInput>
                        <small className="nc-new-patient__fieldHint">
                          {t("patient.comma_separated")}
                        </small>
                      </WizardField>
                      <WizardField
                        label={t("patient.general_notes")}
                        htmlFor="field-new-patient-notes"
                        error={errors.generalNotes}
                        className="nc-new-patient__field--full"
                      >
                        <Textarea
                          id="field-new-patient-notes"
                          rows={7}
                          placeholder={t("patient.wizard.notes_placeholder")}
                          {...register("generalNotes")}
                        />
                      </WizardField>
                    </>
                  )}
                </div>

                {step === 0 && (
                  <div className="nc-new-patient__requiredCallout">
                    <Info aria-hidden="true" />
                    <span>
                      {t("patient.wizard.required_prefix")} <b>*</b>{" "}
                      {t("patient.wizard.required_suffix")}
                    </span>
                  </div>
                )}

                {step === 1 && showContactNotice && (
                  <div className="nc-new-patient__contactNotice" role="note">
                    <span
                      className="nc-new-patient__contactNoticeIcon"
                      aria-hidden="true"
                    >
                      <Info />
                    </span>
                    <div>
                      <strong>
                        {t("patient.wizard.contact_notice_title")}
                      </strong>
                      <p>{t("patient.wizard.contact_notice_description")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowContactNotice(false)}
                      aria-label={t("common.close")}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div
                    className="nc-new-patient__contactNotice nc-new-patient__contactNotice--emergency"
                    role="note"
                  >
                    <span
                      className="nc-new-patient__contactNoticeIcon"
                      aria-hidden="true"
                    >
                      <Info />
                    </span>
                    <div>
                      <strong>
                        {t("patient.wizard.emergency_notice_title")}
                      </strong>
                      <p>{t("patient.wizard.emergency_notice_description")}</p>
                    </div>
                  </div>
                )}

                {step === 3 && showClinicalNotice && (
                  <div className="nc-new-patient__contactNotice" role="note">
                    <span
                      className="nc-new-patient__contactNoticeIcon"
                      aria-hidden="true"
                    >
                      <Info />
                    </span>
                    <div>
                      <strong>
                        {t("patient.wizard.clinical_notice_title")}
                      </strong>
                      <p>{t("patient.wizard.clinical_notice_description")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowClinicalNotice(false)}
                      aria-label={t("common.close")}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                )}

                <footer className="nc-new-patient__navigationCard">
                  <div className="nc-new-patient__progressBlock">
                    <strong>
                      {t("patient.wizard.step_count", {
                        current: step + 1,
                        total: steps.length,
                      })}
                    </strong>
                    <div
                      className="nc-new-patient__progressTrack"
                      role="progressbar"
                      aria-valuemin={1}
                      aria-valuemax={steps.length}
                      aria-valuenow={step + 1}
                    >
                      <span
                        style={{
                          width: `${((step + 1) / steps.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="nc-new-patient__navigationActions">
                    {step > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep((current) => current - 1)}
                        disabled={submitting}
                      >
                        <ArrowLeft aria-hidden="true" />
                        {t("common.previous")}
                      </Button>
                    )}
                    <Button
                      type="submit"
                      className="nc-new-patient__primaryButton"
                      disabled={submitting}
                    >
                      {isLastStep
                        ? submitting
                          ? t("common.saving")
                          : t("patient.wizard.create_action")
                        : t("common.next")}
                      {isLastStep ? (
                        <Save aria-hidden="true" />
                      ) : (
                        <ArrowRight aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </footer>
              </section>
            </form>
          </main>
        </div>

        <ConfirmDialog
          open={navigationBlocker.state === "blocked"}
          onOpenChange={(open) => {
            if (!open && navigationBlocker.state === "blocked")
              navigationBlocker.reset();
          }}
          title={t("patient.wizard.cancel_title")}
          description={t("patient.wizard.cancel_description")}
          confirmLabel={t("patient.wizard.cancel_confirm")}
          cancelLabel={t("patient.wizard.continue_editing")}
          tone="warning"
          onConfirm={() => {
            if (navigationBlocker.state === "blocked")
              navigationBlocker.proceed();
          }}
        />
      </PageContent>
    </>
  );
}

function PatientIllustration() {
  return (
    <div className="nc-new-patient__illustration" aria-hidden="true">
      <span className="nc-new-patient__illustrationDots" />
      <span className="nc-new-patient__illustrationShape" />
    </div>
  );
}

function WizardField({
  label,
  htmlFor,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className={`nc-new-patient__field ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <b aria-hidden="true">*</b>}
      </Label>
      {children}
      {error?.message && (
        <p id={errorId} role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

function IconInput({
  icon: Icon,
  alignTop = false,
  children,
}: {
  icon: LucideIcon;
  alignTop?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="nc-new-patient__iconInput"
      data-align-top={alignTop || undefined}
    >
      <Icon aria-hidden="true" />
      {children}
    </div>
  );
}

function optionalContact(schema: z.ZodTypeAny, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => !value || schema.safeParse(value).success, message);
}

function requiredContact(schema: z.ZodTypeAny, message: string) {
  return z
    .string()
    .trim()
    .min(1, "Requerido")
    .refine((value) => schema.safeParse(value).success, message);
}

const MAX_PATIENT_PHOTO_BYTES = 5 * 1024 * 1024;
const PATIENT_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error());
    reader.onerror = () => reject(reader.error ?? new Error());
    reader.readAsDataURL(file);
  });
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function optionalString(value?: string): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function parseTags(value?: string): string[] {
  return value
    ? value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
}

function birthDateFromAge(age: number, today: Date = new Date()): Date {
  return new Date(
    today.getFullYear() - age,
    today.getMonth(),
    today.getDate(),
    12,
  );
}

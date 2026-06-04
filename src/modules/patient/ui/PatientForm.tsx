import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Save, X, User, Mail, Phone, Calendar, FileText, Heart, Tags } from "lucide-react";
import { toast } from "sonner";
import {
  PatientFormSchema,
  patientFormDefaultValues,
  type PatientFormValues,
} from "@modules/patient/application/patientFormSchema";
import { SexLabel, type Sex } from "@modules/patient/domain/Sex";
import { GenderLabel, type Gender } from "@modules/patient/domain/Gender";
import { MaritalStatusLabel, type MaritalStatus } from "@modules/patient/domain/MaritalStatus";
import { EducationLevelLabel, type EducationLevel } from "@modules/patient/domain/EducationLevel";
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

interface PatientFormProps {
  mode: "create" | "edit";
  patientId?: PatientId;
  initialPatient?: Patient;
}

const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function PatientForm({ mode, patientId, initialPatient }: PatientFormProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<PatientFormValues>({
    resolver: zodResolver(PatientFormSchema),
    defaultValues: patientFormDefaultValues,
  });

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
        emergencyContactRelationship: initialPatient.emergencyContactRelationship ?? "",
        emergencyContactPhone: initialPatient.emergencyContactPhone?.toString() ?? "",
        generalNotes: initialPatient.generalNotes ?? "",
        clinicalTags: initialPatient.clinicalTags.join(", "),
      });
    }
  }, [initialPatient, reset]);

  const onSubmit = async (values: PatientFormValues) => {
    setSubmitting(true);
    try {
      const parseStr = (v: string | undefined): string | null =>
        v && v.trim() ? v.trim() : null;
      const parseTags = (v: string | undefined): string[] =>
        v ? v.split(",").map((t) => t.trim()).filter(Boolean) : [];

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
        secondaryPhone: values.secondaryPhone ? PhoneVO.from(values.secondaryPhone) : null,
        emergencyContactName: parseStr(values.emergencyContactName),
        emergencyContactRelationship: parseStr(values.emergencyContactRelationship),
        emergencyContactPhone: values.emergencyContactPhone ? PhoneVO.from(values.emergencyContactPhone) : null,
        generalNotes: parseStr(values.generalNotes),
        clinicalTags: parseTags(values.clinicalTags),
      };

      if (mode === "create") {
        const created = await patientService.create.execute(payload);
        toast.success("Paciente creado", { description: created.fullName });
        navigate(`/pacientes/${created.id.toString()}`);
      } else if (patientId) {
        const updated = await patientService.update.execute(patientId, payload);
        toast.success("Paciente actualizado", { description: updated.fullName });
        navigate(`/pacientes/${updated.id.toString()}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(mode === "create" ? "No se pudo crear el paciente" : "No se pudo actualizar", {
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Datos personales
          </CardTitle>
          <CardDescription>Información básica de identificación del paciente</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre(s)" error={errors.firstName?.message} required>
            <Input {...register("firstName")} placeholder="María Fernanda" autoComplete="given-name" aria-invalid={!!errors.firstName} />
          </FormField>
          <FormField label="Apellido paterno" error={errors.lastName?.message} required>
            <Input {...register("lastName")} placeholder="García" autoComplete="family-name" aria-invalid={!!errors.lastName} />
          </FormField>
          <FormField label="Apellido materno" error={errors.secondLastName?.message}>
            <Input {...register("secondLastName")} placeholder="López" />
          </FormField>
          <FormField label="Fecha de nacimiento" error={errors.birthDate?.message} required>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="date" {...register("birthDate")} className="pl-9" aria-invalid={!!errors.birthDate} />
            </div>
          </FormField>
          <FormField label="Sexo biológico" error={errors.sex?.message} required>
            <select {...register("sex")} className={selectClass} aria-invalid={!!errors.sex}>
              {(Object.keys(SexLabel) as Sex[]).map((s) => (
                <option key={s} value={s}>{SexLabel[s]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Género autodeclarado" error={errors.gender?.message}>
            <select {...register("gender")} className={selectClass}>
              <option value="">Seleccionar…</option>
              {(Object.keys(GenderLabel) as Gender[]).map((g) => (
                <option key={g} value={g}>{GenderLabel[g]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Estado civil" error={errors.maritalStatus?.message}>
            <select {...register("maritalStatus")} className={selectClass}>
              <option value="">Seleccionar…</option>
              {(Object.keys(MaritalStatusLabel) as MaritalStatus[]).map((s) => (
                <option key={s} value={s}>{MaritalStatusLabel[s]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Escolaridad" error={errors.education?.message}>
            <select {...register("education")} className={selectClass}>
              <option value="">Seleccionar…</option>
              {(Object.keys(EducationLevelLabel) as EducationLevel[]).map((e) => (
                <option key={e} value={e}>{EducationLevelLabel[e]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Ocupación" error={errors.occupation?.message} className="sm:col-span-2">
            <Input {...register("occupation")} placeholder="Ej. Ingeniero, ama de casa, estudiante" />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacto</CardTitle>
          <CardDescription>Al menos un dato de contacto facilita el seguimiento</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Correo electrónico" error={errors.email?.message}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="email" {...register("email")} placeholder="paciente@correo.com" autoComplete="email" className="pl-9" aria-invalid={!!errors.email} />
            </div>
          </FormField>
          <FormField label="Teléfono principal" error={errors.phone?.message}>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="tel" {...register("phone")} placeholder="+52 55 1234 5678" autoComplete="tel" className="pl-9" aria-invalid={!!errors.phone} />
            </div>
          </FormField>
          <FormField label="Teléfono secundario" error={errors.secondaryPhone?.message}>
            <Input type="tel" {...register("secondaryPhone")} placeholder="+52 55 8765 4321" />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            Contacto de emergencia
          </CardTitle>
          <CardDescription>Persona a contactar en caso de emergencia</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField label="Nombre completo" error={errors.emergencyContactName?.message}>
            <Input {...register("emergencyContactName")} placeholder="Juan Pérez" />
          </FormField>
          <FormField label="Parentesco" error={errors.emergencyContactRelationship?.message}>
            <Input {...register("emergencyContactRelationship")} placeholder="Cónyuge, hijo/a, madre…" />
          </FormField>
          <FormField label="Teléfono" error={errors.emergencyContactPhone?.message}>
            <Input type="tel" {...register("emergencyContactPhone")} placeholder="+52 55 1234 5678" />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notas y etiquetas
          </CardTitle>
          <CardDescription>Observaciones generales y etiquetas clínicas</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField label="Notas generales" error={errors.generalNotes?.message}>
            <Textarea
              {...register("generalNotes")}
              placeholder="Observaciones generales del paciente…"
              rows={3}
              aria-invalid={!!errors.generalNotes}
            />
          </FormField>
          <FormField label="Etiquetas clínicas" error={errors.clinicalTags?.message}>
            <div className="relative">
              <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                {...register("clinicalTags")}
                placeholder="diabético, embarazo, vegetariano"
                className="pl-9"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Separadas por coma</p>
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={submitting}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || (mode === "edit" && !isDirty)}>
          <Save className="mr-2 h-4 w-4" />
          {submitting ? "Guardando…" : mode === "create" ? "Crear paciente" : "Guardar cambios"}
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
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
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

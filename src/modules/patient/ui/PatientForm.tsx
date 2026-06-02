import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Save, X, User, Mail, Phone, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  PatientFormSchema,
  patientFormDefaultValues,
  type PatientFormValues,
} from "@modules/patient/application/patientFormSchema";
import { SexLabel, type Sex } from "@modules/patient/domain/Sex";
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
        birthDate: toDateInputValue(initialPatient.birthDate),
        sex: initialPatient.sex,
        email: initialPatient.email?.toString() ?? "",
        phone: initialPatient.phone?.toString() ?? "",
        notes: "",
      });
    }
  }, [initialPatient, reset]);

  const onSubmit = async (values: PatientFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        birthDate: new Date(values.birthDate),
        sex: values.sex as Sex,
        email: values.email ? Email.from(values.email) : null,
        phone: values.phone ? PhoneVO.from(values.phone) : null,
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
          <CardDescription>
            Información básica de identificación del paciente
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre(s)" error={errors.firstName?.message} required>
            <Input
              {...register("firstName")}
              placeholder="María Fernanda"
              autoComplete="given-name"
              aria-invalid={!!errors.firstName}
            />
          </FormField>
          <FormField label="Apellidos" error={errors.lastName?.message} required>
            <Input
              {...register("lastName")}
              placeholder="García López"
              autoComplete="family-name"
              aria-invalid={!!errors.lastName}
            />
          </FormField>
          <FormField label="Fecha de nacimiento" error={errors.birthDate?.message} required>
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="date"
                {...register("birthDate")}
                className="pl-9"
                aria-invalid={!!errors.birthDate}
              />
            </div>
          </FormField>
          <FormField label="Sexo biológico" error={errors.sex?.message} required>
            <select
              {...register("sex")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-invalid={!!errors.sex}
            >
              {(Object.keys(SexLabel) as Sex[]).map((s) => (
                <option key={s} value={s}>
                  {SexLabel[s]}
                </option>
              ))}
            </select>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacto</CardTitle>
          <CardDescription>Opcional — al menos un dato de contacto facilita el seguimiento</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Correo electrónico" error={errors.email?.message}>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="email"
                {...register("email")}
                placeholder="paciente@correo.com"
                autoComplete="email"
                className="pl-9"
                aria-invalid={!!errors.email}
              />
            </div>
          </FormField>
          <FormField label="Teléfono" error={errors.phone?.message}>
            <div className="relative">
              <Phone
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="tel"
                {...register("phone")}
                placeholder="+52 55 1234 5678"
                autoComplete="tel"
                className="pl-9"
                aria-invalid={!!errors.phone}
              />
            </div>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notas clínicas iniciales
          </CardTitle>
          <CardDescription>Información preliminar relevante (motivo de consulta, antecedentes)</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register("notes")}
            placeholder="Motivo de consulta, antecedentes relevantes, observaciones…"
            rows={4}
            aria-invalid={!!errors.notes}
          />
          {errors.notes?.message && (
            <p className="mt-1 text-xs text-destructive">{errors.notes.message}</p>
          )}
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
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || (mode === "edit" && !isDirty)}>
          <Save className="mr-2 h-4 w-4" />
          {submitting
            ? "Guardando…"
            : mode === "create"
              ? "Crear paciente"
              : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
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

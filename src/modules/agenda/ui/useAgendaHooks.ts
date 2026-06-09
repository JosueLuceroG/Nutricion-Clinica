import { useState, useEffect, useCallback } from "react";
import { agendaService } from "@services/agendaService";
import type { Appointment } from "../domain/Appointment";
import type { AppointmentId } from "../domain/AppointmentId";
import type { NewAppointmentFormInput, RescheduleAppointmentInput } from "../application/agendaFormSchema";

export function useAppointmentsByDate(date: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await agendaService.listByDate(date);
      setAppointments(result);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { appointments, loading, refresh };
}

export function useAppointmentsByRange(startDate: string, endDate: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await agendaService.listByRange(startDate, endDate);
      setAppointments(result);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { appointments, loading, refresh };
}

export function useCreateAppointment() {
  const [loading, setLoading] = useState(false);

  const create = async (input: NewAppointmentFormInput, professionalId?: string) => {
    setLoading(true);
    try {
      return await agendaService.create(input, professionalId);
    } finally {
      setLoading(false);
    }
  };

  return { create, loading };
}

export function useCancelAppointment() {
  const cancel = async (id: AppointmentId, reason: string) => {
    return agendaService.cancel(id, reason);
  };
  return { cancel };
}

export function useRescheduleAppointment() {
  const reschedule = async (id: AppointmentId, input: RescheduleAppointmentInput) => {
    return agendaService.reschedule(id, input);
  };
  return { reschedule };
}

export function useMarkNoShow() {
  const markNoShow = async (id: AppointmentId) => {
    return agendaService.markNoShow(id);
  };
  return { markNoShow };
}

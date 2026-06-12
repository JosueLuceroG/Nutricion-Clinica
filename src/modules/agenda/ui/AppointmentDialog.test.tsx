import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppointmentDialog } from "./AppointmentDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "agenda.select_slot") return `Seleccionar ${params?.start}-${params?.end}`;
      if (key === "agenda.slot_unavailable") return `Ocupado ${params?.start}-${params?.end}`;
      if (key === "agenda.slot_duration") return `${params?.minutes} min`;
      return key;
    },
  }),
}));

const patients = [{ id: "018f0000-0000-7000-8000-000000000001", name: "Ana Perez" }];

describe("AppointmentDialog", () => {
  it("selecciona un horario disponible y actualiza inicio/fin", async () => {
    const loadAvailableSlots = vi.fn().mockResolvedValue([
      { startTime: "09:00", endTime: "09:30", available: false },
      { startTime: "09:30", endTime: "10:00", available: true },
    ]);

    render(
      <AppointmentDialog
        open
        onOpenChange={vi.fn()}
        selectedDate="2026-06-08"
        patients={patients}
        loadAvailableSlots={loadAvailableSlots}
        onSubmit={vi.fn()}
      />,
    );

    const busySlot = (await screen.findByText("09:00 - 09:30")).closest("button");
    const availableSlot = screen.getByText("09:30 - 10:00").closest("button");

    expect(loadAvailableSlots).toHaveBeenCalledWith("2026-06-08", 30);
    expect(busySlot).toBeDisabled();
    expect(availableSlot).not.toBeDisabled();

    fireEvent.click(availableSlot!);

    expect(screen.getByLabelText("agenda.start_time")).toHaveValue("09:30");
    expect(screen.getByLabelText("agenda.end_time")).toHaveValue("10:00");
  });

  it("mantiene captura manual cuando no hay horario configurado", async () => {
    render(
      <AppointmentDialog
        open
        onOpenChange={vi.fn()}
        selectedDate="2026-06-08"
        patients={patients}
        loadAvailableSlots={vi.fn().mockResolvedValue([])}
        onSubmit={vi.fn()}
      />,
    );

    expect(await screen.findByText("agenda.no_slots_configured")).toBeInTheDocument();
    expect(screen.getByLabelText("agenda.start_time")).toHaveValue("09:00");
    expect(screen.getByLabelText("agenda.end_time")).toHaveValue("09:30");
  });
});

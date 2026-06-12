import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AvailabilityDialog } from "./AvailabilityDialog";

const mocks = vi.hoisted(() => ({
  listSchedules: vi.fn(),
  saveSchedule: vi.fn(),
  removeSchedule: vi.fn(),
  listBlocks: vi.fn(),
  createBlock: vi.fn(),
  removeBlock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  t: (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      "common.error_occurred": "Error",
      "common.saving": "Saving...",
      "agenda.availability_title": "Availability",
      "agenda.availability_description": "Configure schedules and blocks",
      "agenda.weekly_schedule": "Weekly schedule",
      "agenda.save_schedule": "Save schedule",
      "agenda.availability_saved": "Availability saved",
      "agenda.available": "Available",
      "agenda.inactive": "Inactive",
      "agenda.day_monday": "Monday",
      "agenda.day_tuesday": "Tuesday",
      "agenda.day_wednesday": "Wednesday",
      "agenda.day_thursday": "Thursday",
      "agenda.day_friday": "Friday",
      "agenda.day_saturday": "Saturday",
      "agenda.day_sunday": "Sunday",
      "agenda.blocks": "Blocks",
      "agenda.block_start_date": "Start date",
      "agenda.block_end_date": "End date",
      "agenda.block_all_day": "All day",
      "agenda.block_reason": "Block reason",
      "agenda.block_reason_placeholder": "Reason",
      "agenda.add_block": "Add block",
      "agenda.block_created": "Block created",
      "agenda.block_deleted": "Block deleted",
      "agenda.no_blocks": "No blocks",
      "agenda.block_without_reason": "No reason",
      "agenda.delete_block": "Delete block",
      "agenda.start_time": "Start time",
      "agenda.end_time": "End time",
    };
    if (key === "agenda.schedule_start_for") return `Start for ${params?.day}`;
    if (key === "agenda.schedule_end_for") return `End for ${params?.day}`;
    return translations[key] ?? key;
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("./useAgendaHooks", () => ({
  useProfessionalSchedules: () => ({
    list: mocks.listSchedules,
    save: mocks.saveSchedule,
    remove: mocks.removeSchedule,
    loading: false,
  }),
  useProfessionalBlocks: () => ({
    list: mocks.listBlocks,
    create: mocks.createBlock,
    remove: mocks.removeBlock,
    loading: false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: mocks.t,
  }),
}));

const renderDialog = (onChanged = vi.fn()) => render(
  <AvailabilityDialog
    open
    onOpenChange={vi.fn()}
    blockStartDate="2026-06-01"
    blockEndDate="2026-06-30"
    initialBlockDate="2026-06-08"
    onChanged={onChanged}
  />,
);

describe("AvailabilityDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listSchedules.mockResolvedValue([]);
    mocks.saveSchedule.mockResolvedValue({});
    mocks.removeSchedule.mockResolvedValue(undefined);
    mocks.listBlocks.mockResolvedValue([]);
    mocks.createBlock.mockResolvedValue({});
    mocks.removeBlock.mockResolvedValue(undefined);
  });

  it("loads schedules and saves weekly availability", async () => {
    mocks.listSchedules.mockResolvedValue([
      { id: "schedule-1", dayOfWeek: 1, startTime: "08:00", endTime: "12:00", active: true },
    ]);
    mocks.listBlocks.mockResolvedValue([
      { id: "block-1", startDate: "2026-06-08", endDate: "2026-06-08", allDay: true, reason: "Vacaciones" },
    ]);
    const onChanged = vi.fn();

    renderDialog(onChanged);

    expect(await screen.findByText("Vacaciones")).toBeInTheDocument();
    expect(screen.getByLabelText("Monday")).toBeChecked();

    fireEvent.click(screen.getByLabelText("Tuesday"));
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));

    await waitFor(() => {
      expect(mocks.saveSchedule).toHaveBeenCalledWith({ dayOfWeek: 1, startTime: "08:00", endTime: "12:00", active: true });
      expect(mocks.saveSchedule).toHaveBeenCalledWith({ dayOfWeek: 2, startTime: "09:00", endTime: "17:00", active: true });
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it("creates an all-day block from the selected date", async () => {
    renderDialog();

    await screen.findByText("No blocks");
    fireEvent.change(screen.getByLabelText("Block reason"), { target: { value: "Congreso" } });
    fireEvent.click(screen.getByRole("button", { name: "Add block" }));

    await waitFor(() => {
      expect(mocks.createBlock).toHaveBeenCalledWith({
        startDate: "2026-06-08",
        endDate: "2026-06-08",
        allDay: true,
        startTime: "09:00",
        endTime: "10:00",
        reason: "Congreso",
      });
    });
  });
});

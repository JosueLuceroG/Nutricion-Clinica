import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PATIENT_RECORD_NUMBER_CONFIG,
  formatPatientRecordNumber,
} from "../application/patientRecordNumber";
import { usePreferencesStore } from "@store/preferencesStore";
import { PatientRecordNumberSettingsCard } from "./PatientRecordNumberSettingsCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("PatientRecordNumberSettingsCard", () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      patientRecordNumberConfig: null,
      patientRecordNumberNextSequence: 1,
    });
  });

  it("shows the default preview and persists the default option", () => {
    render(
      <MemoryRouter>
        <PatientRecordNumberSettingsCard />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        formatPatientRecordNumber(DEFAULT_PATIENT_RECORD_NUMBER_CONFIG, {
          firstName: "Ana",
          lastName: "Rivera",
          sequence: 1,
        }),
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.patient_record_number_default_option settings.patient_record_number_default_option_help",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.patient_record_number_save",
      }),
    );

    expect(usePreferencesStore.getState().patientRecordNumberConfig).toEqual(
      DEFAULT_PATIENT_RECORD_NUMBER_CONFIG,
    );
    expect(
      screen.getByText("settings.patient_record_number_saved"),
    ).toBeInTheDocument();
  });

  it("starts custom mode empty and supports a number-only format", () => {
    render(
      <MemoryRouter>
        <PatientRecordNumberSettingsCard />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.patient_record_number_custom_option settings.patient_record_number_custom_option_help",
      }),
    );
    expect(
      screen.getByText("settings.patient_record_number_canvas_empty"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "settings.patient_record_number_save",
      }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.patient_record_number_block_sequence",
      }),
    );
    expect(screen.getByText("01")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.patient_record_number_save",
      }),
    );

    expect(
      usePreferencesStore.getState().patientRecordNumberConfig?.segments,
    ).toEqual([expect.objectContaining({ type: "sequence", digits: 2 })]);
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_PATIENT_RECORD_NUMBER_CONFIG,
  formatPatientRecordNumber,
} from "./patientRecordNumber";

describe("patient record number", () => {
  it("generates the requested default format", () => {
    expect(
      formatPatientRecordNumber(DEFAULT_PATIENT_RECORD_NUMBER_CONFIG, {
        firstName: "Ana",
        lastName: "Rivera",
        sequence: 1,
        date: new Date(2026, 6, 28),
      }),
    ).toBe("EXP-07-ANR2601");
  });

  it("supports a custom separator, character counts, year and casing", () => {
    expect(
      formatPatientRecordNumber(
        {
          uppercase: false,
          segments: [
            { id: "text", type: "text", value: "paciente" },
            { id: "first", type: "firstName", length: 3 },
            { id: "last", type: "lastName", length: 2 },
            { id: "year", type: "year", digits: 4 },
            { id: "sequence", type: "sequence", digits: 3 },
          ],
        },
        {
          firstName: "Ángela",
          lastName: "Núñez",
          sequence: 10,
          date: new Date(2026, 6, 28),
        },
      ),
    ).toBe("pacienteangnu2026010");
  });

  it("allows a format made only of the consecutive number", () => {
    expect(
      formatPatientRecordNumber(
        {
          uppercase: true,
          segments: [{ id: "sequence", type: "sequence", digits: 2 }],
        },
        {
          firstName: "Ana",
          lastName: "Rivera",
          sequence: 3,
          date: new Date(2026, 6, 28),
        },
      ),
    ).toBe("03");
  });

  it("keeps previously saved fixed-field configurations working", () => {
    expect(
      formatPatientRecordNumber(
        {
          prefix: "EXP",
          separator: "-",
          includeMonth: true,
          firstNameLetters: 2,
          lastNameLetters: 1,
          yearDigits: 2,
          sequenceDigits: 2,
          uppercase: true,
        },
        {
          firstName: "Ana",
          lastName: "Rivera",
          sequence: 1,
          date: new Date(2026, 6, 28),
        },
      ),
    ).toBe("EXP-07-ANR2601");
  });

  it("uses zero padding only until the sequence exceeds its minimum width", () => {
    const create = (sequence: number) =>
      formatPatientRecordNumber(DEFAULT_PATIENT_RECORD_NUMBER_CONFIG, {
        firstName: "Ana",
        lastName: "Rivera",
        sequence,
        date: new Date(2026, 6, 28),
      });

    expect(create(2)).toMatch(/2602$/);
    expect(create(10)).toMatch(/2610$/);
    expect(create(100)).toMatch(/26100$/);
  });
});

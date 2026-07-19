const MAX_PATIENT_PHOTO_BYTES = 5 * 1024 * 1024;
const PATIENT_PHOTO_DATA_URL =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function validatePatientPhotoValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string")
    throw new Error("La imagen del paciente debe ser texto");
  if (/^https?:\/\//i.test(value) && value.length <= 2048) return value;

  const match = PATIENT_PHOTO_DATA_URL.exec(value);
  if (!match) throw new Error("La imagen debe ser JPG, PNG o WebP");
  const base64 = match[2]!;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((base64.length * 3) / 4) - padding;
  if (decodedBytes > MAX_PATIENT_PHOTO_BYTES) {
    throw new Error("La imagen no puede superar 5 MB");
  }
  return value;
}

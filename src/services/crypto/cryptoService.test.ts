import { describe, it, expect } from "vitest";
import { cryptoService, type EncryptedPayload } from "./cryptoService";

describe("cryptoService", () => {
  const password = "test-password-123!";

  describe("encrypt / decrypt", () => {
    it("encrypts and decrypts a string", async () => {
      const original = "Hello, NutriClinica!";
      const encrypted = await cryptoService.encrypt(original, password);
      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.salt).toBeTruthy();
      expect(encrypted.ciphertext).not.toBe(original);

      const decrypted = await cryptoService.decrypt(encrypted, password);
      expect(decrypted).toBe(original);
    });

    it("produces different ciphertext each time (random iv/salt)", async () => {
      const original = "same data";
      const a = await cryptoService.encrypt(original, password);
      const b = await cryptoService.encrypt(original, password);
      expect(a.ciphertext).not.toBe(b.ciphertext);
      expect(a.iv).not.toBe(b.iv);
    });

    it("throws on wrong password", async () => {
      const original = "secret";
      const encrypted = await cryptoService.encrypt(original, password);
      await expect(cryptoService.decrypt(encrypted, "wrong-password")).rejects.toThrow();
    });

    it("roundtrips JSON helpers", async () => {
      const original = '{"patients":[{"id":"1"}]}';
      const json = await cryptoService.encryptToJson(original, password);
      expect(typeof json).toBe("string");
      const parsed: EncryptedPayload = JSON.parse(json);
      expect(parsed.ciphertext).toBeTruthy();
      expect(parsed.salt).toBeTruthy();

      const decrypted = await cryptoService.decryptFromJson(json, password);
      expect(decrypted).toBe(original);
    });

    it("handles empty string", async () => {
      const encrypted = await cryptoService.encrypt("", password);
      const decrypted = await cryptoService.decrypt(encrypted, password);
      expect(decrypted).toBe("");
    });

    it("handles large payload", async () => {
      const original = "x".repeat(100_000);
      const encrypted = await cryptoService.encrypt(original, password);
      const decrypted = await cryptoService.decrypt(encrypted, password);
      expect(decrypted).toBe(original);
    });
  });
});

-- ============================================================
-- Migration 015: Campos cifrados AES-256 (NOM-024)
-- ============================================================

ALTER TABLE pacientes
  ADD identificacion_oficial_encrypted NVARCHAR(MAX) NULL;

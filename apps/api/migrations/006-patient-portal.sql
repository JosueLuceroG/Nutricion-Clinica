-- =====================================================================
-- 006-patient-portal.sql
-- Tokens publicos de solo lectura para el portal del paciente.
-- Se almacena solo SHA-256 del token; el token claro vive en el enlace.
-- =====================================================================

CREATE TABLE patient_portal_tokens (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  token_hash NVARCHAR(64) NOT NULL,
  label NVARCHAR(120) NULL,
  scopes_json NVARCHAR(MAX) NOT NULL DEFAULT N'["summary","plan","appointments","documents"]',
  expires_at DATETIME2(3) NOT NULL,
  revoked_at DATETIME2(3) NULL,
  last_accessed_at DATETIME2(3) NULL,
  created_by_profesional_id UNIQUEIDENTIFIER NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (created_by_profesional_id) REFERENCES profesionales(id)
);
CREATE UNIQUE INDEX uq_patient_portal_tokens_hash_active
  ON patient_portal_tokens(token_hash)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_patient_portal_tokens_patient
  ON patient_portal_tokens(sucursal_id, paciente_id, expires_at DESC)
  WHERE revoked_at IS NULL;

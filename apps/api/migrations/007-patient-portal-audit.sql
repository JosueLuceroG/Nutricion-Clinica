-- =====================================================================
-- 007-patient-portal-audit.sql
-- Bitacora detallada para enlaces y accesos del portal del paciente.
-- Complementa audit_log con historial consultable por paciente/token.
-- =====================================================================

CREATE TABLE patient_portal_audit_events (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  token_id UNIQUEIDENTIFIER NOT NULL,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  profesional_id UNIQUEIDENTIFIER NULL,
  event_type NVARCHAR(40) NOT NULL CHECK (event_type IN ('created','revoked','accessed')),
  ip_address NVARCHAR(45) NULL,
  user_agent NVARCHAR(500) NULL,
  details_json NVARCHAR(MAX) NULL,
  occurred_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (token_id) REFERENCES patient_portal_tokens(id),
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
);
CREATE INDEX idx_patient_portal_audit_patient
  ON patient_portal_audit_events(sucursal_id, paciente_id, occurred_at DESC);
CREATE INDEX idx_patient_portal_audit_token
  ON patient_portal_audit_events(token_id, occurred_at DESC);

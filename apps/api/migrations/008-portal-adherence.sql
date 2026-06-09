-- =====================================================================
-- 008-portal-adherence.sql
-- Sprint 25D: registros de adherencia enviados desde el portal publico.
-- =====================================================================

CREATE TABLE adherence_records (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  consulta_id UNIQUEIDENTIFIER NULL,
  source NVARCHAR(20) NOT NULL DEFAULT 'portal' CHECK (source IN ('consulta','portal','app','llamada')),
  record_date DATE NOT NULL,
  adherence_menu DECIMAL(5,2) NOT NULL CHECK (adherence_menu >= 0 AND adherence_menu <= 100),
  adherence_water DECIMAL(5,2) NOT NULL CHECK (adherence_water >= 0 AND adherence_water <= 100),
  adherence_activity DECIMAL(5,2) NOT NULL CHECK (adherence_activity >= 0 AND adherence_activity <= 100),
  adherence_supplements DECIMAL(5,2) NOT NULL CHECK (adherence_supplements >= 0 AND adherence_supplements <= 100),
  adherence_sleep DECIMAL(5,2) NOT NULL CHECK (adherence_sleep >= 0 AND adherence_sleep <= 100),
  hunger_avg DECIMAL(4,1) NULL CHECK (hunger_avg IS NULL OR (hunger_avg >= 1 AND hunger_avg <= 10)),
  satiety_avg DECIMAL(4,1) NULL CHECK (satiety_avg IS NULL OR (satiety_avg >= 1 AND satiety_avg <= 10)),
  mood_avg DECIMAL(4,1) NULL CHECK (mood_avg IS NULL OR (mood_avg >= 1 AND mood_avg <= 10)),
  energy_avg DECIMAL(4,1) NULL CHECK (energy_avg IS NULL OR (energy_avg >= 1 AND energy_avg <= 10)),
  intercurrent_events NVARCHAR(1000) NOT NULL DEFAULT '',
  barriers NVARCHAR(1000) NOT NULL DEFAULT '',
  facilitators NVARCHAR(1000) NOT NULL DEFAULT '',
  meals_logged NVARCHAR(2000) NOT NULL DEFAULT '',
  notes NVARCHAR(2000) NOT NULL DEFAULT '',
  submitted_by_token_id UNIQUEIDENTIFIER NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  FOREIGN KEY (submitted_by_token_id) REFERENCES patient_portal_tokens(id)
);

CREATE INDEX idx_adherence_records_patient
  ON adherence_records(sucursal_id, paciente_id, record_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_adherence_records_token
  ON adherence_records(submitted_by_token_id, created_at DESC)
  WHERE submitted_by_token_id IS NOT NULL;

DECLARE @dropPortalAuditEventTypeConstraint NVARCHAR(MAX)
SELECT @dropPortalAuditEventTypeConstraint = N'ALTER TABLE patient_portal_audit_events DROP CONSTRAINT [' + cc.name + N']'
  FROM sys.check_constraints cc
 WHERE cc.parent_object_id = OBJECT_ID('patient_portal_audit_events')
   AND cc.definition LIKE '%created%'
   AND cc.definition LIKE '%revoked%'
   AND cc.definition LIKE '%accessed%'
IF @dropPortalAuditEventTypeConstraint IS NOT NULL EXEC sp_executesql @dropPortalAuditEventTypeConstraint;

ALTER TABLE patient_portal_audit_events
  ADD CONSTRAINT CK_patient_portal_audit_events_event_type
  CHECK (event_type IN ('created','revoked','accessed','adherence_submitted'));

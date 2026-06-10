-- ============================================================
-- Migration 012: Patient meal photos via portal
-- Registro de comidas con foto, texto y adherencia 1-5.
-- También amplía constraints usados por Sprint 31.
-- ============================================================

CREATE TABLE patient_portal_meal_photos (
    id                         UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    token_id                   UNIQUEIDENTIFIER NOT NULL REFERENCES patient_portal_tokens(id),
    paciente_id                UNIQUEIDENTIFIER NOT NULL REFERENCES pacientes(id),
    sucursal_id                UNIQUEIDENTIFIER NOT NULL REFERENCES sucursales(id),
    meal_date                  DATE             NOT NULL,
    meal_slot                  NVARCHAR(50)     NOT NULL,
    caption                    NVARCHAR(1000)   NOT NULL DEFAULT '',
    adherence_rating           TINYINT          NOT NULL CHECK (adherence_rating BETWEEN 1 AND 5),
    mime_type                  NVARCHAR(80)     NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    file_name                  NVARCHAR(180)    NOT NULL,
    size_bytes                 INT              NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
    sha256                     NVARCHAR(64)     NOT NULL,
    photo_bytes                VARBINARY(MAX)   NOT NULL,
    reviewed_at                DATETIME2(3)     NULL,
    reviewed_by_profesional_id UNIQUEIDENTIFIER NULL REFERENCES profesionales(id),
    created_at                 DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at                 DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at                 DATETIME2(3)     NULL,
    row_version                ROWVERSION       NOT NULL
);

CREATE INDEX IX_patient_portal_meal_photos_patient
    ON patient_portal_meal_photos (sucursal_id, paciente_id, meal_date DESC, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IX_patient_portal_meal_photos_token
    ON patient_portal_meal_photos (token_id, created_at DESC)
    WHERE deleted_at IS NULL;

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
  CHECK (event_type IN (
    'created',
    'revoked',
    'accessed',
    'adherence_submitted',
    'document_downloaded',
    'message_sent',
    'meal_photo_submitted',
    'meal_photo_reviewed'
  ));

DECLARE @dropEmailTipoConstraint NVARCHAR(MAX)
SELECT @dropEmailTipoConstraint = N'ALTER TABLE notificaciones_email DROP CONSTRAINT [' + cc.name + N']'
  FROM sys.check_constraints cc
 WHERE cc.parent_object_id = OBJECT_ID('notificaciones_email')
   AND cc.definition LIKE '%appointment_reminder%'
   AND cc.definition LIKE '%adherence_confirmation%'
IF @dropEmailTipoConstraint IS NOT NULL EXEC sp_executesql @dropEmailTipoConstraint;

ALTER TABLE notificaciones_email
  ADD CONSTRAINT CK_notificaciones_email_tipo
  CHECK (tipo IN (
    'appointment_reminder',
    'adherence_confirmation',
    'portal_welcome',
    'plan_update',
    'patient_message'
  ));

-- 009: Notificaciones email para el portal del paciente
-- Crea tabla de trazabilidad de emails enviados desde el portal.
-- Depende de: 006-patient-portal.sql (tabla pacientes)

CREATE TABLE notificaciones_email (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  tipo NVARCHAR(40) NOT NULL CHECK (tipo IN (
    'appointment_reminder',
    'adherence_confirmation',
    'portal_welcome',
    'plan_update'
  )),
  destinatario NVARCHAR(200) NOT NULL,
  asunto NVARCHAR(200) NOT NULL,
  contenido_hash NVARCHAR(64) NOT NULL,
  message_id NVARCHAR(200) NULL,
  error NVARCHAR(500) NULL,
  enviado_en DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  leido_en DATETIME2(3) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);

CREATE INDEX idx_notificaciones_email_paciente ON notificaciones_email(paciente_id, enviado_en DESC);
CREATE INDEX idx_notificaciones_email_tipo ON notificaciones_email(tipo, enviado_en DESC);

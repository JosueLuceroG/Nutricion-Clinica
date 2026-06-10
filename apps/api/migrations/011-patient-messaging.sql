-- ============================================================
-- Migration 011: Patient messaging (async chat)
-- Mensajería asíncrona paciente-nutrióloga vía portal.
-- ============================================================

CREATE TABLE patient_portal_messages (
    id              UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    token_id        UNIQUEIDENTIFIER NOT NULL REFERENCES patient_portal_tokens(id),
    paciente_id     UNIQUEIDENTIFIER NOT NULL REFERENCES pacientes(id),
    sucursal_id     UNIQUEIDENTIFIER NOT NULL REFERENCES sucursales(id),
    profesional_id  UNIQUEIDENTIFIER NULL REFERENCES profesionales(id),
    content         NVARCHAR(2000)   NOT NULL,
    direction       NVARCHAR(30)     NOT NULL CHECK (direction IN ('patient_to_professional', 'professional_to_patient')),
    read_at         DATETIME2        NULL,
    created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_patient_portal_messages_paciente
    ON patient_portal_messages (paciente_id, sucursal_id, created_at DESC);

CREATE INDEX IX_patient_portal_messages_token
    ON patient_portal_messages (token_id, created_at DESC);

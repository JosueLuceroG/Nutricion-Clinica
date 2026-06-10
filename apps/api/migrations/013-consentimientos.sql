-- ============================================================
-- Migration 013: Consentimientos informados del paciente
-- Tabla de consentimientos para cumplimiento NOM-024.
-- ============================================================

CREATE TABLE consentimientos (
    id                         UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    paciente_id                UNIQUEIDENTIFIER NOT NULL REFERENCES pacientes(id),
    sucursal_id                UNIQUEIDENTIFIER NOT NULL REFERENCES sucursales(id),
    tipo                       NVARCHAR(60)     NOT NULL CHECK (tipo IN (
                                   'tratamiento', 'datos_personales', 'fotografia',
                                   'investigacion', 'comunicacion', 'terminos_servicio'
                               )),
    titulo                     NVARCHAR(200)    NOT NULL,
    contenido_html             NVARCHAR(MAX)    NOT NULL,
    version                    INT              NOT NULL DEFAULT 1,
    aceptado                   BIT              NOT NULL DEFAULT 0,
    fecha_aceptacion           DATETIME2(3)     NULL,
    ip_address                 NVARCHAR(45)     NULL,
    revocado                   BIT              NOT NULL DEFAULT 0,
    fecha_revocacion           DATETIME2(3)     NULL,
    created_at                 DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at                 DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at                 DATETIME2(3)     NULL,
    row_version                ROWVERSION       NOT NULL
);

CREATE INDEX IX_consentimientos_paciente
    ON consentimientos (sucursal_id, paciente_id, created_at DESC);

CREATE INDEX IX_consentimientos_tipo
    ON consentimientos (paciente_id, tipo, version DESC);

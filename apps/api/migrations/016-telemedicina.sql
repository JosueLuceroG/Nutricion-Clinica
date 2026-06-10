-- ============================================================
-- Migration 016: Telemedicina — videollamadas
-- ============================================================

CREATE TABLE video_salas (
    id             UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    paciente_id    UNIQUEIDENTIFIER NOT NULL REFERENCES pacientes(id),
    profesional_id UNIQUEIDENTIFIER NOT NULL REFERENCES profesionales(id),
    sucursal_id    UNIQUEIDENTIFIER NOT NULL REFERENCES sucursales(id),
    estado         NVARCHAR(20)     NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente','activa','finalizada','cancelada')),
    scheduled_at   DATETIME2(3)     NULL,
    iniciada_at    DATETIME2(3)     NULL,
    finalizada_at  DATETIME2(3)     NULL,
    notas          NVARCHAR(MAX)    NULL,
    created_at     DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at     DATETIME2(3)     NULL,
    row_version    ROWVERSION       NOT NULL
);

CREATE INDEX IX_video_salas_profesional
    ON video_salas (sucursal_id, profesional_id, created_at DESC);

CREATE INDEX IX_video_salas_paciente
    ON video_salas (paciente_id, created_at DESC);

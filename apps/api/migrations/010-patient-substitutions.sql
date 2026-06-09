-- ============================================================
-- Migration 010: Patient food substitutions / preferences
-- Almacena sustituciones de alimentos preferidas por paciente.
-- ============================================================

CREATE TABLE patient_substitutions (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    paciente_id     UNIQUEIDENTIFIER NOT NULL REFERENCES pacientes(id),
    -- alimento ORIGINAL que se quiere sustituir (puede ser NULL si es preferencia general)
    original_food_id NVARCHAR(100)  NULL,
    -- alimento SUGERIDO/SUSTITUTO
    substitute_food_id NVARCHAR(100) NOT NULL,
    meal_slot       NVARCHAR(50)    NULL,       -- opcional: limitar a un tiempo de comida
    created_at      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    is_active       BIT             NOT NULL DEFAULT 1
);

CREATE INDEX IX_patient_substitutions_paciente
    ON patient_substitutions (paciente_id)
    WHERE is_active = 1;

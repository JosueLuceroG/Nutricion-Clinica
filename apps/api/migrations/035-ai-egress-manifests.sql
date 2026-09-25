-- =====================================================================
-- 035 - AI Egress Manifests
--
-- Persiste los manifests de egress de IA: describe QUE tipo de
-- informacion fue autorizada/denegada para salir hacia un provider,
-- SIN copiar contenido clinico (prompt, notas, labs, PHI raw).
--
-- Idempotente: solo crea la tabla si no existe.
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_egress_manifests')
BEGIN
    CREATE TABLE ai_egress_manifests (
        id UNIQUEIDENTIFIER PRIMARY KEY,
        execution_id UNIQUEIDENTIFIER NOT NULL,
        user_id UNIQUEIDENTIFIER NULL,
        role NVARCHAR(60) NULL,
        sucursal_id UNIQUEIDENTIFIER NULL,
        patient_ref NVARCHAR(64) NULL,
        capability NVARCHAR(100) NOT NULL,
        purpose NVARCHAR(100) NOT NULL,
        provider NVARCHAR(60) NOT NULL,
        model NVARCHAR(120) NOT NULL,
        provider_location_type NVARCHAR(20) NOT NULL,
        data_categories NVARCHAR(MAX) NOT NULL,
        field_groups NVARCHAR(MAX) NULL,
        redaction_applied BIT NOT NULL DEFAULT 0,
        pseudonymization_applied BIT NOT NULL DEFAULT 0,
        consent_reference UNIQUEIDENTIFIER NULL,
        decision NVARCHAR(10) NOT NULL CHECK (decision IN ('ALLOW', 'DENY')),
        reason_codes NVARCHAR(MAX) NOT NULL,
        policy_version NVARCHAR(20) NOT NULL,
        occurred_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_ai_egress_manifests_occurred
        ON ai_egress_manifests (occurred_at DESC);

    CREATE INDEX IX_ai_egress_manifests_sucursal
        ON ai_egress_manifests (sucursal_id, occurred_at DESC);

    CREATE INDEX IX_ai_egress_manifests_capability
        ON ai_egress_manifests (capability, occurred_at DESC);
END

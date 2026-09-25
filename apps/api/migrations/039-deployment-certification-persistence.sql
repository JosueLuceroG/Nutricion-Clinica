-- 039: Build 09.5A - Persistencia de certificacion clinica + requalificacion (aditiva, no modifica 001-038).
-- La BD es la fuente de verdad del estado de certificacion/requalificacion (sobrevive reinicios).
-- Vacio/ausente/stale => NOT_ELIGIBLE (fail-closed). Nunca se asume aprobado por defecto.
-- Se registra el resultado del torneo clinico 07.5A (FAILED_REQUALIFICATION) como estado base
-- para que instalaciones nuevas arranquen fail-closed.

IF OBJECT_ID('ai_certification_records') IS NULL
BEGIN
    CREATE TABLE ai_certification_records (
        certification_id NVARCHAR(200) NOT NULL PRIMARY KEY,
        provider_id NVARCHAR(50) NOT NULL,
        model_id NVARCHAR(100) NOT NULL,
        model_version NVARCHAR(50) NOT NULL,
        capability_id NVARCHAR(64) NOT NULL,
        state NVARCHAR(32) NOT NULL,
        evaluated_at DATETIME2(3) NOT NULL,
        dataset_fingerprint NVARCHAR(64) NOT NULL,
        report_ref NVARCHAR(500) NOT NULL,
        deployment_fingerprint NVARCHAR(64) NULL,
        record_json NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT df_ai_cert_records_created DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT df_ai_cert_records_updated DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX ix_ai_cert_records_lookup ON ai_certification_records (provider_id, model_id, capability_id);
    CREATE INDEX ix_ai_cert_records_deploy ON ai_certification_records (deployment_fingerprint);
END
GO

IF OBJECT_ID('ai_requalification_flags') IS NULL
BEGIN
    CREATE TABLE ai_requalification_flags (
        provider_id NVARCHAR(50) NOT NULL,
        model_id NVARCHAR(100) NOT NULL,
        capability_id NVARCHAR(64) NOT NULL,
        reason_ref NVARCHAR(500) NULL,
        flagged_at DATETIME2(3) NOT NULL CONSTRAINT df_ai_requalification_flagged DEFAULT SYSUTCDATETIME(),
        CONSTRAINT pk_ai_requalification_flags PRIMARY KEY (provider_id, model_id, capability_id)
    );
END
GO

-- Estado base del torneo clinico 07.5A (idempotente): modelos con re-evaluacion FALLIDA.
IF NOT EXISTS (SELECT 1 FROM ai_requalification_flags WHERE provider_id = N'ollama' AND model_id = N'llama3.2' AND capability_id = N'chat_general')
BEGIN
    INSERT INTO ai_requalification_flags (provider_id, model_id, capability_id, reason_ref)
    VALUES (N'ollama', N'llama3.2', N'chat_general', N'FAILED_REQUALIFICATION: torneo clinico 07.5A');
END
GO

IF NOT EXISTS (SELECT 1 FROM ai_requalification_flags WHERE provider_id = N'ollama' AND model_id = N'llama3.2' AND capability_id = N'nutrition_reasoning')
BEGIN
    INSERT INTO ai_requalification_flags (provider_id, model_id, capability_id, reason_ref)
    VALUES (N'ollama', N'llama3.2', N'nutrition_reasoning', N'FAILED_REQUALIFICATION: torneo clinico 07.5A');
END
GO

IF NOT EXISTS (SELECT 1 FROM ai_requalification_flags WHERE provider_id = N'openai' AND model_id = N'gpt-4o-mini' AND capability_id = N'chat_general')
BEGIN
    INSERT INTO ai_requalification_flags (provider_id, model_id, capability_id, reason_ref)
    VALUES (N'openai', N'gpt-4o-mini', N'chat_general', N'FAILED_REQUALIFICATION: re-evaluacion historica 07.5A');
END
GO

IF NOT EXISTS (SELECT 1 FROM ai_requalification_flags WHERE provider_id = N'openai' AND model_id = N'gpt-4o-mini' AND capability_id = N'structured_json')
BEGIN
    INSERT INTO ai_requalification_flags (provider_id, model_id, capability_id, reason_ref)
    VALUES (N'openai', N'gpt-4o-mini', N'structured_json', N'FAILED_REQUALIFICATION: re-evaluacion historica 07.5A');
END
GO

IF NOT EXISTS (SELECT 1 FROM ai_requalification_flags WHERE provider_id = N'openai' AND model_id = N'gpt-4o-mini' AND capability_id = N'nutrition_reasoning')
BEGIN
    INSERT INTO ai_requalification_flags (provider_id, model_id, capability_id, reason_ref)
    VALUES (N'openai', N'gpt-4o-mini', N'nutrition_reasoning', N'FAILED_REQUALIFICATION: re-evaluacion historica 07.5A');
END
GO
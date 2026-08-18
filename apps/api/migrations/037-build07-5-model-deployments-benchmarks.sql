-- 037: Build 07.5 - deployments de modelo, benchmark runs y politica de organizacion.
-- Aditiva: no modifica migraciones previas (001-036).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_model_deployments')
BEGIN
  CREATE TABLE ai_model_deployments (
    deployment_fingerprint NVARCHAR(64) NOT NULL PRIMARY KEY,
    deployment_id NVARCHAR(200) NOT NULL,
    provider_id NVARCHAR(50) NOT NULL,
    model_id NVARCHAR(100) NOT NULL,
    model_version NVARCHAR(50) NOT NULL,
    weights_revision NVARCHAR(200) NULL,
    quantization NVARCHAR(50) NULL,
    runtime NVARCHAR(50) NOT NULL,
    runtime_version NVARCHAR(50) NULL,
    inference_settings_json NVARCHAR(MAX) NOT NULL,
    hardware_class NVARCHAR(30) NOT NULL,
    status NVARCHAR(30) NOT NULL,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX ux_ai_model_deployments_deployment_id ON ai_model_deployments (deployment_id);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_benchmark_runs')
BEGIN
  CREATE TABLE ai_benchmark_runs (
    benchmark_run_id NVARCHAR(64) NOT NULL PRIMARY KEY,
    deployment_fingerprint NVARCHAR(64) NOT NULL,
    dataset_versions_json NVARCHAR(MAX) NOT NULL,
    hardware_class NVARCHAR(30) NOT NULL,
    test_counts_json NVARCHAR(MAX) NOT NULL,
    safety_json NVARCHAR(MAX) NOT NULL,
    abstention_json NVARCHAR(MAX) NOT NULL,
    structured_json NVARCHAR(MAX) NOT NULL,
    tool_selection_json NVARCHAR(MAX) NOT NULL,
    grounding_json NVARCHAR(MAX) NOT NULL,
    rule_compliance_json NVARCHAR(MAX) NOT NULL,
    spanish_json NVARCHAR(MAX) NOT NULL,
    injection_json NVARCHAR(MAX) NOT NULL,
    latency_json NVARCHAR(MAX) NOT NULL,
    resource_usage_json NVARCHAR(MAX) NOT NULL,
    failures_json NVARCHAR(MAX) NOT NULL,
    result NVARCHAR(20) NOT NULL,
    artifacts_fingerprint NVARCHAR(64) NOT NULL,
    started_at DATETIME2(3) NOT NULL,
    completed_at DATETIME2(3) NOT NULL,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX ix_ai_benchmark_runs_deployment ON ai_benchmark_runs (deployment_fingerprint);
  CREATE INDEX ix_ai_benchmark_runs_hardware ON ai_benchmark_runs (hardware_class);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_org_model_policy')
BEGIN
  CREATE TABLE ai_org_model_policy (
    policy_key NVARCHAR(100) NOT NULL PRIMARY KEY,
    policy_value NVARCHAR(200) NOT NULL,
    updated_by_ref NVARCHAR(200) NOT NULL,
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO
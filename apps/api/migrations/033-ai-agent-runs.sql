IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_agent_runs')
BEGIN
    CREATE TABLE ai_agent_runs (
        id UNIQUEIDENTIFIER PRIMARY KEY,
        agent_id NVARCHAR(100) NOT NULL,
        actor_profesional_id UNIQUEIDENTIFIER NOT NULL,
        actor_role NVARCHAR(40) NOT NULL,
        sucursal_id UNIQUEIDENTIFIER NOT NULL,
        paciente_id UNIQUEIDENTIFIER NULL,
        status NVARCHAR(30) NOT NULL,
        stop_reason NVARCHAR(30) NULL,
        steps_json NVARCHAR(MAX) NOT NULL,
        budget_json NVARCHAR(400) NOT NULL,
        input_json NVARCHAR(MAX) NOT NULL,
        pending_step_index INT NULL,
        pending_tool_json NVARCHAR(MAX) NULL,
        answer NVARCHAR(MAX) NULL,
        error NVARCHAR(MAX) NULL,
        started_at DATETIME2(3) NOT NULL,
        expires_at DATETIME2(3) NOT NULL,
        completed_at DATETIME2(3) NULL
    );

    CREATE INDEX IX_ai_agent_runs_actor_sucursal_status
        ON ai_agent_runs (actor_profesional_id, sucursal_id, status);

    CREATE INDEX IX_ai_agent_runs_agent_id
        ON ai_agent_runs (agent_id);
END
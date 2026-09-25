IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_specialization_decisions')
BEGIN
    CREATE TABLE ai_specialization_decisions (
        id UNIQUEIDENTIFIER PRIMARY KEY,
        candidate_id NVARCHAR(100) NOT NULL,
        status NVARCHAR(20) NOT NULL,
        reasons_json NVARCHAR(MAX) NOT NULL,
        evaluated_at DATETIME2(3) NOT NULL
    );

    CREATE INDEX IX_ai_specialization_decisions_candidate
        ON ai_specialization_decisions (candidate_id, evaluated_at);
END
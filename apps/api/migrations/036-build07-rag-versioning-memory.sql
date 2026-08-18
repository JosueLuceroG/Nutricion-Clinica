-- REMEDIATION BUILD 07: RAG versioning + scoped memory tables
-- Aditivo: no toca tablas previas.
-- 1) knowledge_doc_versions: versionado por documento (identidad != version).
-- 2) knowledge_chunks: chunks persistentes ligados a documento+version.
-- 3) ai_conversation_memory: memoria conversacional acotada por turnos/TTL.
-- 4) ai_user_preferences: preferencias profesionales seguras (sin overrides de politica).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'knowledge_doc_versions')
BEGIN
    CREATE TABLE knowledge_doc_versions (
        doc_id UNIQUEIDENTIFIER NOT NULL,
        version INT NOT NULL,
        title NVARCHAR(300) NOT NULL,
        category NVARCHAR(100) NOT NULL,
        tier NVARCHAR(40) NOT NULL,
        status NVARCHAR(20) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        content_fingerprint NVARCHAR(64) NOT NULL,
        source_issuer NVARCHAR(200) NULL,
        approved_by_ref NVARCHAR(200) NULL,
        approved_at DATETIME2(3) NULL,
        effective_from DATETIME2(3) NOT NULL,
        effective_to DATETIME2(3) NULL,
        supersedes_version INT NULL,
        scope NVARCHAR(40) NOT NULL,
        sucursal_scope UNIQUEIDENTIFIER NULL,
        patient_scope NVARCHAR(40) NOT NULL,
        allowed_roles NVARCHAR(500) NOT NULL,
        revoked_at DATETIME2(3) NULL,
        revoked_by_ref NVARCHAR(200) NULL,
        superseded_by_ref NVARCHAR(200) NULL,
        deleted_at DATETIME2(3) NULL,
        created_at DATETIME2(3) NOT NULL,
        updated_at DATETIME2(3) NOT NULL,
        CONSTRAINT pk_knowledge_doc_versions PRIMARY KEY (doc_id, version)
    );

    CREATE INDEX idx_kvd_status ON knowledge_doc_versions (status);
    CREATE INDEX idx_kvd_effective ON knowledge_doc_versions (effective_from, effective_to);
    CREATE INDEX idx_kvd_doc_status_version ON knowledge_doc_versions (doc_id, status, version);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'knowledge_chunks')
BEGIN
    CREATE TABLE knowledge_chunks (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        doc_id UNIQUEIDENTIFIER NOT NULL,
        doc_version INT NOT NULL,
        chunk_index INT NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        content_fingerprint NVARCHAR(64) NOT NULL,
        created_at DATETIME2(3) NOT NULL,
        CONSTRAINT fk_kchunks_version FOREIGN KEY (doc_id, doc_version)
            REFERENCES knowledge_doc_versions (doc_id, version)
    );

    CREATE INDEX idx_kchunks_doc_version ON knowledge_chunks (doc_id, doc_version);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_conversation_memory')
BEGIN
    CREATE TABLE ai_conversation_memory (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        conversation_id NVARCHAR(64) NOT NULL,
        user_id UNIQUEIDENTIFIER NOT NULL,
        paciente_id UNIQUEIDENTIFIER NULL,
        sucursal_id UNIQUEIDENTIFIER NOT NULL,
        domain NVARCHAR(60) NOT NULL,
        summary NVARCHAR(4000) NOT NULL,
        sensitivity NVARCHAR(20) NOT NULL,
        turn_count INT NOT NULL,
        size_bytes INT NOT NULL,
        consent_ref NVARCHAR(200) NULL,
        created_at DATETIME2(3) NOT NULL,
        updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        expires_at DATETIME2(3) NOT NULL,
        deleted_at DATETIME2(3) NULL
    );

    CREATE INDEX idx_acm_sucursal_user ON ai_conversation_memory (sucursal_id, user_id);
    CREATE INDEX idx_acm_paciente ON ai_conversation_memory (paciente_id);
    CREATE INDEX idx_acm_expires ON ai_conversation_memory (expires_at);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_user_preferences')
BEGIN
    CREATE TABLE ai_user_preferences (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        sucursal_id UNIQUEIDENTIFIER NULL,
        pref_key NVARCHAR(80) NOT NULL,
        pref_value NVARCHAR(500) NOT NULL,
        updated_at DATETIME2(3) NOT NULL,
        deleted_at DATETIME2(3) NULL,
        CONSTRAINT uq_aup_user_key UNIQUE (user_id, pref_key)
    );

    CREATE INDEX idx_aup_user ON ai_user_preferences (user_id);
END;
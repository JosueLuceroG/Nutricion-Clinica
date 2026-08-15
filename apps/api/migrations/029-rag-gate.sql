-- Fase 13: RAG Gate
-- Knowledge governance: documentos con tier de evidencia, ACL por rol/sucursal,
-- aprobacion y vigencia documental.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'knowledge_docs')
BEGIN
    CREATE TABLE knowledge_docs (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        sucursal_id UNIQUEIDENTIFIER NULL,
        title NVARCHAR(300) NOT NULL,
        category NVARCHAR(100) NOT NULL,
        tier NVARCHAR(40) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        status NVARCHAR(20) NOT NULL,
        approved_by UNIQUEIDENTIFIER NULL,
        approved_at DATETIME2(3) NULL,
        expires_at DATETIME2(3) NULL,
        allowed_roles NVARCHAR(500) NOT NULL,
        created_at DATETIME2(3) NOT NULL,
        deleted_at DATETIME2(3) NULL
    );

    CREATE INDEX idx_knowledge_docs_status ON knowledge_docs (status);
    CREATE INDEX idx_knowledge_docs_sucursal ON knowledge_docs (sucursal_id);
END;
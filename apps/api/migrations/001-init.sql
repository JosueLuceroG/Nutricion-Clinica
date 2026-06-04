-- =====================================================================
-- 001-init.sql
-- Multi-tenancy, auth, sync state. Base para Sprint 14A.
-- =====================================================================

-- Tabla de sucursales (multi-tenancy)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sucursales')
CREATE TABLE sucursales (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  nombre NVARCHAR(120) NOT NULL,
  direccion NVARCHAR(250) NULL,
  telefono NVARCHAR(40) NULL,
  email NVARCHAR(200) NULL,
  activa BIT NOT NULL DEFAULT 1,
  config_json NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL
);
CREATE INDEX idx_sucursales_activa ON sucursales(activa) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_sucursales_nombre ON sucursales(nombre) WHERE deleted_at IS NULL;

-- Tabla de profesionales (auth + RBAC)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'profesionales')
CREATE TABLE profesionales (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  email NVARCHAR(200) NOT NULL,
  password_hash NVARCHAR(255) NOT NULL,
  nombre_completo NVARCHAR(200) NOT NULL,
  cedula_profesional NVARCHAR(40) NULL,
  rol NVARCHAR(40) NOT NULL CHECK (rol IN ('admin','nutriologa','asistente','soporte_tecnico','auditor','facturacion')),
  telefono NVARCHAR(40) NULL,
  firma_digital_url NVARCHAR(500) NULL,
  especialidad NVARCHAR(120) NULL,
  activo BIT NOT NULL DEFAULT 1,
  email_verificado BIT NOT NULL DEFAULT 0,
  ultimo_login_at DATETIME2(3) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL
);
CREATE UNIQUE INDEX uq_profesionales_email ON profesionales(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_profesionales_rol ON profesionales(rol) WHERE deleted_at IS NULL;

-- N:M profesional <-> sucursal
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'profesional_sucursal')
CREATE TABLE profesional_sucursal (
  profesional_id UNIQUEIDENTIFIER NOT NULL,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  es_titular BIT NOT NULL DEFAULT 0,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (profesional_id, sucursal_id),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id) ON DELETE CASCADE,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE
);
CREATE INDEX idx_prof_suc_sucursal ON profesional_sucursal(sucursal_id);

-- Sync state: per (profesional, sucursal, entity_type) tracking
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sync_state')
CREATE TABLE sync_state (
  profesional_id UNIQUEIDENTIFIER NOT NULL,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  entity_type NVARCHAR(60) NOT NULL,
  last_pulled_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  last_pushed_at DATETIME2(3) NULL,
  last_error NVARCHAR(MAX) NULL,
  PRIMARY KEY (profesional_id, sucursal_id, entity_type),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id) ON DELETE CASCADE,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE
);

-- Audit log (NOM-024, retención 5 años)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_log')
CREATE TABLE audit_log (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NULL,
  profesional_id UNIQUEIDENTIFIER NULL,
  entity_type NVARCHAR(60) NOT NULL,
  entity_id UNIQUEIDENTIFIER NULL,
  operacion NVARCHAR(20) NOT NULL CHECK (operacion IN ('create','read','update','delete','login','logout','sync')),
  detalles NVARCHAR(MAX) NULL,
  ip_address NVARCHAR(45) NULL,
  user_agent NVARCHAR(500) NULL,
  occurred_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX idx_audit_occurred ON audit_log(occurred_at DESC);
CREATE INDEX idx_audit_sucursal ON audit_log(sucursal_id, occurred_at DESC);
CREATE INDEX idx_audit_profesional ON audit_log(profesional_id, occurred_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- Tabla de migraciones (control)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'schema_migrations')
CREATE TABLE schema_migrations (
  filename NVARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  checksum NVARCHAR(64) NOT NULL
);

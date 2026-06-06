-- =====================================================================
-- 005-pagos-en-consultas.sql
-- Sprint 14D: campos de pago a nivel consulta (MVP, sin entidad Pagos).
-- El catálogo `pagos/presupuestos/comprobantes` de 004-facturacion.sql
-- queda intacto para sprints futuros con cotizaciones formales.
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('consultas') AND name = 'cost')
  ALTER TABLE consultas ADD cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_consultas_cost DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('consultas') AND name = 'paid')
  ALTER TABLE consultas ADD paid BIT NOT NULL CONSTRAINT DF_consultas_paid DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('consultas') AND name = 'payment_method')
  ALTER TABLE consultas ADD payment_method NVARCHAR(40) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('consultas') AND name = 'paid_at')
  ALTER TABLE consultas ADD paid_at DATETIME2(3) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('consultas') AND name = 'reference')
  ALTER TABLE consultas ADD reference NVARCHAR(120) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('consultas') AND name = 'invoice_number')
  ALTER TABLE consultas ADD invoice_number NVARCHAR(40) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('consultas') AND name = 'billing_notes')
  ALTER TABLE consultas ADD billing_notes NVARCHAR(500) NULL;

CREATE INDEX idx_consultas_paid ON consultas(sucursal_id, paid, consultation_date DESC) WHERE deleted_at IS NULL;

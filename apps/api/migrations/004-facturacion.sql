-- =====================================================================
-- 004-facturacion.sql
-- Catálogo de servicios, presupuestos, pagos, comprobantes.
-- Base para Sprint 14D (facturación).
-- =====================================================================

-- Catálogo de servicios con precios (por sucursal)
CREATE TABLE servicios (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  codigo NVARCHAR(40) NOT NULL,
  nombre NVARCHAR(200) NOT NULL,
  descripcion NVARCHAR(500) NULL,
  duracion_minutos INT NULL,
  precio DECIMAL(12,2) NOT NULL,
  moneda NVARCHAR(3) NOT NULL DEFAULT 'MXN',
  iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
  requiere_paciente BIT NOT NULL DEFAULT 1,
  activo BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_servicios_codigo ON servicios(sucursal_id, codigo) WHERE deleted_at IS NULL;
CREATE INDEX idx_servicios_sucursal ON servicios(sucursal_id) WHERE activo = 1 AND deleted_at IS NULL;

-- Ítems de presupuesto (líneas detalle de servicios a facturar)
CREATE TABLE presupuesto_items (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  presupuesto_id UNIQUEIDENTIFIER NOT NULL,
  servicio_id UNIQUEIDENTIFIER NOT NULL,
  descripcion NVARCHAR(300) NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(12,2) NOT NULL,
  descuento_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL,
  iva DECIMAL(12,2) NOT NULL DEFAULT 0,
  [total] DECIMAL(12,2) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (servicio_id) REFERENCES servicios(id)
);
CREATE INDEX idx_pres_items_presupuesto ON presupuesto_items(presupuesto_id) WHERE deleted_at IS NULL;

-- Presupuestos (cotizaciones al paciente)
CREATE TABLE presupuestos (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  consulta_id UNIQUEIDENTIFIER NULL,
  profesional_id UNIQUEIDENTIFIER NOT NULL,
  folio NVARCHAR(40) NOT NULL,
  fecha DATE NOT NULL,
  vigencia_hasta DATE NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
  iva DECIMAL(12,2) NOT NULL DEFAULT 0,
  [total] DECIMAL(12,2) NOT NULL,
  moneda NVARCHAR(3) NOT NULL DEFAULT 'MXN',
  [status] NVARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired','converted')),
  notas NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
);
CREATE UNIQUE INDEX uq_presupuestos_folio ON presupuestos(sucursal_id, folio) WHERE deleted_at IS NULL;
CREATE INDEX idx_presupuestos_paciente ON presupuestos(paciente_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_presupuestos_sucursal ON presupuestos(sucursal_id, status, fecha DESC);

-- Pagos (vinculados a presupuestos o directos)
CREATE TABLE pagos (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  presupuesto_id UNIQUEIDENTIFIER NULL,
  consulta_id UNIQUEIDENTIFIER NULL,
  profesional_id UNIQUEIDENTIFIER NOT NULL,
  fecha DATETIME2(3) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  moneda NVARCHAR(3) NOT NULL DEFAULT 'MXN',
  metodo_pago NVARCHAR(40) NOT NULL CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','cheque','deposito','otro')),
  referencia NVARCHAR(120) NULL,
  [status] NVARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','cancelled','refunded')),
  notas NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id),
  FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
);
CREATE INDEX idx_pagos_paciente ON pagos(paciente_id, fecha DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_pagos_sucursal ON pagos(sucursal_id, fecha DESC) WHERE status = 'completed';
CREATE INDEX idx_pagos_presupuesto ON pagos(presupuesto_id) WHERE deleted_at IS NULL;

-- Comprobantes (facturas/recibos emitidos)
CREATE TABLE comprobantes (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  pago_id UNIQUEIDENTIFIER NOT NULL,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  tipo NVARCHAR(20) NOT NULL CHECK (tipo IN ('factura','recibo','nota_credito')),
  folio NVARCHAR(40) NOT NULL,
  serie NVARCHAR(20) NULL,
  fecha_emision DATETIME2(3) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  iva DECIMAL(12,2) NOT NULL,
  [total] DECIMAL(12,2) NOT NULL,
  rfc_receptor NVARCHAR(20) NULL,
  razon_social_receptor NVARCHAR(200) NULL,
  uuid_sat NVARCHAR(40) NULL,
  pdf_url NVARCHAR(500) NULL,
  xml_url NVARCHAR(500) NULL,
  [status] NVARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','cancelled','pending')),
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (pago_id) REFERENCES pagos(id),
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
);
CREATE UNIQUE INDEX uq_comprobantes_folio ON comprobantes(sucursal_id, tipo, folio) WHERE deleted_at IS NULL;
CREATE INDEX idx_comprobantes_pago ON comprobantes(pago_id);

-- =====================================================================
-- 002-domain.sql
-- Mirror del dominio clínico del cliente. Pacientes + consultas +
-- antropometría + laboratorio + planes + snapshots + catálogo SMAE.
-- Cada tabla tenant tiene sucursal_id para multi-tenancy.
-- =====================================================================

-- Pacientes
CREATE TABLE pacientes (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  profesional_titular_id UNIQUEIDENTIFIER NULL,
  nombres NVARCHAR(120) NOT NULL,
  apellido_paterno NVARCHAR(80) NOT NULL,
  apellido_materno NVARCHAR(80) NULL,
  fecha_nacimiento DATE NOT NULL,
  sexo NVARCHAR(20) NOT NULL CHECK (sexo IN ('female','male','intersex','undisclosed')),
  genero NVARCHAR(80) NULL,
  estado_civil NVARCHAR(40) NULL,
  ocupacion NVARCHAR(120) NULL,
  escolaridad NVARCHAR(80) NULL,
  email NVARCHAR(200) NULL,
  telefono NVARCHAR(40) NULL,
  telefono_secundario NVARCHAR(40) NULL,
  contacto_emergencia_nombre NVARCHAR(200) NULL,
  contacto_emergencia_parentesco NVARCHAR(60) NULL,
  contacto_emergencia_telefono NVARCHAR(40) NULL,
  notas_generales NVARCHAR(MAX) NULL,
  estado_expediente NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK (estado_expediente IN ('active','archived','closed')),
  expediente_abierto_at DATETIME2(3) NULL,
  consentimiento_informado_id UNIQUEIDENTIFIER NULL,
  fecha_firma_consentimiento DATETIME2(3) NULL,
  version_politica_privacidad NVARCHAR(40) NULL,
  clinical_tags_json NVARCHAR(MAX) NULL,
  record_status NVARCHAR(20) NOT NULL DEFAULT 'open' CHECK (record_status IN ('open','closed')),
  record_closed_reason NVARCHAR(40) NULL,
  record_closed_at DATETIME2(3) NULL,
  [status] NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (profesional_titular_id) REFERENCES profesionales(id)
);
CREATE INDEX idx_pacientes_sucursal ON pacientes(sucursal_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pacientes_titular ON pacientes(profesional_titular_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pacientes_nombre ON pacientes(sucursal_id, apellido_paterno, apellido_materno, nombres) WHERE deleted_at IS NULL;
CREATE INDEX idx_pacientes_email ON pacientes(sucursal_id, email) WHERE deleted_at IS NULL;
CREATE INDEX idx_pacientes_updated ON pacientes(sucursal_id, updated_at DESC);

-- Consultas (SOAP)
CREATE TABLE consultas (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  profesional_id UNIQUEIDENTIFIER NOT NULL,
  consultation_number INT NOT NULL,
  consultation_date DATETIME2(3) NOT NULL,
  [status] NVARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in-progress','completed','cancelled')),
  reason NVARCHAR(500) NOT NULL,
  subjective NVARCHAR(MAX) NULL,
  objective NVARCHAR(MAX) NULL,
  assessment NVARCHAR(MAX) NULL,
  [plan] NVARCHAR(MAX) NULL,
  vitals_json NVARCHAR(MAX) NULL,
  anthropometry_id UNIQUEIDENTIFIER NULL,
  lab_panel_id UNIQUEIDENTIFIER NULL,
  next_visit_date DATE NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
);
CREATE INDEX idx_consultas_sucursal ON consultas(sucursal_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_consultas_paciente ON consultas(paciente_id, consultation_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_consultas_profesional ON consultas(profesional_id, consultation_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_consultas_updated ON consultas(sucursal_id, updated_at DESC);

-- Antropometría
CREATE TABLE antropometrias (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  profesional_id UNIQUEIDENTIFIER NOT NULL,
  measured_at DATETIME2(3) NOT NULL,
  weight_kg DECIMAL(6,2) NOT NULL,
  height_m DECIMAL(4,2) NOT NULL,
  waist_cm DECIMAL(5,1) NULL,
  hip_cm DECIMAL(5,1) NULL,
  neck_cm DECIMAL(5,1) NULL,
  chest_cm DECIMAL(5,1) NULL,
  arm_cm DECIMAL(5,1) NULL,
  forearm_cm DECIMAL(5,1) NULL,
  thigh_cm DECIMAL(5,1) NULL,
  calf_cm DECIMAL(5,1) NULL,
  tricipital_mm DECIMAL(4,1) NULL,
  bicipital_mm DECIMAL(4,1) NULL,
  subescapular_mm DECIMAL(4,1) NULL,
  suprailiaco_mm DECIMAL(4,1) NULL,
  abdominal_mm DECIMAL(4,1) NULL,
  muslo_mm DECIMAL(4,1) NULL,
  pantorrilla_mm DECIMAL(4,1) NULL,
  bmi DECIMAL(5,2) NULL,
  body_fat_pct DECIMAL(4,1) NULL,
  notes NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
);
CREATE INDEX idx_antropometrias_paciente ON antropometrias(paciente_id, measured_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_antropometrias_sucursal ON antropometrias(sucursal_id, updated_at DESC);

-- Paneles de laboratorio
CREATE TABLE lab_panels (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  profesional_id UNIQUEIDENTIFIER NOT NULL,
  taken_at DATETIME2(3) NOT NULL,
  lab_name NVARCHAR(200) NULL,
  results_json NVARCHAR(MAX) NOT NULL,
  notes NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
);
CREATE INDEX idx_lab_panels_paciente ON lab_panels(paciente_id, taken_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_lab_panels_sucursal ON lab_panels(sucursal_id, updated_at DESC);

-- Planes de alimentación
CREATE TABLE planes_alimenticios (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  consulta_id UNIQUEIDENTIFIER NOT NULL,
  profesional_id UNIQUEIDENTIFIER NOT NULL,
  [name] NVARCHAR(200) NOT NULL,
  description NVARCHAR(500) NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  kcal_target INT NOT NULL,
  protein_target_g INT NOT NULL,
  carbs_target_g INT NOT NULL,
  fat_target_g INT NOT NULL,
  meals_json NVARCHAR(MAX) NOT NULL,
  notes NVARCHAR(MAX) NULL,
  [status] NVARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','cancelled')),
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
);
CREATE INDEX idx_planes_paciente ON planes_alimenticios(paciente_id, start_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_planes_consulta ON planes_alimenticios(consulta_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_planes_sucursal ON planes_alimenticios(sucursal_id, updated_at DESC);

-- Snapshots inmutables de expediente
CREATE TABLE expediente_snapshots (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  sucursal_id UNIQUEIDENTIFIER NOT NULL,
  consulta_id UNIQUEIDENTIFIER NOT NULL,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  profesional_id UNIQUEIDENTIFIER NOT NULL,
  contenido_json NVARCHAR(MAX) NOT NULL,
  contenido_hash NVARCHAR(64) NOT NULL,
  hash_algorithm NVARCHAR(20) NOT NULL DEFAULT 'SHA-256',
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
);
CREATE INDEX idx_snapshots_paciente ON expediente_snapshots(paciente_id, created_at DESC);
CREATE INDEX idx_snapshots_consulta ON expediente_snapshots(consulta_id);
CREATE INDEX idx_snapshots_sucursal ON expediente_snapshots(sucursal_id, created_at DESC);
CREATE UNIQUE INDEX uq_snapshots_hash ON expediente_snapshots(contenido_hash);

-- Catálogo SMAE: alimentos (system + custom por sucursal)
CREATE TABLE alimentos (
  id NVARCHAR(80) NOT NULL,
  sucursal_id UNIQUEIDENTIFIER NULL,
  grupo NVARCHAR(40) NOT NULL,
  nombre NVARCHAR(200) NOT NULL,
  nombre_corto NVARCHAR(80) NOT NULL,
  porcion NVARCHAR(120) NOT NULL,
  porcion_gramos DECIMAL(6,1) NOT NULL,
  kcal_porcion DECIMAL(6,1) NOT NULL,
  proteina_g DECIMAL(5,2) NOT NULL,
  cho_g DECIMAL(5,2) NOT NULL,
  grasa_g DECIMAL(5,2) NOT NULL,
  keywords NVARCHAR(MAX) NULL,
  custom BIT NOT NULL DEFAULT 0,
  activo BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  _owner_key AS ISNULL(sucursal_id, '00000000-0000-0000-0000-000000000000') PERSISTED,
  PRIMARY KEY (id, _owner_key),
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE
);
CREATE INDEX idx_alimentos_grupo ON alimentos(grupo) WHERE deleted_at IS NULL;
CREATE INDEX idx_alimentos_custom ON alimentos(sucursal_id) WHERE custom = 1 AND deleted_at IS NULL;

-- =====================================================================
-- 003-clinical-record.sql
-- Expediente clínico completo (módulo 31 del spec).
-- Sub-tables de pacientes: alergias, medicamentos, historia familiar,
-- historia personal, hábitos, actividad física, intolerancias,
-- cirugías, hospitalizaciones, suplementos, frecuencias alimenticias,
-- síntomas GI, dieta historia, documentos adjuntos.
-- =====================================================================

-- Alergias
CREATE TABLE alergias (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  sustancia NVARCHAR(200) NOT NULL,
  reaccion NVARCHAR(500) NULL,
  severidad NVARCHAR(20) NOT NULL CHECK (severidad IN ('leve','moderada','severa','anafilaxia')),
  diagnosticada BIT NOT NULL DEFAULT 0,
  notas NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_alergias_paciente ON alergias(paciente_id) WHERE deleted_at IS NULL;

-- Medicamentos activos
CREATE TABLE medicamentos (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  nombre NVARCHAR(200) NOT NULL,
  dosis NVARCHAR(80) NULL,
  frecuencia NVARCHAR(80) NULL,
  via_administracion NVARCHAR(40) NULL,
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  motivo NVARCHAR(500) NULL,
  activo BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_medicamentos_paciente ON medicamentos(paciente_id) WHERE deleted_at IS NULL;

-- Historia familiar
CREATE TABLE historia_familiar (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  parentesco NVARCHAR(60) NOT NULL,
  condicion NVARCHAR(200) NOT NULL,
  notas NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_hist_fam_paciente ON historia_familiar(paciente_id) WHERE deleted_at IS NULL;

-- Historia personal (enfermedades, condiciones preexistentes)
CREATE TABLE historia_personal (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  condicion NVARCHAR(200) NOT NULL,
  fecha_diagnostico DATE NULL,
  estado NVARCHAR(40) NOT NULL CHECK (estado IN ('activa','en_remision','resuelta','cronica')),
  tratamiento NVARCHAR(500) NULL,
  notas NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_hist_per_paciente ON historia_personal(paciente_id) WHERE deleted_at IS NULL;

-- Hábitos
CREATE TABLE habitos (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  tipo NVARCHAR(40) NOT NULL CHECK (tipo IN ('tabaco','alcohol','cafe','drogas','sueno','alimentacion','hidratacion')),
  frecuencia NVARCHAR(80) NULL,
  cantidad NVARCHAR(80) NULL,
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  activo BIT NOT NULL DEFAULT 1,
  notas NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_habitos_paciente ON habitos(paciente_id) WHERE deleted_at IS NULL;

-- Actividad física
CREATE TABLE actividad_fisica (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  tipo NVARCHAR(80) NOT NULL,
  frecuencia_semanal INT NULL,
  duracion_minutos INT NULL,
  intensidad NVARCHAR(40) NULL CHECK (intensidad IN ('ligera','moderada','vigorosa') OR intensidad IS NULL),
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  activo BIT NOT NULL DEFAULT 1,
  notas NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_act_fisica_paciente ON actividad_fisica(paciente_id) WHERE deleted_at IS NULL;

-- Intolerancias
CREATE TABLE intolerancias (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  alimento NVARCHAR(200) NOT NULL,
  sintomas NVARCHAR(500) NULL,
  severidad NVARCHAR(20) NOT NULL CHECK (severidad IN ('leve','moderada','severa')),
  notas NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_intolerancias_paciente ON intolerancias(paciente_id) WHERE deleted_at IS NULL;

-- Cirugías
CREATE TABLE cirugias (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  procedimiento NVARCHAR(200) NOT NULL,
  fecha DATE NULL,
  hospital NVARCHAR(200) NULL,
  complicaciones NVARCHAR(MAX) NULL,
  notas NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_cirugias_paciente ON cirugias(paciente_id) WHERE deleted_at IS NULL;

-- Hospitalizaciones
CREATE TABLE hospitalizaciones (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  motivo NVARCHAR(500) NOT NULL,
  fecha_ingreso DATE NULL,
  fecha_egreso DATE NULL,
  hospital NVARCHAR(200) NULL,
  complicaciones NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_hosp_paciente ON hospitalizaciones(paciente_id) WHERE deleted_at IS NULL;

-- Suplementos
CREATE TABLE suplementos (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  nombre NVARCHAR(200) NOT NULL,
  marca NVARCHAR(120) NULL,
  dosis NVARCHAR(80) NULL,
  frecuencia NVARCHAR(80) NULL,
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  activo BIT NOT NULL DEFAULT 1,
  notas NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_suplementos_paciente ON suplementos(paciente_id) WHERE deleted_at IS NULL;

-- Frecuencias alimenticias
CREATE TABLE frecuencias_alimenticias (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  grupo NVARCHAR(40) NOT NULL,
  alimento NVARCHAR(200) NOT NULL,
  frecuencia NVARCHAR(40) NOT NULL CHECK (frecuencia IN ('nunca','diario','semanal','quincenal','mensual','ocasional')),
  porciones DECIMAL(4,1) NULL,
  preparacion NVARCHAR(200) NULL,
  notas NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_freq_alim_paciente ON frecuencias_alimenticias(paciente_id) WHERE deleted_at IS NULL;

-- Síntomas gastrointestinales
CREATE TABLE sintomas_gi (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  sintoma NVARCHAR(120) NOT NULL,
  frecuencia NVARCHAR(40) NOT NULL,
  severidad NVARCHAR(20) NOT NULL CHECK (severidad IN ('leve','moderada','severa')),
  relacionado_alimentacion BIT NOT NULL DEFAULT 0,
  notas NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_sintomas_gi_paciente ON sintomas_gi(paciente_id) WHERE deleted_at IS NULL;

-- Dieta historia (dietas previas)
CREATE TABLE dieta_historia (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  tipo_dieta NVARCHAR(120) NOT NULL,
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  resultado NVARCHAR(500) NULL,
  profesional_previo NVARCHAR(200) NULL,
  notas NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
CREATE INDEX idx_dieta_hist_paciente ON dieta_historia(paciente_id) WHERE deleted_at IS NULL;

-- Equivalencias inversas SMAE (tortillas <-> maíz, frijoles <-> leguminosas)
CREATE TABLE equivalencias_inversas (
  alimento_id NVARCHAR(80) NOT NULL,
  grupo NVARCHAR(40) NOT NULL,
  orden INT NOT NULL,
  alimento_equivalente_id NVARCHAR(80) NOT NULL,
  cantidad DECIMAL(6,1) NOT NULL,
  unidad NVARCHAR(20) NOT NULL,
  grupo_equivalente NVARCHAR(40) NOT NULL,
  PRIMARY KEY (alimento_id, grupo, orden)
);
CREATE INDEX idx_equivalencias_inversas_equiv ON equivalencias_inversas(alimento_equivalente_id);

-- Equivalentes estándar SMAE (tabla de consulta)
CREATE TABLE equivalentes_estandar (
  grupo NVARCHAR(40) NOT NULL,
  alimento_id NVARCHAR(80) NOT NULL,
  porcion_cantidad DECIMAL(6,1) NOT NULL,
  porcion_unidad NVARCHAR(20) NOT NULL,
  kcal DECIMAL(6,1) NOT NULL,
  proteina_g DECIMAL(5,2) NOT NULL,
  cho_g DECIMAL(5,2) NOT NULL,
  grasa_g DECIMAL(5,2) NOT NULL,
  orden INT NOT NULL,
  PRIMARY KEY (grupo, alimento_id)
);

-- Documentos adjuntos
CREATE TABLE documentos (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  paciente_id UNIQUEIDENTIFIER NOT NULL,
  consulta_id UNIQUEIDENTIFIER NULL,
  profesional_id UNIQUEIDENTIFIER NOT NULL,
  tipo NVARCHAR(40) NOT NULL CHECK (tipo IN ('estudio','receta','consentimiento','informe','imagen','otro')),
  nombre_archivo NVARCHAR(255) NOT NULL,
  mime_type NVARCHAR(80) NOT NULL,
  tamano_bytes BIGINT NOT NULL,
  url_storage NVARCHAR(500) NOT NULL,
  hash_sha256 NVARCHAR(64) NOT NULL,
  fecha_documento DATE NULL,
  notas NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  deleted_at DATETIME2(3) NULL,
  row_version ROWVERSION NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
);
CREATE INDEX idx_documentos_paciente ON documentos(paciente_id) WHERE deleted_at IS NULL;

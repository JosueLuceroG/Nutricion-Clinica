-- 027-oltp-integrity.sql
-- Fase 0B: alinear Dexie/API/SQL.
--   1) consultas: columnas de facturación que el sync ya mapeaba pero no existían
--      (payment_status, payment_concept, amount_paid).
--   2) pacientes: campos locales que ahora se sincronizan (clave_interna,
--      birth_place, address, nationality, id_type, id_number).
--   3) antropometrias: representación JSON de circumferences/skinfolds/bia,
--      con backfill desde las columnas planas históricas.
--   4) record_status: CHECK ampliado a los 4 estados del cliente
--      (open, closed, discharged, referred).

-- 1) consultas: campos de facturación ya mapeados por sync
IF COL_LENGTH('dbo.consultas', 'payment_status') IS NULL
BEGIN
  ALTER TABLE dbo.consultas ADD payment_status NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.consultas', 'payment_concept') IS NULL
BEGIN
  ALTER TABLE dbo.consultas ADD payment_concept NVARCHAR(100) NULL;
END;

IF COL_LENGTH('dbo.consultas', 'amount_paid') IS NULL
BEGIN
  ALTER TABLE dbo.consultas ADD amount_paid DECIMAL(12,2) NULL;
END;

-- 2) pacientes: campos locales que ahora se sincronizan
IF COL_LENGTH('dbo.pacientes', 'clave_interna') IS NULL
BEGIN
  ALTER TABLE dbo.pacientes ADD clave_interna NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.pacientes', 'birth_place') IS NULL
BEGIN
  ALTER TABLE dbo.pacientes ADD birth_place NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.pacientes', 'address') IS NULL
BEGIN
  ALTER TABLE dbo.pacientes ADD address NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.pacientes', 'nationality') IS NULL
BEGIN
  ALTER TABLE dbo.pacientes ADD nationality NVARCHAR(100) NULL;
END;

IF COL_LENGTH('dbo.pacientes', 'id_type') IS NULL
BEGIN
  ALTER TABLE dbo.pacientes ADD id_type NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.pacientes', 'id_number') IS NULL
BEGIN
  ALTER TABLE dbo.pacientes ADD id_number NVARCHAR(100) NULL;
END;

-- 3) antropometrias: representación JSON (circumferences/skinfolds/bia)
IF COL_LENGTH('dbo.antropometrias', 'circumferences_json') IS NULL
BEGIN
  ALTER TABLE dbo.antropometrias ADD circumferences_json NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.antropometrias', 'skinfolds_json') IS NULL
BEGIN
  ALTER TABLE dbo.antropometrias ADD skinfolds_json NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.antropometrias', 'bia_json') IS NULL
BEGIN
  ALTER TABLE dbo.antropometrias ADD bia_json NVARCHAR(MAX) NULL;
END;

-- Backfill desde las columnas planas históricas (solo si hay datos)
UPDATE dbo.antropometrias
SET circumferences_json = (
  SELECT neck_cm AS neck, chest_cm AS chest, waist_cm AS waist,
         hip_cm AS hip, arm_cm AS arm, forearm_cm AS forearm,
         thigh_cm AS thigh, calf_cm AS calf
  FROM dbo.antropometrias AS src
  WHERE src.id = dbo.antropometrias.id
  FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
)
WHERE circumferences_json IS NULL
  AND (neck_cm IS NOT NULL OR chest_cm IS NOT NULL OR waist_cm IS NOT NULL
       OR hip_cm IS NOT NULL OR arm_cm IS NOT NULL OR forearm_cm IS NOT NULL
       OR thigh_cm IS NOT NULL OR calf_cm IS NOT NULL);

UPDATE dbo.antropometrias
SET skinfolds_json = (
  SELECT tricipital_mm AS triceps, bicipital_mm AS biceps,
         subescapular_mm AS subscapular, suprailiaco_mm AS suprailiac,
         abdominal_mm AS abdominal, muslo_mm AS thigh, pantorrilla_mm AS calf
  FROM dbo.antropometrias AS src
  WHERE src.id = dbo.antropometrias.id
  FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
)
WHERE skinfolds_json IS NULL
  AND (tricipital_mm IS NOT NULL OR bicipital_mm IS NOT NULL
       OR subescapular_mm IS NOT NULL OR suprailiaco_mm IS NOT NULL
       OR abdominal_mm IS NOT NULL OR muslo_mm IS NOT NULL
       OR pantorrilla_mm IS NOT NULL);

-- 4) record_status: alinear el CHECK con los 4 estados del cliente
DECLARE @legacy_record_status_check sysname;

SELECT @legacy_record_status_check = cc.name
FROM sys.check_constraints AS cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.pacientes')
  AND cc.parent_column_id = COLUMNPROPERTY(
    OBJECT_ID('dbo.pacientes'), 'record_status', 'ColumnId'
  );

IF @legacy_record_status_check IS NOT NULL AND @legacy_record_status_check <> N'CK_pacientes_record_status'
BEGIN
  EXEC(N'ALTER TABLE dbo.pacientes DROP CONSTRAINT ' + QUOTENAME(@legacy_record_status_check));
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.pacientes') AND name = N'CK_pacientes_record_status'
)
BEGIN
  ALTER TABLE dbo.pacientes ADD CONSTRAINT CK_pacientes_record_status
    CHECK (record_status IN ('open', 'closed', 'discharged', 'referred'));
END;
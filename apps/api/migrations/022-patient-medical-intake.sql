IF COL_LENGTH('dbo.pacientes', 'tamizaje_medico_json') IS NULL
BEGIN
  ALTER TABLE dbo.pacientes
    ADD tamizaje_medico_json NVARCHAR(MAX) NULL;
END;

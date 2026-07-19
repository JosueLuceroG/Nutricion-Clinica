IF COL_LENGTH('dbo.pacientes', 'numero_expediente_externo') IS NULL
BEGIN
  ALTER TABLE dbo.pacientes
    ADD numero_expediente_externo NVARCHAR(100) NULL;
END;

IF COL_LENGTH('dbo.pacientes', 'motivo_ingreso') IS NULL
BEGIN
  ALTER TABLE dbo.pacientes
    ADD motivo_ingreso NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.pacientes', 'foto_url') IS NULL
BEGIN
  ALTER TABLE dbo.pacientes
    ADD foto_url NVARCHAR(MAX) NULL;
END;

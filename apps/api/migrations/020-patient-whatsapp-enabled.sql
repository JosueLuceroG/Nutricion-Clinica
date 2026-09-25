IF NOT EXISTS (
  SELECT 1
    FROM sys.columns
   WHERE object_id = OBJECT_ID('dbo.pacientes')
     AND name = 'whatsapp_habilitado'
)
BEGIN
  ALTER TABLE dbo.pacientes
    ADD whatsapp_habilitado BIT NULL;
END;

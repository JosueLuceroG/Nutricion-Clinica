IF EXISTS (
  SELECT 1
    FROM sys.columns
   WHERE object_id = OBJECT_ID('dbo.profesionales')
     AND name = 'totp_secret'
     AND max_length < 800
)
BEGIN
  ALTER TABLE dbo.profesionales
    ALTER COLUMN totp_secret NVARCHAR(400) NULL;
END;

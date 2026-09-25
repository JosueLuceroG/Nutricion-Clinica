IF COL_LENGTH('dbo.profesionales', 'totp_pending_secret') IS NULL
BEGIN
  ALTER TABLE dbo.profesionales
    ADD totp_pending_secret NVARCHAR(400) NULL;
END;

IF COL_LENGTH('dbo.profesionales', 'totp_pending_expires_at') IS NULL
BEGIN
  ALTER TABLE dbo.profesionales
    ADD totp_pending_expires_at DATETIME2 NULL;
END;

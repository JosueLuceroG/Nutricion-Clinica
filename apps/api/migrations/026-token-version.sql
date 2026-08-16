-- =====================================================================
-- 026-token-version.sql
-- Version de token por profesional para revocacion de sesiones JWT.
-- Los access tokens llevan la claim `ver`; verifyToken exige que
-- coincida con token_version y que la cuenta siga activa. Cualquier
-- cambio de seguridad (2FA habilitado/deshabilitado) incrementa la
-- version e invalida todas las sesiones anteriores.
-- =====================================================================

-- Nota: sin transaccion explicita. El driver mssql ejecuta cada batch
-- via sp_executesql; un BEGIN/COMMIT que no cierre en el mismo batch
-- dispara "Transaction count after EXECUTE". El ALTER es idempotente
-- (guardado por IF NOT EXISTS) y el UPDATE no altera datos existentes.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
   WHERE object_id = OBJECT_ID(N'dbo.profesionales')
     AND name = N'token_version'
)
BEGIN
  ALTER TABLE dbo.profesionales
    ADD token_version INT NOT NULL
      CONSTRAINT DF_profesionales_token_version DEFAULT 1;
END;
GO

UPDATE dbo.profesionales SET token_version = 1 WHERE token_version IS NULL;
GO
-- ============================================================
-- Migration 014: 2FA TOTP para profesionales
-- ============================================================

ALTER TABLE profesionales
  ADD totp_secret  NVARCHAR(100) NULL,
      totp_enabled BIT           NOT NULL DEFAULT 0;

# Auth token compatibility and 2FA rollout

## Contract

NutriClinica JWTs have an explicit purpose:

- `tokenType: "access"` is accepted by protected API and WebSocket entry points.
- `tokenType: "pending_2fa"` is accepted only to complete the login 2FA challenge.

Access tokens also carry `rol`, `sucursalIds`, and `totpVerified`. Both token
types are validated with strict schemas, issuer, audience, issued-at, and expiry.
Tokens without `tokenType`, including access tokens issued before this rollout,
are intentionally rejected.

## Deployment order

1. Apply `023-pending-totp-enrollment.sql`.
2. Deploy the API.
3. Require users with legacy JWTs to sign in again.
4. Verify login without 2FA, login with 2FA, setup, disable, and setup again.

Migration 023 is additive and idempotent. Existing active TOTP secrets are not
changed. Pending enrollment data expires after ten minutes and is never accepted
as an active factor until verified.

## Roll-forward and rollback

Roll-forward is preferred. If API deployment fails, restore the previous API;
the two nullable columns added by migration 023 are ignored by the previous
version and can remain in place.

Do not drop the new columns during an application rollback. Dropping them can
race with a partially completed enrollment and is unnecessary. Remove them only
in a later planned migration after confirming no compatible deployment uses
them and after a verified SQL Server backup.

Changing `JWT_SECRET`, issuer, or audience invalidates all outstanding access and
pending tokens. This is the emergency token-invalidation procedure; users must
sign in again afterward.

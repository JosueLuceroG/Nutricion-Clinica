# Sync push authorization

`POST /sync/push` authorizes and normalizes every operation before opening a SQL
Server connection. If any operation violates policy, the complete batch is
rejected and no operation in that batch is written.

## Role matrix

| Entity              | admin                | nutriologa                    | asistente           | facturacion         | soporte_tecnico | auditor |
| ------------------- | -------------------- | ----------------------------- | ------------------- | ------------------- | --------------- | ------- |
| pacientes           | create/update/delete | create/update/delete          | denied              | denied              | denied          | denied  |
| consultas           | create/update/delete | clinical create/update/delete | billing update only | billing update only | denied          | denied  |
| antropometrias      | create/update/delete | create/update/delete          | denied              | denied              | denied          | denied  |
| lab_panels          | create/update/delete | create/update/delete          | denied              | denied              | denied          | denied  |
| planes_alimenticios | create/update/delete | create/update/delete          | denied              | denied              | denied          | denied  |
| adherence_records   | create/update/delete | create/update/delete          | denied              | denied              | denied          | denied  |

Billing fields are `cost`, `paid`, `payment_status`, `payment_concept`,
`payment_method`, `paid_at`, `reference`, `invoice_number`, `billing_notes`, and
`amount_paid`. Full consultation snapshots from billing roles are reduced to
those fields before reaching SQL.

## Server-owned fields

The server ignores client attribution and system metadata. It derives the
active branch, professional owner, consultation number, timestamps, and row
version from trusted server context. A non-null `deleted_at` update is treated
as a delete operation and re-authorized as such.

Professional sync cannot claim `source=portal` or a portal token for adherence
records. Portal-attributed records must use the patient portal endpoint.

## Rejection contract

Policy violations return HTTP 400 or 403 with safe operation metadata:

```text
index, entity, id, op, code, reason
```

Clinical payloads are not copied into the error or audit response. Rejected
client queue items return to `error` instead of remaining stuck in `syncing`.

## Remaining sync integrity work

Authorization does not replace the planned row-version and transaction phase.
Updates and deletes still require a later increment for mandatory optimistic
concurrency, atomic SQL writes, and returned row versions.

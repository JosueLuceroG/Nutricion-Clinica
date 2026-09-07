# DWH schema version erratum

The frozen SQL artifact `apps/api/src/modules/dwh/schema/dwh-schema.sql` contains
the historical header `dwh-08-001`. The release contract and schema registry use
`dwh-08-002` for that exact checksummed artifact.

The header is not corrected in place because changing the frozen DDL would alter
its checksum. `DWH_SCHEMA_VERSION` in `dwhSchema.ts`, the recorded
`dwh_schema_version` row, and the deployment manifest are authoritative. A future
DDL change must use a new schema version and a new reviewed artifact rather than
silently modifying this file.

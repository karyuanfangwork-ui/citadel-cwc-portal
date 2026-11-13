# HR recruitment version-2 graph draft — NOT PUBLISHED

Read-only local snapshot source: HR_RECRUITMENT workflow type `20280a85-0401-4040-b13c-204ffaf63f3f`, ACTIVE version 1 `4d98228b-8b55-4aad-af2b-ca126d8485bf`. Preserve all unlisted nodes, edges, SLA flags, guards, permissions, and layout fields. Re-read the active version before authoring/publishing in a separately approved release.

Changes against the actual active version:
- Remove `CEO_APPROVED -> PENDING_GROUP_DCEO_APPROVAL` (`ADVANCE`).
- Keep `SUBMITTED -> PENDING_CEO_APPROVAL` labelled `SUBMIT` and `IN_REVIEW -> PENDING_CEO_APPROVAL` labelled `ADVANCE`.
- Add `SUBMITTED -> PENDING_GROUP_DCEO_APPROVAL` (`ESCALATE`).
- Add `IN_REVIEW -> PENDING_GROUP_DCEO_APPROVAL` (`ESCALATE`).
- Add `CEO_APPROVED -> JOB_POSTED` (`ADVANCE`).
- Preserve `GROUP_DCEO_APPROVED -> JOB_POSTED` and all hiring/interview/LOA edges.

Both existing CEO-route edges were read back with `allowedRoles: ['AGENT','ADMIN']`, `allowedExecutiveRoles: []`, and null auto-assignment metadata; use the same restrictions for the two new DCEO route edges. No comment is required for these routes. `SUBMIT`/`ADVANCE` and `ESCALATE` are distinct outgoing labels allowed by the graph validator; validate the whole graph and compiled HR-scoped rows before publication. The global `CEO_APPROVED -> PENDING_GROUP_DCEO_APPROVAL` remains for ESM, while the HR command guard prevents it from applying to NEW_HIRING.

Read-only in-memory candidate validation: `loadGraph` of the above ACTIVE version, remove/add exactly the listed edges, then `validateStructure` and `projectGraph` returned no blocking findings and projected both executive routes and both job-posting paths. The retained source graph has existing `CANCEL` unknown-label warnings; no new graph edge introduced an unknown-label warning. This was not a database draft, live-data validation, compile, or publish.

Read-only in-flight inventory from restored local `help_center` (not the disposable test DB): `HR-00009` SUBMITTED, no approvals/history; `HR-00007` and `HR-00008` PENDING_CEO_APPROVAL but CEO rows already APPROVED and no pending row; `HR-00003` GROUP_DCEO_APPROVED with an APPROVED DCEO row and no workflow history. No record was corrected/backfilled. A backup-first, individually reviewed compatibility/remediation decision is required before any graph publication; do not let unclassified pending requests be stranded. The additive migration, graph publish, rollback plan, backup/restore proof and compiled-row audit remain separate production gates requiring explicit approval.

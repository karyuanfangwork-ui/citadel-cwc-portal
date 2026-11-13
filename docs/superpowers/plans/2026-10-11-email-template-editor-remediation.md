# Email Template Editor — Detailed Remediation Implementation Plan

Status: PROPOSED — plan only; no application code or database changes authorized by this document.
Baseline: branch `dev2.0`, commit `f781ffb6`; clean working tree before plan creation.
Source: screenshot and the preceding 17-finding Edit Email Template audit.

## 1. Goal and boundaries

Make editing safe, email enablement truthful, and preview/test behavior representative of production. Preserve administrator-managed templates and unrelated notification channels. Close every audit finding through source changes plus appropriate automated and runtime evidence.

In scope:
- Email Notifications settings list and edit/create dialog.
- Template API, validation, access control, tenant/global resolution, and persistence.
- Email rendering, draft preview, test transport reporting, and email-only suppression.
- Optimistic concurrency, revision history, and explicit restore.
- Accessibility, responsive behavior, error recovery, and focused/full verification.

Out of scope:
- Rewriting the whole notification library or workflow system.
- Bulk replacement of active template copy, global seeds, or restored local data.
- Production deployment, production data mutation, commit, or push without separate authorization.
- Enabling CRM/Credit workflows, changing business recipients, or implementing an SMS transport.
- Claims of inbox delivery from provider acceptance alone.

The editor is shared infrastructure. Keep contracts compatible for all existing callers; content remediation applies only to separately approved events/tenants. No default module-specific seed runs.

## 2. Evidence baseline and audit mapping

Evidence classes: S = source-confirmed; V = visible in supplied screenshot; R = requires authenticated runtime verification.

| ID | Finding | Evidence | Priority | Closure work |
|---|---|---|---|---|
| A01 | Destructive HTML-to-text round trip | S,V: EmailNotificationsTab.tsx:18–19,139,159–170 | P0 | W1,W2,W5 |
| A02 | CTA href/UUID removed | S: same conversion path | P0 | W1,W2,W5 |
| A03 | Disabled template may still send fallback email | S: notification.service.ts:288–340,431–450 | P0 | W3 |
| A04 | Test ignores unsaved draft; create cannot test | S: UI:194–197,518–528; controller:240–246 | P1 | W4,W5 |
| A05 | Plain-text input accepted as HTML | S: UI:159–164; controller:138–197 | P0 | W2 |
| A06 | Weak field/placeholder validation | S: UI:541; email.service.ts:84–90 | P0 | W2 |
| A07 | Test differs from production rendering/sample contracts | S: controller:251–290; notification.service.ts:300–339 | P1 | W2,W4 |
| A08 | Unsaved changes discarded | S: UI:149–152,433,532–537 | P1 | W5 |
| A09 | No resolved/branded preview or link checks | S: UI:438–551 | P1 | W4,W5 |
| A10 | Dialog/form/switch/live feedback a11y gaps | S; screen-reader outcome R | P1 | W5,W7 |
| A11 | Test recipient/acceptance messaging misleading | S: controller:292–302; email.service.ts:36–68 | P1 | W4 |
| A12 | No concurrent edit protection/history restore | S: controller:180–205 | P1 | W6 |
| A13 | Event map assumes uniqueness; scope not explicit | S: UI:71–74; schema:1680–1697 | P1 | W3,W6 |
| A14 | Template reads lack explicit management permission | S: notificationTemplate.routes.ts:7–19 | P0 | W2 |
| A15 | Recipient context below fold/third-person requester copy | S,V: UI:504–511; request.controller.ts:1397–1411 | P2 | W5 |
| A16 | Partial lower card visibility; overlap not established | V,R: UI:419,439,516 | P2 | W5,W7 |
| A17 | Metadata, variable help, feedback, responsiveness, save state | S,V; device behavior R | P2 | W5,W7 |

UI references mean `frontend/src/components/admin/EmailNotificationsTab.tsx`; controller references mean `backend/src/controllers/notificationTemplate.controller.ts`; service references mean `backend/src/services/`.

No authenticated browser save, scroll, or provider send was verified in the audit. The attempted local reproduction command did not execute. Do not record it as test evidence.

## 3. Decisions and safe defaults

### D1. Body format: preserve HTML, do not silently convert

Recommended release default: a labelled HTML-source editor with a safe rendered preview for existing HTML, plus an explicit plain-text authoring option for new templates. This is safer than dropping table-rich legacy content into a basic rich-text editor.

- Open existing templates with their exact stored HTML. Never use `stripHtml()` to initialize editable state.
- Subject-only and email-enabled-only updates omit `emailBody` entirely.
- Opening, previewing, canceling, or sending a draft test never mutates stored content.
- Plain text is escaped on the server before paragraph conversion. Blank-line behavior is explicit and tested.
- Switching existing HTML to plain text is an intentional action, shows a conversion diff and link-loss warning, and requires confirmation. Cancellation preserves the original draft.
- Rich-text UI can be a later phase only after table/link support and round-trip fixtures pass. Tiptap is installed, but a table extension is not present in the inspected manifest; do not assume it preserves existing email tables.

Decision gate: approve the source+preview first-release UX or explicitly approve a larger rich-text project. Do not block the immediate loss-prevention patch on this decision.

### D2. Enablement: separate email delivery from legacy template activity

Recommended contract: add `emailEnabled` to the selected template/configuration record, leaving legacy `isActive` behavior intact for non-email consumers.

- `isActive` remains the existing template-availability control, not the new email switch.
- Disabled email is an explicit policy result, not “no template found.” It must not fall through to global/fallback email.
- Unconfigured remains distinguishable from disabled; preserve current unconfigured fallback unless product approves changing it.
- Master off overrides event on; local UI displays effective status.
- IN_APP behavior must not change when email is switched off.
- Queue workers re-evaluate suppression before the provider call; record a stable cancellation reason.

Decision gate: inventory all consumers before choosing whether `emailEnabled` belongs on NotificationTemplate or a dedicated tenant/event configuration model. Default to NotificationTemplate only if one selected record per scope/event can be established safely. Otherwise use a dedicated uniquely scoped email policy; do not overload `isActive` again.

### D3. Scope and uniqueness

Resolve exact tenant override first, then global default explicitly. Do not rely on nullable PostgreSQL sort order for precedence. Evaluate disabled email before eligible-template fallback.

Tenant administrators edit their tenant override, not global defaults. Global templates are labelled read-only unless explicit platform authority is present. “Create tenant override” copies a default only on an explicit write. Existing multiple candidates are a conflict requiring review, not an arbitrary winner.

Do not use globally unique event-derived names for every tenant. Retain name identifiers for compatibility and define scoped names for new overrides after call-site inventory. Do not delete or merge duplicates automatically.

### D4. Validation versus legacy compatibility

Strictly validate new/changed content. Preserve untouched legacy HTML byte-for-byte; flag unsupported markup in preview rather than sanitizing stored templates implicitly. Existing unknown placeholders are surfaced as warnings on open; new/changed bodies or subjects must resolve the contract before save. Email-only disable must remain possible even when legacy content is invalid.

### D5. Tests, sends, and history

Preview is render-only and requires no send approval. Test-send requires explicit recipient confirmation and uses authenticated administrator identity; no arbitrary external recipient input by default. Development redirect is disclosed. Report provider acceptance, not inbox delivery.

Revisions contain sensitive template content. Use tenant-scoped authorization, restricted reads, retention policy, no ordinary logs/analytics containing body content, and compensating restore revisions rather than deleting history.

## 4. Ordered phases and release gates

Dependency chain:
W0 baseline → W1 loss-prevention → W2 content/access contract → W3 delivery/scope → W4 preview/test API → W5 editor UX → W6 history/concurrency → W7 integrated gates.

W6 concurrency design starts with W2 and lands before final editor release. Backend W3 and frontend shell work may proceed in parallel after contracts are frozen. Do not have independent implementers modify the same controller, service, or schema simultaneously.

| Phase | Deliverable | Release gate |
|---|---|---|
| 0 | Baseline, fixtures, tenant/consumer inventory | No secrets or live writes; unresolved data assumptions recorded |
| 1 | Safe edit/update path | No body mutation from open/cancel/no-op/subject/toggle save; links preserved |
| 2 | Validated, scoped email policy/rendering | Disabled means zero provider calls; IN_APP unchanged; read/write auth passes |
| 3 | Draft preview/test and complete editor | Draft parity, a11y, validation, conflict recovery, mobile layout pass |
| 4 | Revisions, restore and integrated release evidence | Atomic revision/audit/update; real SQL precedence; full affected suites pass |

Priority labels describe remediation urgency, not proof of an exploitable critical security incident. UI-only mitigations cannot close backend enforcement findings.

## 5. Work packages

### W0 — Baseline and contract discovery

Existing files:
- `backend/prisma/schema.prisma`
- `backend/src/lib/prisma.ts`, `backend/src/lib/execution-scope.ts`
- `backend/src/controllers/notificationTemplate.controller.ts`
- `backend/src/routes/notificationTemplate.routes.ts`
- `backend/src/services/notification.service.ts`, `email.service.ts`
- `backend/src/templates/email-layout.ts`
- `frontend/src/services/admin.service.ts`
- `frontend/src/components/admin/EmailNotificationsTab.tsx`

Tasks:
1. Search every template selection, mutation, seed/upsert, direct send, `isActive` consumer, permission consumer, and notification queue entry point. Trace execution scope through HTTP and worker paths.
2. Inventory template fields, scope, duplicate event candidates, global defaults, and legacy HTML structures read-only. Access live DB only through approved local/production mechanisms; never print connection credentials.
3. Add synthetic regression fixtures for table HTML, anchors containing UUID, entities, multiline text, unknown variables, malformed placeholders, and attempted injection. Synthetic fixtures are tests, not delivery evidence.
4. Extract a complete event contract registry with sample/required/optional variables and recipient descriptions; compare registry against producers and enrichment. Do not call the current static dictionary canonical until checked.
5. Verify backend test database isolation. Existing integration tests can share the restored dev DB; establish a dedicated test DB before database-writing suites. Do not run broad seeds to satisfy fixtures.

Acceptance: a reviewed consumer/scope inventory and repeatable read-only baseline. No duplicate cleanup or live template rewriting.

### W1 — Immediate loss-prevention patch (A01,A02)

Modify UI and typed update payload in `frontend/src/services/admin.service.ts`.

Tasks:
- Keep original subject, raw HTML, email state, and concurrency token as the edit baseline.
- Stop stripping HTML for editing. Relabel current content as HTML until the final authoring controls exist.
- Build a minimal patch from dirty fields; never include an unchanged body.
- Prevent no-op saves. Preserve draft values on API failures.
- Make all editing controls consistently disabled while the save is in flight; submit one immutable draft snapshot.

Proposed tests:
- `frontend/src/components/admin/__tests__/EmailNotificationsTab.test.tsx`
- `frontend/src/components/admin/email-templates/__tests__/draft.test.ts`

Acceptance: subject-only/toggle-only payload lacks emailBody; preserved HTML contains exact table and href bytes; open/cancel produces no write; repeated clicks do not submit twice.

### W2 — Server content, variable, and authorization contract (A05,A06,A07,A14)

Existing edits: controller, routes, email service, notification service, admin service types.
Proposed new files:
- `backend/src/validators/notificationTemplate.validator.ts`
- `backend/src/services/notificationTemplate.service.ts`
- `backend/src/services/notificationTemplate-render.service.ts`
- `backend/src/notifications/template-event.registry.ts`
- `backend/src/validators/__tests__/notificationTemplate.validator.test.ts`
- `backend/src/services/__tests__/notificationTemplate-render.service.test.ts`
- `backend/src/controllers/__tests__/notificationTemplate.controller.test.ts`

Tasks:
1. Use existing `validate()` middleware and Zod; validate UUID parameters, allowed fields/types, registered event types, booleans, format, version token, and non-empty authored email content.
2. Proposed limits pending inventory: subject 250 characters; body 100 KiB UTF-8; reject control/newline characters in subject. Count bytes server-side. Permit literal braces that are not template syntax, but report malformed `{{...}}` tokens.
3. Validate subject and body placeholders against the event contract. Required variable absence blocks preview/send; optional absence is explicit with safe fallback. Preserve untouched legacy content during unrelated patches.
4. Escape plain-text literals before HTML paragraphs. For intentional HTML edits, sanitize via installed `sanitize-html` with a documented email allowlist: basic headings/paragraphs/lists/emphasis/tables/anchors; bounded safe style properties; no scripts, handlers, forms, embedded frames, or executable schemes. Images/remote tracking blocked by default unless separately approved.
5. If sanitizer changes authored content, return diagnostics/normalized preview and require acknowledgement; never silently publish a materially altered body.
6. Preserve placeholders through sanitization. Validate link schemes and resolved URLs after interpolation. HTML escaping alone does not validate a URL; validate CTA destinations separately and retain route/UUID semantics.
7. Share variable enrichment/status labels and production HTML rendering between real sends and previews. Do not escape subjects as HTML. Keep trusted layout markup distinct from escaped variables.
8. Initially apply existing `workflow:manage` to template reads/preview as well as writes/tests. Inventory read consumers first; if a dedicated read permission is desired, seed/migrate it explicitly before enforcement.
9. Maintain server tenant enforcement. Global writes require explicit platform authority, not a tenant admin with a guessed ID. Update operation-control registry entries and affected authorization tests when routes are added/changed.

Acceptance: invalid payload returns structured field errors; markup/URL attacks rejected or safely normalized; legitimate tables/links render; subject escaping is correct; unauthorized and cross-tenant calls fail; read-only global defaults cannot be mutated by tenant admin.

### W3 — Email suppression, inheritance, and deterministic selection (A03,A13)

Existing edits: schema, template service/controller, notification service, typed frontend template/event state.
Proposed tests: `backend/src/services/__tests__/notificationTemplate-policy.test.ts`; extend existing `backend/src/services/__tests__/notification.service.test.ts`.

Tasks:
- Complete D2/D3 decision gates; create an additive migration for email-only policy and any approved scoped identity/index changes.
- Read-only preflight identifies inactive rows and their historic meaning. Do not blindly translate all inactive templates into a channel-wide disable; list ambiguity and require reviewed mapping.
- For unambiguous records, migrate intended email state without touching HTML, subjects, push fields, or recipients. Record original values in rollback snapshot.
- Resolve tenant/global and active/inactive cases explicitly. Do not allow a global fallback to override an explicit tenant email disable.
- Return one resolved editor context per event: source scope, editable override, effective email status, master-off reason, and conflict warning. Replace frontend last-row-wins mapping.
- At worker send boundary cancel suppressed EMAIL deliveries before provider invocation, with stable reason such as `EVENT_EMAIL_DISABLED`; check master switch independently. Preserve existing recipient reauthorization and claim/idempotency controls.
- Add duplicate constraints only after exact candidate review. For nullable global scope, use a reviewed migration strategy that enforces global uniqueness as well as tenant uniqueness; Prisma composite uniqueness alone does not make null scopes unique. Migrations are ignored by current Git rules: allowlist only approved new migrations, never abandon migration history or use production db push/reset.

Test matrix: master on/off × tenant override absent/on/off × global default absent/on/off × no template × duplicate conflict. Include queued retry disabled between attempts, enable after cancel (no automatic replay), no provider call when disabled, and IN_APP unchanged.

Acceptance: real PostgreSQL tests prove tenant-first/global-second semantics and duplicate constraints. Mock assertions about sort order are insufficient. Unconfigured fallback behavior is explicitly documented and tested.

### W4 — Render-only draft preview and explicit draft tests (A04,A07,A09,A11)

Proposed API contracts, final names to follow local conventions:
- `POST /admin/notification-templates/preview`: eventType, draft subject/body/format and server-issued editor version context; returns rendered subject, branded HTML, plain text, variable diagnostics, link diagnostics, effective policy, sample-data marker. No persistence or provider calls.
- `POST /admin/notification-templates/test-draft`: validated draft plus confirmation of authenticated-user destination; server recomputes effective recipient, including dev redirect, and rejects changed/unconfirmed destinations. Optional idempotency key for retry safety.
- Retain `POST /:id/test` compatibility as an explicitly saved-template test using the same render path. Never reinterpret old callers silently as draft sends.

Tasks:
- Frontend sends current draft to preview/test, including for create, rather than only saved template ID.
- Server owns sample fixtures; complete each registered event with representative values. Label samples and distinguish them from real producer contracts.
- Provide effective test destination before send through authenticated metadata/preview response; do not allow untrusted redirect or arbitrary recipient selection.
- Show whether event/master policy suppresses real notifications. Explicit diagnostic test override is permitted only as an authorized user-confirmed test and labelled accordingly; never silently bypass the production gate.
- Transport returns structured result: accepted/failed/skipped, actual recipient, redirection indicator, provider message ID when available. Do not expose API keys or log message bodies. Preserve existing sendEmail callers via an additive detailed helper or carefully tested compatibility wrapper.
- Rate-limit test sends specifically, prevent duplicate submissions, and audit test action metadata without template bodies.
- Preview in sandboxed iframe without scripts/forms/popups/top-navigation; block automatic external resources/trackers. Links inspectable rather than navigating automatically. Treat preview HTML as untrusted even when server-normalized.

Acceptance: draft changes appear in preview/test without save; no DB writes on preview/test; test uses production HTML escaping/layout/status labels; full sample-variable coverage; failure keeps draft; real test send requires exact recipient authorization. “Accepted” is not “delivered.”

### W5 — Editor UX, accessibility, and responsive behavior (A08,A09,A10,A15,A16,A17)

Existing edits: EmailNotificationsTab, admin service.
Existing accessible base: `frontend/src/components/ModalWrapper.tsx` uses FocusTrap, portal, dialog semantics, Escape, scroll lock, and focus restoration. Its current layout scrolls the entire panel; verify suitability before adding narrowly scoped optional header/body/footer slots. Do not regress other modal consumers.

Proposed new components:
- `frontend/src/components/admin/email-templates/EmailTemplateEditor.tsx`
- `frontend/src/components/admin/email-templates/TemplateBodyEditor.tsx`
- `frontend/src/components/admin/email-templates/TemplatePreview.tsx`
- `frontend/src/components/admin/email-templates/TemplateVariables.tsx`
- `frontend/src/components/admin/email-templates/useTemplateDraft.ts`

Tasks:
1. Header shows human-readable event name, category as metadata (not fake tabs), raw event ID as secondary detail, recipient, tenant/default scope, and effective email status.
2. Separate authoring and preview with actual accessible tabs or desktop split layout. Default existing HTML to source+preview; new plain-text drafts start with event-specific defaults, not request-only placeholders for every event.
3. Toggle labelled “Email notifications for this event”; use `role=switch`, `aria-checked`, stable accessible name, and pending state. Display “Paused by master setting” when applicable.
4. Associate field labels/help/errors via IDs, aria-describedby/aria-invalid; focus first invalid field; provide live-region result/error feedback.
5. Display validation, variable diagnostics, and link destinations. Variable chips insert into last active subject/body field at saved selection, preserve caret/focus; separate Copy action awaits clipboard and handles rejection. Provide descriptions, examples, and required/optional flags.
6. Dirty guard covers X, Cancel, Escape, backdrop, route navigation, and browser unload where supported. Nested confirmation must have correct focus behavior and stacking; do not reuse the current generic ConfirmDialog without addressing its missing focus semantics.
7. Distinct draft test confirmation shows recipient and redirects. Preview requests are debounced and stale responses discarded. Do not announce success before awaited work.
8. All mutations disabled consistently in flight; testing and saving cannot race. Failure preserves content and enables retry; save success refreshes the exact record/version before treating draft as clean.
9. Responsive panel uses viewport-bounded flex layout, `min-h-0` scrolling body, non-overlapping footer, small-screen stacking, and minimum usable touch targets. Body/source textarea resizable or expandable. Keep recipient/status near top rather than hidden after variable chips.
10. Copy recommendation for REQUEST_CREATED: direct requester confirmation (“Your request has been submitted”). Change canonical defaults only after verifying event contract; do not rewrite existing admin content automatically.

Acceptance: keyboard-only lifecycle works; dirty discard requires confirmation; viewport/zoom matrix passes; user can scroll to every section; preview and footer remain usable; no accessibility violation introduced in sibling ModalWrapper consumers.

### W6 — Optimistic concurrency and revision/restore (A12,A13)

Existing edits: schema, template service/controller/routes, UI/admin service, audit utility integration.
Proposed models/endpoints/tests:
- Add explicit template version integer (preferred over timestamp precision dependence).
- Add tenant-scoped append-only NotificationTemplateRevision with parent ID, revision number, actor ID, changed fields, prior/new content or immutable snapshot, timestamp, and restore-source revision reference.
- `GET /:id/revisions`; `POST /:id/restore` with target revision and expectedVersion.
- `backend/src/services/__tests__/notificationTemplate-history.test.ts`
- `frontend/src/components/admin/email-templates/__tests__/TemplateHistory.test.tsx`

Tasks:
- Updates, toggles, overrides, and restore use compare-and-swap against expectedVersion and scope; success increments version exactly once.
- Write template update, revision, and audit in one transaction. Verify whether audit utility accepts transaction client; add a compatible path if necessary. Audit failure must roll back the template update.
- Initial revision capture is additive and preserves original HTML; do not invent historic authors or timestamps.
- 409 conflict includes safe reload context. UI offers compare/reload while preserving the unsaved local draft; never automatically overwrite newer content.
- History UI displays timestamp, actor, changed fields and safe diff; restore requires confirmation and current-version match. Validate restored content under current security policy; unsupported old content cannot bypass sanitization through restore.
- List/create overrides are protected by scope-aware uniqueness and transaction handling, including concurrent create conflict.

Acceptance: simultaneous edits yield one winner and one 409; audit/revision failure causes no partial write; restore produces a new revision, not deletion; cross-tenant history/restore is denied; subject-only update leaves body untouched.

### W7 — Integrated verification and closure (all findings)

Proposed E2E files matching existing configured projects:
- `frontend/e2e/smoke/email-template-editor.smoke.spec.ts`
- `frontend/e2e/a11y/email-template-editor.a11y.spec.ts`

Automated suites:
- Backend validator/controller/auth, render policy, suppression worker, tenant/global real SQL, CAS/history, and existing notification/email-layout regression tests.
- Frontend edit/create draft, dirty guard, field errors, clipboard failure, insertion, async race handling, conflict recovery, preview/test confirmation, and sibling modal regression tests.
- E2E default: mocked provider, test-only tenant/DB, no real recipients. Keep mocked UI wiring evidence separate from real API/persistence evidence.

Manual/runtime matrix:
| Scenario | Required evidence |
|---|---|
| Existing rich HTML: open, subject edit, save, reload | Exact body equality, table/CTA preservation, exact API readback |
| Plain text including `<`, `&`, blank lines | Preview + stored normalized HTML + escaped output |
| New template preview/test without save | No new row; current draft rendered; explicit sample marker |
| Master/event off, tenant/global inheritance | Worker cancellation/no provider call; IN_APP remains visible |
| Duplicate/conflicting scope | Visible conflict, no arbitrary template edit |
| Two admins edit same template | 409; preserved local draft; reload/compare recovery |
| Save/test failure and timeout | No lost draft; no double send from blind retry |
| X/Cancel/Escape/backdrop/navigation | Dirty guard + focus restoration |
| Viewports 360×740, 390×844, 768×1024, 1280×577, 1440×900 | All fields/footer accessible; no horizontal overflow/hidden recipient |
| Browser zoom 200% | Scroll and action access; field label/error readability |
| Keyboard + VoiceOver | Focus trap, switch state, fields, tabs, live errors, nested confirmation |
| Approved actual provider test | Confirmed recipient, provider acceptance ID, redirection truth; optional inbox evidence separately |

The screenshot's alleged footer overlap closes only after measured DOM geometry and scroll-to-bottom verification; source changes alone cannot prove it.

## 6. Verification commands and evidence rules

Run from package roots. Commands are future execution gates, not completed test results.

Backend focused (adjust file list to implemented names):
- `npm test -- --runTestsByPath src/validators/__tests__/notificationTemplate.validator.test.ts src/services/__tests__/notificationTemplate-render.service.test.ts src/services/__tests__/notificationTemplate-policy.test.ts src/services/__tests__/notificationTemplate-history.test.ts src/controllers/__tests__/notificationTemplate.controller.test.ts src/services/__tests__/notification.service.test.ts`
- `npm run build`
- `npm run lint` (separate pre-existing from task-introduced failures)
- `npx prisma validate` and `npm run prisma:generate` when schema changes.
- Replay migrations against an isolated disposable/test DB; no production reset/db push.
- `npm test` after focused tests pass and test DB isolation is proven. Do not use `test:release` here; it contains a broad credit seed.

Frontend:
- `npm test -- src/components/admin/__tests__/EmailNotificationsTab.test.tsx src/components/admin/email-templates`
- `npx tsc --noEmit`
- `npm run build`
- `npm test`
- `npx playwright test --project=smoke email-template-editor.smoke.spec.ts`
- `npx playwright test --project=a11y email-template-editor.a11y.spec.ts`

Repository:
- `git diff --check`; inspect task-owned diff and working tree.
- Confirm approved migration files and source-of-truth plan are tracked/allowlisted.

Record command, environment, exit code, suite/test counts, failures, skips and warnings. Full-suite open-handle warnings, baseline data failures, auth blockers, and skipped manual checks remain explicit. A green mock suite is not evidence of real DB semantics or delivery. No credentials/device/session tokens in artifacts.

## 7. Rollout, migration, and rollback

1. Ship W1 safety patch independently if feasible; keep rendering/content changes backward-compatible.
2. Before schema/content rollout, read-only inventory and backup of exact target rows plus database backup according to environment policy. Prove local host before local writes; production requires separate approval and restore evidence.
3. Produce exact migration dry-run mapping for email policy and duplicate review. Abort on ambiguous rows, unexpected IDs/counts, or concurrent drift. Apply reviewed targets transactionally, then read back every field.
4. Add schema before new application usage. Coordinate API/frontend/worker versions so an old worker cannot ignore new email-disable policy; drain/pause or upgrade all relevant workers during activation. Master pause is a temporary mitigation only with explicit operator approval.
5. Verify live authorized readback, rendered preview, disabled-event worker behavior, in-app channel, and site/API health. Do not automatically replay canceled emails.
6. Roll back application changes only when compatible with additive schema. Preserve new columns/revision records rather than destructive down migrations. For policy failure, pause affected email delivery and fix forward; reverting to old worker logic may re-enable disabled emails and is not a safe default.
7. Restore template content only from reviewed snapshot/revision with CAS and compensating audit. Never overwrite broad tenant/global customization or run a general seed.
8. No deployment, real test email, commit, or push is implied by approval of this plan.

## 8. Ownership, sizing, and completion tracking

Suggested ownership: backend lead owns contracts/render/policy/auth/history; frontend lead owns editor/a11y; QA owns isolated integration/E2E/manual evidence; maintainer owns data review and deployment approval. Assign actual people before execution.

Relative size (not calendar promises): W0 small; W1 small; W2 large; W3 large; W4 medium; W5 large; W6 large; W7 medium. Rich-text authoring beyond source+preview adds a separate project. Tenant ambiguity/data cleanup can block migration independently of code completion.

| Work | Status | Evidence to close |
|---|---|---|
| W0 | NOT STARTED | Consumer/scope inventory, fixtures, test DB gate |
| W1 | NOT STARTED | Loss-prevention frontend tests and exact HTML readback |
| W2 | NOT STARTED | Validation, rendering, URL safety, read/write auth |
| W3 | NOT STARTED | Suppression matrix + real SQL scope behavior |
| W4 | NOT STARTED | Draft parity, no writes, confirmed effective recipient |
| W5 | NOT STARTED | Editor tests, accessibility, responsive/runtime evidence |
| W6 | NOT STARTED | CAS/atomic history/restore and scope tests |
| W7 | NOT STARTED | Focused/full gates and remaining manual evidence |

Definition of done:
- Every A01–A17 has a linked test/result or a clearly recorded unresolved manual gate.
- Untouched HTML and CTA links survive editing, including subject/toggle-only updates.
- Event disable prevents actual EMAIL provider calls and never changes IN_APP behavior.
- Saved and draft rendering share production contracts; test destination/status claims are truthful.
- Validation, auth, scope, uniqueness, conflict recovery and atomic history hold at backend boundaries.
- Keyboard, screen-reader, zoom, short viewport and mobile checks are performed, not inferred.
- Exact persisted targets are read back after writes; all test/build outcomes reported honestly.
- No bulk template overwrite, unrelated module activation, credentials exposure, or unauthorized production action.

## 9. Product/maintainer approvals still required

1. Source+preview first release versus a larger fully lossless rich-text editor.
2. Email-only policy location after consumer/duplicate inventory; migration meaning of historic inactive rows.
3. Preserve current unconfigured fallback versus deliberately suppress unconfigured events.
4. Platform-only global editing and whether a separate template-read permission is needed.
5. Approved URL hosts/schemes, remote images policy, content size limits and revision retention.
6. Whether diagnostics may explicitly test a disabled event; exact test recipient/send authorization.

Safe defaults above allow non-destructive implementation to proceed without guessing these operational approvals. This plan is not implementation or production-readiness certification.

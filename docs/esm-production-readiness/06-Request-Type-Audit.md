# Request Type and Service Catalog Audit

## Verdict

**Partial — High risk — P0/P1 — Not production-ready.** The catalog hierarchy, form builder, entitlement records, lifecycle metadata and form snapshots are strong foundations. Runtime validation/visibility is not consistently tied to canonical request-type policy, required dynamic fields can be bypassed, conditional rendering is not wired into the form runtime, and future departments require hardcoded frontend/backend changes.

## Capability matrix

| Capability | Current implementation | Status | Risk | Priority | Effort | Ready |
|---|---|---|---|---|---|---|
| Categories | ServiceDesk → ServiceCategory | Implemented | Medium | P1 | Medium | Conditional |
| Subcategories | No independent third hierarchy level | Missing/Optional | Low | P3 | Medium | Conditional |
| Request types | DB model with code, workflow, SLA, form config | Implemented | High | P1 | Medium | No |
| Dynamic forms | JSON config and builder | Partial | High | P0 | Medium | No |
| Validation | Zod base request + partial server form validation | Partial | Critical | P0 | Large | No |
| Conditional fields | Utilities/builder concepts; not wired into StepDetails | Fail | High | P1 | Medium | No |
| Mandatory fields | HTML required only on mounted step; submit bypass | Fail | Critical | P0 | Medium | No |
| Department visibility | CatalogEntitlement exists but central tenant scope omits it | Fail | Critical | P0 | Large | No |
| Request templates | Request types/form config and recent services | Partial | Medium | P2 | Medium | No |
| Knowledge mapping | No governed request-type ↔ KB recommendation mapping | Missing | Medium | P2 | Large | No |
| Automation | Workflow/entity/assignment hooks | Partial | High | P1 | Large | No |
| Form versioning | `formConfigVersion` and request snapshot | Strong | Low | P3 | Small | Yes, subject to tests |
| Catalog lifecycle | Governance metadata/admin controls | Partial | Medium | P1 | Medium | No |
| Future departments | Desk table dynamic, presentation/policy hardcoded | Fail | High | P1 | Large | No |

## Findings

| ID | Current implementation | Expected enterprise implementation | Business impact | Security impact | Risk | Priority | Effort | Owner |
|---|---|---|---|---|---|---|---|---|
| RT-01 | Wizard trusts independent desk/category/type URL IDs | Server resolves canonical type→category→desk and verifies entitlement | Wrong workflow/classification | Cross-desk/confidentiality bypass | Critical | P0 | Medium | Frontend/Backend |
| RT-02 | HR confidentiality derived from URL desk slug | Sensitivity/classification defined on request type and enforced server-side | Misclassified HR cases | Sensitive data exposure | Critical | P0 | Medium | Product Security |
| RT-03 | `canProceed` does not validate required dynamic fields; final submit occurs after form unmount | Shared schema validates visible required fields on Next and Submit | Incomplete requests, broken fulfilment | Validation bypass | Critical | P0 | Medium | Frontend/Backend |
| RT-04 | Conditional-rule evaluator has no runtime use | Evaluate typed conditions client/server; clear/ignore hidden values | Incorrect forms | Hidden-field manipulation | High | P1 | Medium | Forms Team |
| RT-05 | CatalogEntitlement has tenantId but is absent Prisma scope set | Central tenant/department policy and DB/RLS ownership | Cross-tenant catalog configuration | Isolation bypass | Critical | P0 | Medium | Backend/DB |
| RT-06 | Entitlements are visibility hints, not universal create authorization | Re-check entitlement at GET list/detail and POST create | Unauthorized service use | Function authorization failure | High | P0 | Medium | Catalog/IAM |
| RT-07 | Request create accepts desk and type independently | FK relationship and policy validation in one transaction | Wrong reference/SLA/workflow | Policy confusion | High | P0 | Small | Backend |
| RT-08 | Form JSON is weakly typed and business data enters generic `customFields` | Versioned JSON schema with field IDs/types/constraints and migration rules | Reporting/data-quality debt | Mass assignment/type confusion | High | P1 | Large | Product/Data |
| RT-09 | Workflow, form and request-type publication are not an immutable release unit | Versioned catalog-item package with effective dates and rollback | Live edits affect cases | Governance/audit weakness | High | P1 | XLarge | Product Architecture |
| RT-10 | Knowledge mapping absent | Versioned related-article rules and entitlement-aware suggestions | Lower deflection | Possible article leakage if naive | Medium | P2 | Large | Knowledge Product |
| RT-11 | Desk labels/colors/confidentiality are hardcoded for three desks | Metadata-driven presentation and policy for future desks | Expansion requires deployment | New desk may inherit unsafe defaults | High | P1 | Large | Frontend/Product |
| RT-12 | Server form/version tests currently fail due runner drift | Green integration tests against current schema | No release confidence | Control regression undetected | High | P0 | Medium | QA |
| RT-13 | No reusable field library/data-classification metadata | Governed field definitions, PII class, retention, masking, export rules | Duplicate/inconsistent forms | Sensitive-field mishandling | Medium | P2 | Large | Data Governance |
| RT-14 | No service bundle/order guide | Optional enterprise bundle model for onboarding/procurement | Manual multi-request work | Low | Low | P3 | Large | Product |
| RT-15 | Request-type code has hardcoded controller branches | Pluggable/versioned behavior mapping | Every new desk needs code | Authorization behavior divergence | High | P1 | XLarge | Architecture |

## Required request creation sequence

1. Client sends only canonical `requestTypeId`, form version and values—not trusted desk/category policy.
2. Server resolves tenant-owned type, published version, desk/category, entitlement, classification, workflow, SLA and form schema.
3. Server evaluates conditional visibility and validates only allowed visible fields while rejecting unknown/protected fields.
4. Server stores immutable snapshots of form, classification, workflow version, SLA policy and entitlement decision.
5. Request, initial workflow instance, approvals, audit and outbox are committed transactionally.

## Acceptance gate

- Property/relationship fuzzing proves mismatched desk/category/type IDs are rejected.
- Role×department×entity catalog tests prove list/detail/create enforcement.
- Required/conditional/server-client parity tests cover every field type and malicious hidden values.
- Published versions are immutable and in-flight requests remain reproducible.
- New Procurement test desk can be configured without code changes and is isolated by default.

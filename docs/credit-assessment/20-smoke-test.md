# 20 — Smoke Test (E2E)

> Sprint 6 — Credit Assessment Module  
> Last updated: 2026-05-18

---

## 1. Overview

This document defines the manual smoke test checklist for the credit module. It covers the full application lifecycle, RBAC verification, edge cases, pagination, feature flags, and SOD constraints.

Tests are designed to be run by QA or developers against a staging environment with realistic seed data.

---

## 2. Full Lifecycle Test

The primary smoke test: walk a credit application from creation through disbursement.

### Prerequisites

- Test user accounts exist for each role: ADMIN, CREDIT_ADMIN, CREDIT_MANAGER, CREDIT_SENIOR, CREDIT_RM, CREDIT_ANALYST, CREDIT_COMMITTEE, END_USER
- Feature flag `credit:module` is enabled
- All sub-capability feature flags are enabled (if sub-flag middleware is implemented)

### Step-by-step lifecycle

#### Step 1: Create Borrower

```
POST /api/v1/credit/borrowers
Authorization: Bearer <CREDIT_RM_TOKEN>
Body: {
  "firstName": "Smoke",
  "lastName": "Test",
  "email": "smoke.test@example.com",
  "phone": "+1234567890",
  "type": "INDIVIDUAL",
  "identification": { "type": "PASSPORT", "number": "SMOKE001" }
}

Expect: 201 Created
Note the borrowerId from response.
```

- [ ] Status 201
- [ ] Response contains valid `borrowerId`
- [ ] Borrower appears in GET list
- [ ] Duplicate identification number returns 409 Conflict

#### Step 2: Create Application

```
POST /api/v1/credit/applications
Authorization: Bearer <CREDIT_RM_TOKEN>
Body: {
  "borrowerId": "<borrowerId>",
  "productType": "TERM_LOAN",
  "requestedAmount": 500000,
  "requestedTenure": 12,
  "purpose": "Working capital"
}

Expect: 201 Created
Note the applicationId from response.
```

- [ ] Status 201
- [ ] Response contains valid `applicationId`
- [ ] Application status is `DRAFT`

#### Step 3: Submit Application

```
PATCH /api/v1/credit/applications/:applicationId/submit
Authorization: Bearer <CREDIT_RM_TOKEN>

Expect: 200 OK
```

- [ ] Status 200
- [ ] Application status transitions to `SUBMITTED` or `PENDING_KYC`

#### Step 4: KYC Review

```
PATCH /api/v1/credit/applications/:applicationId/kyc-review
Authorization: Bearer <CREDIT_ANALYST_TOKEN> or <CREDIT_MANAGER_TOKEN>
Body: {
  "status": "APPROVED",
  "notes": "KYC verified - all documents in order"
}

Expect: 200 OK
```

- [ ] Status 200
- [ ] Application status transitions to `KYC_APPROVED` or `PENDING_UNDERWRITING`

#### Step 5: Underwriting / Financial Spreading

```
POST /api/v1/credit/applications/:applicationId/spreading
Authorization: Bearer <CREDIT_ANALYST_TOKEN>
Body: {
  "financialStatementId": "<statementId>",
  "spreadingData": { ... }
}

Expect: 201 Created
```

- [ ] Status 201
- [ ] Spreading data is saved and linked to the application

#### Step 6: Scoring

```
POST /api/v1/credit/applications/:applicationId/score
Authorization: Bearer <CREDIT_MANAGER_TOKEN>

Expect: 200 OK
```

- [ ] Status 200
- [ ] Score result is returned with risk rating
- [ ] Application status transitions to `PENDING_COMMITTEE` or similar

#### Step 7: Committee Review & Vote

```
POST /api/v1/credit/applications/:applicationId/committee/vote
Authorization: Bearer <CREDIT_COMMITTEE_TOKEN>
Body: {
  "decision": "APPROVE",
  "comments": "Risk acceptable"
}

Expect: 200 OK
```

- [ ] Status 200
- [ ] Vote is recorded
- [ ] If all committee members vote approve, application moves to `APPROVED`

#### Step 8: Approval

```
PATCH /api/v1/credit/applications/:applicationId/approve
Authorization: Bearer <CREDIT_MANAGER_TOKEN> (different from RM who submitted)

Expect: 200 OK
```

- [ ] Status 200
- [ ] Application status transitions to `APPROVED`

#### Step 9: Conditions

```
POST /api/v1/credit/applications/:applicationId/conditions
Authorization: Bearer <CREDIT_MANAGER_TOKEN>
Body: {
  "conditions": [
    { "type": "PRECEDENT", "description": "Submit audited financials" },
    { "type": "PRECEDENT", "description": "Provide collateral valuation report" }
  ]
}

Expect: 201 Created
```

- [ ] Status 201
- [ ] Conditions are created and linked to the application

Mark conditions as fulfilled:

```
PATCH /api/v1/credit/applications/:applicationId/conditions/:conditionId/fulfill
Authorization: Bearer <CREDIT_MANAGER_TOKEN>

Expect: 200 OK
```

- [ ] Condition status transitions to `FULFILLED`

#### Step 10: Disbursement

```
POST /api/v1/credit/applications/:applicationId/disburse
Authorization: Bearer <CREDIT_ADMIN_TOKEN>

Expect: 200 OK
```

- [ ] Status 200
- [ ] Application status transitions to `DISBURSED`
- [ ] Disbursement record is created with amount and date

---

## 3. RBAC Verification Tests

For each role, verify access to representative endpoints.

### 3.1 ADMIN

| Test | Method | Endpoint | Expect |
|---|---|---|---|
| Read borrowers | GET | `/api/v1/credit/borrowers` | 200 |
| Create borrower | POST | `/api/v1/credit/borrowers` | 201 |
| Delete borrower | DELETE | `/api/v1/credit/borrowers/:id` | 200 |
| Approve application | PATCH | `/api/v1/credit/applications/:id/approve` | 200 |
| Export data | GET | `/api/v1/credit/export` | 200 |
| Manage feature flags | PATCH | `/api/v1/credit/feature-flags/credit:module` | 200 |

### 3.2 CREDIT_ADMIN

Same expectations as ADMIN for all endpoints above.

- [ ] All ADMIN tests pass for CREDIT_ADMIN

### 3.3 CREDIT_MANAGER

| Test | Method | Endpoint | Expect |
|---|---|---|---|
| Read borrowers | GET | `/api/v1/credit/borrowers` | 200 |
| Create borrower | POST | `/api/v1/credit/borrowers` | 201 |
| Delete borrower | DELETE | `/api/v1/credit/borrowers/:id` | **403** |
| Approve application | PATCH | `/api/v1/credit/applications/:id/approve` | 200 |
| Export data | GET | `/api/v1/credit/export` | **403** |

### 3.4 CREDIT_SENIOR

Same expectations as CREDIT_MANAGER.

- [ ] All CREDIT_MANAGER tests pass for CREDIT_SENIOR

### 3.5 CREDIT_RM

| Test | Method | Endpoint | Expect |
|---|---|---|---|
| Read borrowers | GET | `/api/v1/credit/borrowers` | 200 |
| Create borrower | POST | `/api/v1/credit/borrowers` | 201 |
| Delete borrower | DELETE | `/api/v1/credit/borrowers/:id` | **403** |
| Approve application | PATCH | `/api/v1/credit/applications/:id/approve` | **403** |
| Export data | GET | `/api/v1/credit/export` | **403** |

### 3.6 CREDIT_ANALYST

Same expectations as CREDIT_RM.

- [ ] All CREDIT_RM tests pass for CREDIT_ANALYST

### 3.7 CREDIT_COMMITTEE

| Test | Method | Endpoint | Expect |
|---|---|---|---|
| Read borrowers | GET | `/api/v1/credit/borrowers` | 200 |
| Create borrower | POST | `/api/v1/credit/borrowers` | **403** |
| Delete borrower | DELETE | `/api/v1/credit/borrowers/:id` | **403** |
| Committee vote | POST | `/api/v1/credit/applications/:id/committee/vote` | 200 |
| Export data | GET | `/api/v1/credit/export` | **403** |

### 3.8 END_USER

| Test | Method | Endpoint | Expect |
|---|---|---|---|
| Read own data | GET | `/api/v1/credit/applications?filter[mine]=true` | 200 |
| Create borrower | POST | `/api/v1/credit/borrowers` | **403** |
| Delete borrower | DELETE | `/api/v1/credit/borrowers/:id` | **403** |
| Approve application | PATCH | `/api/v1/credit/applications/:id/approve` | **403** |
| Export data | GET | `/api/v1/credit/export` | **403** |

---

## 4. Edge Case Tests

### 4.1 Duplicate Application

```
POST /api/v1/credit/applications
Authorization: Bearer <CREDIT_RM_TOKEN>
Body: {
  "borrowerId": "<borrowerId>",
  "productType": "TERM_LOAN",
  "requestedAmount": 500000,
  "requestedTenure": 12
}

POST /api/v1/credit/applications  (same borrower, same product, same amount)
Authorization: Bearer <CREDIT_RM_TOKEN>
Body: { ... identical ... }

Expect: 409 Conflict
```

- [ ] Second application with identical key fields returns 409
- [ ] Error message is descriptive (e.g., "Duplicate application exists for this borrower and product")

### 4.2 Concurrent Approval (Optimistic Locking)

```
Step A: GET /api/v1/credit/applications/:id  → note version = 3

Step B (User 1):
PATCH /api/v1/credit/applications/:id/approve
Body: { "version": 3 }

Step C (User 2 — concurrent):
PATCH /api/v1/credit/applications/:id/approve
Body: { "version": 3 }

Expect: First request → 200 OK
Expect: Second request → 409 Conflict (version mismatch)
```

- [ ] First approval succeeds
- [ ] Second approval with stale version returns 409
- [ ] Error message: "Conflict: application has been modified by another user. Please refresh and retry."

### 4.3 Invalid State Transitions

```
Attempt to approve a DRAFT application (not yet submitted):

PATCH /api/v1/credit/applications/:id/approve
Authorization: Bearer <CREDIT_MANAGER_TOKEN>

Expect: 400 Bad Request or 422 Unprocessable Entity
Error message should be descriptive:
  "Cannot approve application in DRAFT status. Application must be in PENDING_APPROVAL status."
```

- [ ] Invalid transition returns 400 or 422
- [ ] Error message clearly states current status and required status
- [ ] Other invalid transitions also fail:
  - [ ] Disburse an application that is not APPROVED → error
  - [ ] Mark conditions fulfilled on a REJECTED application → error
  - [ ] Submit an already SUBMITTED application → error

### 4.4 Not Found

```
GET /api/v1/credit/applications/nonexistent-id
Expect: 404 Not Found
```

- [ ] Invalid/nonexistent ID returns 404

### 4.5 Validation Errors

```
POST /api/v1/credit/borrowers
Body: { "firstName": "" }  (empty required field)

Expect: 400 Bad Request
Error message should validate required fields
```

- [ ] Missing required fields return 400 with validation messages

---

## 5. Pagination Tests

### 5.1 Default Pagination

```
GET /api/v1/credit/borrowers
Expect: 200 with default pagination (limit=20, offset=0)
Response includes: { data: [...], meta: { total, page, limit } }
```

- [ ] Default limit is applied
- [ ] Response includes total count

### 5.2 Custom Pagination

```
GET /api/v1/credit/borrowers?limit=50&offset=100
Expect: 200 with 50 results, starting from offset 100
```

- [ ] Custom limit and offset work correctly

### 5.3 Limit Capping

```
GET /api/v1/credit/borrowers?limit=500
Expect: 200 with limit capped at 100
Response meta.limit should show 100, not 500
```

- [ ] Limit > 100 is capped to 100
- [ ] No more than 100 results are returned
- [ ] Meta reflects the capped limit

### 5.4 Negative/Zero Limit

```
GET /api/v1/credit/borrowers?limit=0
Expect: 200 with empty data array, OR 400 validation error
```

- [ ] System handles zero or negative limit gracefully

---

## 6. Feature Flag Tests

### 6.1 Disable Master Toggle

```
PATCH /api/v1/credit/feature-flags/credit:module
Authorization: Bearer <ADMIN_TOKEN>
Body: { "enabled": false }

Wait for flag change to take effect.
```

Then test:

- [ ] `GET /api/v1/credit/borrowers` → **403** (feature not enabled)
- [ ] `GET /api/v1/credit/applications` → **403**
- [ ] `POST /api/v1/credit/borrowers` → **403**
- [ ] All `/api/v1/credit/**` routes return 403

### 6.2 Re-enable Master Toggle

```
PATCH /api/v1/credit/feature-flags/credit:module
Authorization: Bearer <ADMIN_TOKEN>
Body: { "enabled": true }
```

- [ ] All credit routes return to normal (200/201/etc.)

### 6.3 Sub-Capability Flags (after enhancement)

```
PATCH /api/v1/credit/feature-flags/credit:borrowers
Authorization: Bearer <ADMIN_TOKEN>
Body: { "enabled": false }
```

- [ ] `GET /api/v1/credit/borrowers` → **403**
- [ ] `GET /api/v1/credit/applications` → **200** (unaffected)
- [ ] Other sub-routes continue to work normally

```
PATCH /api/v1/credit/feature-flags/credit:borrowers
Authorization: Bearer <ADMIN_TOKEN>
Body: { "enabled": true }
```

- [ ] Borrowers routes return to normal

### 6.4 Feature Flag API Access

- [ ] Non-admin user calling `PATCH /api/v1/credit/feature-flags/credit:module` → **403**
- [ ] Admin user calling `GET /api/v1/credit/feature-flags` → **200** with all 11 flags
- [ ] Patching nonexistent flag key → **404**

---

## 7. SOD (Segregation of Duties) Tests

### 7.1 RM Cannot Approve Own Application

```
1. Login as CREDIT_RM (User A)
2. Create a borrower
3. Create an application (RM is the creator/assignee)
4. Submit the application
5. Attempt: PATCH /api/v1/credit/applications/:id/approve
   Authorization: Bearer <USER_A_TOKEN>

Expect: 403 Forbidden
Message: "Cannot approve own application — SOD constraint"
```

- [ ] RM cannot approve an application they created
- [ ] Error message clearly states SOD constraint

### 7.2 Different User Can Approve

```
1. Login as CREDIT_MANAGER (User B)
2. Call: PATCH /api/v1/credit/applications/:id/approve
   (where :id is the application created by RM User A)

Expect: 200 OK
```

- [ ] Different user can approve the application

### 7.3 Maker-Checker Violation

```
1. Login as CREDIT_RM (User A)
2. Submit application (User A is the submitter)
3. Attempt to approve same application (User A)

Expect: 403 Forbidden
Message: "Maker-checker violation: submitter cannot also approve"
```

- [ ] Submitter cannot also be the approver
- [ ] Error message clearly states maker-checker constraint

### 7.4 Admin Bypasses SOD

```
1. Login as ADMIN
2. Create and submit an application as admin
3. Approve the same application as admin

Expect: 200 OK (admin can bypass SOD)
```

- [ ] ADMIN can approve own application (bypass)
- [ ] Audit log records the SOD bypass

---

## 8. Document Upload & Virus Scan

### 8.1 Clean File Upload

```
POST /api/v1/credit/applications/:id/documents
Authorization: Bearer <CREDIT_RM_TOKEN>
Body: FormData { file: clean_test.pdf }

Expect: 201 Created
Document metadata is stored, file is in storage
```

- [ ] Clean file uploads successfully

### 8.2 Infected File Upload (if ClamAV is running and test EICAR file is available)

```
POST /api/v1/credit/applications/:id/documents
Authorization: Bearer <CREDIT_RM_TOKEN>
Body: FormData { file: eicar_test.txt }

Expect: 400 Bad Request
Message: "File failed virus scan"
```

- [ ] Infected file is rejected
- [ ] File is not stored

---

## 9. Smoke Test Results Template

```
=== Credit Module Smoke Test ===
Date: _______________
Environment: _______________
Tester: _______________

LIFECYCLE:
 [ ] Create Borrower
 [ ] Create Application
 [ ] Submit Application
 [ ] KYC Review
 [ ] Underwriting/Spreading
 [ ] Scoring
 [ ] Committee Vote
 [ ] Approval
 [ ] Conditions
 [ ] Disbursement

RBAC (8 roles × 5+ endpoints each):
 [ ] ADMIN
 [ ] CREDIT_ADMIN
 [ ] CREDIT_MANAGER
 [ ] CREDIT_SENIOR
 [ ] CREDIT_RM
 [ ] CREDIT_ANALYST
 [ ] CREDIT_COMMITTEE
 [ ] END_USER

EDGE CASES:
 [ ] Duplicate application (409)
 [ ] Concurrent approval (409)
 [ ] Invalid state transitions (400/422)
 [ ] Not found (404)
 [ ] Validation errors (400)

PAGINATION:
 [ ] Default pagination works
 [ ] Custom pagination works
 [ ] Limit capped at 100
 [ ] Zero/negative limit handled

FEATURE FLAGS:
 [ ] Disable credit:module → all routes 403
 [ ] Re-enable credit:module → routes restored
 [ ] Sub-flag test (if implemented)
 [ ] Non-admin cannot modify flags

SOD:
 [ ] RM cannot approve own application (403)
 [ ] Different user can approve (200)
 [ ] Maker-checker violation (403)
 [ ] Admin bypass works (200)

DOCUMENTS:
 [ ] Clean file upload
 [ ] Infected file rejection

NOTES:
 _______________________________________________
 _______________________________________________
```

---

## 10. Notes & Open Questions

1. **Test data reset** — Is there a script to reset test data between smoke test runs? Recommend a `npm run db:seed:reset` command.
2. **Parallel test users** — Ensure test users for each role are properly seeded and have correct role assignments.
3. **Automated version** — Consider converting this checklist into an automated E2E test suite (Playwright/Cypress) for regression testing.
4. **Performance baseline** — Record response times during smoke test to establish performance baselines for future comparison.
5. **Error response format** — All error responses should follow a consistent format: `{ "message": "...", "statusCode": 403, "error": "Forbidden" }`. Verify this across all error cases.
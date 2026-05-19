# Runbook 21: Credit Approval Matrix Management

## Overview

The credit approval matrix determines who must approve a credit application based on
criteria such as the requested amount, product type, and risk rating. Each matrix row
defines a combination of thresholds and the approver(s) required, enabling the
organization to enforce Segregation of Duties (SOD) and proper escalation paths.

| Concept | Description |
|---|---|
| Matrix | A set of rules that map application attributes to required approvers |
| Criteria | Amount range, product type, risk rating — used to match a matrix |
| Approver Level | The authority level(s) required (e.g., Branch Manager, Risk Officer) |
| SOD Constraint | A matrix may require approval from two different users/roles |
| Version | Each matrix carries a `version` field for optimistic locking |

Base URL: `http://localhost:3000/api/v1`

---

## 1. Create an Approval Matrix

```bash
curl -X POST http://localhost:3000/api/v1/credit/approval-matrices \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SME Loan Approval — Tier 1",
    "description": "Approvals for SME loans up to 500,000 with low-risk borrowers",
    "criteria": {
      "productType": "sme_loan",
      "amountMin": 0,
      "amountMax": 500000,
      "riskRating": ["low", "medium"]
    },
    "requiredApprovers": [
      { "role": "branch_manager", "level": 1 },
      { "role": "risk_officer", "level": 2 }
    ],
    "sodConstraints": {
      "requireDifferentUsers": true,
      "restrictedRoles": ["credit_analyst"]
    },
    "active": true
  }'
```

**Response (201)**:
```json
{
  "id": "mat_01HXYZ",
  "name": "SME Loan Approval — Tier 1",
  "version": 1,
  "criteria": { … },
  "requiredApprovers": [ … ],
  "active": true,
  "createdAt": "2026-05-18T10:00:00Z"
}
```

> **Note**: The `version` field starts at 1 and must be supplied on every update for optimistic locking.

---

## 2. View All Approval Matrices

```bash
curl -X GET http://localhost:3000/api/v1/credit/approval-matrices \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "data": [
    {
      "id": "mat_01HXYZ",
      "name": "SME Loan Approval — Tier 1",
      "active": true,
      "version": 1,
      "criteria": { … }
    }
  ]
}
```

### Filter by Query Parameters

```bash
curl -X GET "http://localhost:3000/api/v1/credit/approval-matrices?active=true&productType=sme_loan" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## 3. Update an Approval Matrix

You **must** include the current `version` value to satisfy optimistic locking.

```bash
curl -X PATCH http://localhost:3000/api/v1/credit/approval-matrices/mat_01HXYZ \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "criteria": {
      "productType": "sme_loan",
      "amountMin": 0,
      "amountMax": 750000,
      "riskRating": ["low", "medium", "high"]
    },
    "requiredApprovers": [
      { "role": "branch_manager", "level": 1 },
      { "role": "risk_officer", "level": 2 },
      { "role": "senior_risk_officer", "level": 3 }
    ]
  }'
```

**Response (200)**:
```json
{
  "id": "mat_01HXYZ",
  "version": 2,
  "criteria": { … },
  "requiredApprovers": [ … ]
}
```

> The server increments `version` on each successful update. Use the new value for subsequent patches.

---

## 4. Delete an Approval Matrix

```bash
curl -X DELETE http://localhost:3000/api/v1/credit/approval-matrices/mat_01HXYZ \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (204)**: No content on success.

> Deleting a matrix that is currently in use by pending applications will return **409 Conflict**. Deactivate instead:

```bash
curl -X PATCH http://localhost:3000/api/v1/credit/approval-matrices/mat_01HXYZ \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "version": 2, "active": false }'
```

---

## 5. Lookup / Resolve Which Matrix Applies

The lookup endpoint evaluates the given criteria and returns the matching matrix (or matrices) that apply to a particular application scenario.

```bash
curl -X POST http://localhost:3000/api/v1/credit/approval-matrices/lookup \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "productType": "sme_loan",
    "amount": 350000,
    "riskRating": "medium"
  }'
```

**Response (200)**:
```json
{
  "matchedMatrix": {
    "id": "mat_01HXYZ",
    "name": "SME Loan Approval — Tier 1",
    "requiredApprovers": [
      { "role": "branch_manager", "level": 1 },
      { "role": "risk_officer", "level": 2 }
    ],
    "sodConstraints": {
      "requireDifferentUsers": true
    }
  }
}
```

> If no matrix matches, the response returns `matchedMatrix: null`. This usually means a new matrix rule needs to be created for the uncovered scenario.

---

## 6. Approval Workflow

After the system resolves which matrix applies, the application follows an approval
workflow. Each approver submits their decision through the approval action endpoint.

### Submit an Approval Decision

```bash
curl -X POST http://localhost:3000/api/v1/credit/applications/app_01ABC/approval-actions \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approved",
    "comments": "Financials look solid; risk within tolerance."
  }'
```

Valid `decision` values: `approved`, `rejected`, `deferred`.

### SOD Constraints

When a matrix specifies `requireDifferentUsers: true`, the system enforces that
no single user can supply more than one of the required approval levels. If a user
who has already approved at Level 1 attempts to approve at Level 2, the request is
rejected with a **403 Forbidden** and message:

```json
{ "error": "SOD_VIOLATION", "message": "Segregation of duties constraint: same user cannot approve at multiple levels" }
```

---

## 7. Troubleshooting

### 409 Conflict — Optimistic Lock Failure

**Symptom**: Updating a matrix returns HTTP 409.

```json
{ "error": "CONFLICT", "message": "Version mismatch. The resource has been modified by another user." }
```

**Cause**: The `version` field in your PATCH request does not match the current version on the server. Another admin likely edited the matrix after you last read it.

**Resolution**:
1. Fetch the matrix again: `GET /api/v1/credit/approval-matrices/mat_01HXYZ`
2. Note the new `version` value from the response.
3. Re-apply your changes with the correct `version`.
4. Retry the PATCH request.

---

### 403 Forbidden — SOD Violation

**Symptom**: Submitting an approval returns HTTP 403.

```json
{ "error": "SOD_VIOLATION", "message": "Segregation of duties constraint violated" }
```

**Cause**: The logged-in user belongs to a role restricted by the matrix's SOD
constraints, or the same user is attempting to satisfy two distinct approval levels.

**Resolution**:
- Ensure a different user with the appropriate role submits the second approval.
- Review the matrix's `sodConstraints.restrictedRoles` and `requireDifferentUsers` settings.
- If the SOD rule is overly restrictive, update the matrix to relax the constraint (requires `credit:admin`).

---

### 404 Not Found — No Matching Matrix

**Symptom**: Lookup returns `matchedMatrix: null`.

**Resolution**: Create a new matrix that covers the criteria (product type, amount range, risk rating) of the application.

---

## Quick Reference

| Action | Method | Endpoint |
|---|---|---|
| Create matrix | POST | `/credit/approval-matrices` |
| List matrices | GET | `/credit/approval-matrices` |
| Update matrix | PATCH | `/credit/approval-matrices/:id` |
| Delete matrix | DELETE | `/credit/approval-matrices/:id` |
| Lookup matrix | POST | `/credit/approval-matrices/lookup` |
| Submit approval | POST | `/credit/applications/:id/approval-actions` |
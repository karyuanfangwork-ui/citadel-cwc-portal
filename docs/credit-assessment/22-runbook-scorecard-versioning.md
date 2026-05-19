# Runbook 22: Scorecard & Version Management

## Overview

Scorecards define the weighted risk factors used to produce a credit score for an
application. Each scorecard contains one or more **versions**, and only one version
can be active at a time. When a new version is activated, the previous active version
is automatically deactivated. This versioned design allows auditors to see exactly
which factors and weights were used at the time a score was calculated.

| Concept | Description |
|---|---|
| Scorecard | A named collection of risk factors with a versioning lifecycle |
| Version | A snapshot of factor weights and thresholds; only one can be active per scorecard |
| Score Run | The result of scoring an application with a specific scorecard version |
| Override | An admin-level change to a score run result (requires `credit:admin`) |

Base URL: `http://localhost:3000/api/v1`

---

## 1. Create a Scorecard

```bash
curl -X POST http://localhost:3000/api/v1/credit/scorecards \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SME Credit Scorecard v1",
    "description": "Primary scorecard for SME loan applications",
    "factors": [
      { "name": "yearsInBusiness", "weight": 0.20, "thresholds": [
        { "range": [0, 2],  "score": 10 },
        { "range": [2, 5],  "score": 30 },
        { "range": [5, 99], "score": 50 }
      ]},
      { "name": "annualRevenue", "weight": 0.30, "thresholds": [
        { "range": [0, 100000],      "score": 10 },
        { "range": [100000, 500000], "score": 30 },
        { "range": [500000, 1e9],    "score": 50 }
      ]},
      { "name": "debtToIncomeRatio", "weight": 0.25, "thresholds": [
        { "range": [0, 0.3],   "score": 50 },
        { "range": [0.3, 0.6], "score": 30 },
        { "range": [0.6, 10],  "score": 10 }
      ]},
      { "name": "paymentHistory", "weight": 0.25, "thresholds": [
        { "range": [0, 60],   "score": 10 },
        { "range": [60, 80],  "score": 30 },
        { "range": [80, 100], "score": 50 }
      ]}
    ]
  }'
```

**Response (201)**:
```json
{
  "id": "sc_01ABC",
  "name": "SME Credit Scorecard v1",
  "description": "Primary scorecard for SME loan applications",
  "currentVersion": "sv_01DEF",
  "createdAt": "2026-05-18T10:00:00Z"
}
```

> Creating a scorecard automatically creates version 1 and sets it as active.

---

## 2. View Scorecards

### List All Scorecards

```bash
curl -X GET http://localhost:3000/api/v1/credit/scorecards \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "data": [
    {
      "id": "sc_01ABC",
      "name": "SME Credit Scorecard v1",
      "currentVersion": "sv_01DEF",
      "createdAt": "2026-05-18T10:00:00Z"
    }
  ]
}
```

### List Versions for a Scorecard

```bash
curl -X GET http://localhost:3000/api/v1/credit/scorecards/sc_01ABC/versions \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "data": [
    {
      "id": "sv_01DEF",
      "versionNumber": 1,
      "status": "active",
      "factors": [ … ],
      "createdAt": "2026-05-18T10:00:00Z"
    }
  ]
}
```

---

## 3. Create a New Version

When business rules change, create a new version of the scorecard with updated weights or factors.

```bash
curl -X POST http://localhost:3000/api/v1/credit/scorecards/sc_01ABC/versions \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "factors": [
      { "name": "yearsInBusiness", "weight": 0.20, "thresholds": [
        { "range": [0, 2],  "score": 10 },
        { "range": [2, 5],  "score": 30 },
        { "range": [5, 99], "score": 50 }
      ]},
      { "name": "annualRevenue", "weight": 0.25, "thresholds": [
        { "range": [0, 100000],      "score": 10 },
        { "range": [100000, 500000], "score": 30 },
        { "range": [500000, 1e9],    "score": 50 }
      ]},
      { "name": "debtToIncomeRatio", "weight": 0.30, "thresholds": [
        { "range": [0, 0.3],   "score": 50 },
        { "range": [0.3, 0.6], "score": 30 },
        { "range": [0.6, 10],  "score": 10 }
      ]},
      { "name": "paymentHistory", "weight": 0.25, "thresholds": [
        { "range": [0, 60],   "score": 10 },
        { "range": [60, 80],  "score": 30 },
        { "range": [80, 100], "score": 50 }
      ]}
    ],
    "changeNotes": "Increased debt-to-income weight from 0.25 to 0.30; reduced revenue weight to 0.25."
  }'
```

**Response (201)**:
```json
{
  "id": "sv_02GHI",
  "versionNumber": 2,
  "status": "draft",
  "factors": [ … ],
  "createdAt": "2026-05-18T11:00:00Z"
}
```

> New versions are created in **draft** status. They must be explicitly activated before they are used in scoring.

---

## 4. Activate a Version

Only one version per scorecard can be active. Activating a new version automatically deactivates the previous active version.

```bash
curl -X POST http://localhost:3000/api/v1/credit/scorecard-versions/sv_02GHI/activate \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

**Response (200)**:
```json
{
  "id": "sv_02GHI",
  "versionNumber": 2,
  "status": "active",
  "activatedAt": "2026-05-18T11:05:00Z",
  "previousVersionId": "sv_01DEF",
  "previousVersionStatus": "inactive"
}
```

> **Audit note**: The previously active version (sv_01DEF) is set to `inactive`. Past score runs that used sv_01DEF retain a reference to that version, preserving audit integrity.

---

## 5. Score an Application

Scoring uses the currently **active** version of the scorecard specified for the application type.

```bash
curl -X POST http://localhost:3000/api/v1/credit/applications/app_01XYZ/score \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "scorecardId": "sc_01ABC"
  }'
```

**Response (200)**:
```json
{
  "id": "sr_01JKL",
  "applicationId": "app_01XYZ",
  "scorecardVersionId": "sv_02GHI",
  "totalScore": 42,
  "maxScore": 50,
  "scorePercentage": 84,
  "riskBand": "low",
  "factorBreakdown": [
    { "name": "yearsInBusiness", "score": 30, "maxScore": 50, "weight": 0.20 },
    { "name": "annualRevenue", "score": 50, "maxScore": 50, "weight": 0.25 },
    { "name": "debtToIncomeRatio", "score": 50, "maxScore": 50, "weight": 0.30 },
    { "name": "paymentHistory", "score": 30, "maxScore": 50, "weight": 0.25 }
  ],
  "scoredAt": "2026-05-18T11:10:00Z"
}
```

---

## 6. View Score Runs

Retrieve all score runs for a given application.

```bash
curl -X GET http://localhost:3000/api/v1/credit/applications/app_01XYZ/scores \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "data": [
    {
      "id": "sr_01JKL",
      "scorecardVersionId": "sv_02GHI",
      "totalScore": 42,
      "riskBand": "low",
      "overridden": false,
      "scoredAt": "2026-05-18T11:10:00Z"
    }
  ]
}
```

---

## 7. Override a Score

Overrides require the `credit:admin` role. Use this when an analyst or risk officer
needs to adjust a score that was produced by the automated model.

```bash
curl -X POST http://localhost:3000/api/v1/credit/score-runs/sr_01JKL/override \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "adjustedScore": 48,
    "adjustedRiskBand": "low",
    "reason": "Borrower recently received a strong external credit rating not reflected in financials."
  }'
```

**Response (200)**:
```json
{
  "id": "sr_01JKL",
  "totalScore": 48,
  "riskBand": "low",
  "overridden": true,
  "overrideReason": "Borrower recently received a strong external credit rating not reflected in financials.",
  "overriddenBy": "usr_admin001",
  "overriddenAt": "2026-05-18T11:15:00Z"
}
```

> **Important**: Overrides are permanently recorded. Auditors can see both the original and overridden values.

---

## 8. Version Management Rules

| Rule | Detail |
|---|---|
| One active version | Only one version per scorecard can have `status: active` at any time |
| Activation deactivates previous | When you activate version N+1, version N is automatically set to `inactive` |
| Draft versions | New versions start as `draft`. They can be reviewed before activation |
| Immutability | Once a version is `active` or `inactive`, its factor definitions cannot be edited. Create a new version instead |
| Score run references | A score run always references the specific version used. Changing the active version does not retroactively alter past score runs |

---

## Quick Reference

| Action | Method | Endpoint |
|---|---|---|
| Create scorecard | POST | `/credit/scorecards` |
| List scorecards | GET | `/credit/scorecards` |
| List versions | GET | `/credit/scorecards/:id/versions` |
| Create version | POST | `/credit/scorecards/:id/versions` |
| Activate version | POST | `/credit/scorecard-versions/:id/activate` |
| Score application | POST | `/credit/applications/:id/score` |
| View score runs | GET | `/credit/applications/:id/scores` |
| Override score | POST | `/credit/score-runs/:id/override` |
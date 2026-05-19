# Runbook 23: Credit Committee Scheduling & Operations

## Overview

The credit committee module manages the full lifecycle of committee meetings: scheduling,
member management, agenda creation, voting, and finalization. Committee meetings are
used to review and approve (or reject) credit applications that exceed delegated
authority limits or require collective judgment.

| Concept | Description |
|---|---|
| Meeting | A scheduled session with a date, location/quorum rules, and a list of applications to review |
| Member | A user assigned to a meeting; must be present (attendance) to vote |
| Agenda Item | An application (or topic) added to a meeting for review |
| Quorum | Minimum number of attending members required before votes can be finalized |
| Vote | A member's decision on an agenda item (`approve`, `reject`, `abstain`) |
| Finalize | Committing the committee's decision on an agenda item (requires `credit:admin`) |
| Memo | A generated summary document for an application's committee review |

Base URL: `http://localhost:3000/api/v1`

---

## 1. Create a Meeting

```bash
curl -X POST http://localhost:3000/api/v1/credit/committee/meetings \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Weekly Credit Committee — May 2026 W3",
    "description": "Review SME loan applications exceeding branch delegation limits.",
    "scheduledAt": "2026-05-22T09:00:00Z",
    "location": "Conference Room 3A — HQ",
    "quorumRequired": 3,
    "durationMinutes": 90
  }'
```

**Response (201)**:
```json
{
  "id": "mtg_01AAA",
  "title": "Weekly Credit Committee — May 2026 W3",
  "status": "scheduled",
  "scheduledAt": "2026-05-22T09:00:00Z",
  "quorumRequired": 3,
  "createdAt": "2026-05-18T10:00:00Z"
}
```

---

## 2. View Meetings

### List All Meetings

```bash
curl -X GET http://localhost:3000/api/v1/credit/committee/meetings \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "data": [
    {
      "id": "mtg_01AAA",
      "title": "Weekly Credit Committee — May 2026 W3",
      "status": "scheduled",
      "scheduledAt": "2026-05-22T09:00:00Z",
      "quorumRequired": 3,
      "memberCount": 0
    }
  ]
}
```

### Filter Meetings

```bash
curl -X GET "http://localhost:3000/api/v1/credit/committee/meetings?status=scheduled&from=2026-05-01&to=2026-05-31" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Get Meeting Details

```bash
curl -X GET http://localhost:3000/api/v1/credit/committee/meetings/mtg_01AAA \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "id": "mtg_01AAA",
  "title": "Weekly Credit Committee — May 2026 W3",
  "description": "Review SME loan applications exceeding branch delegation limits.",
  "status": "scheduled",
  "scheduledAt": "2026-05-22T09:00:00Z",
  "location": "Conference Room 3A — HQ",
  "quorumRequired": 3,
  "durationMinutes": 90,
  "members": [ … ],
  "agendaItems": [ … ],
  "createdAt": "2026-05-18T10:00:00Z"
}
```

---

## 3. Update a Meeting

```bash
curl -X PATCH http://localhost:3000/api/v1/credit/committee/meetings/mtg_01AAA \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduledAt": "2026-05-22T10:00:00Z",
    "location": "Virtual — Zoom Meeting Room 4",
    "durationMinutes": 120
  }'
```

**Response (200)**: Returns the updated meeting object.

> A meeting in `in_progress` or `finalized` status may have restricted fields that cannot be changed.

---

## 4. Manage Members

### Add a Member

```bash
curl -X POST http://localhost:3000/api/v1/credit/committee/meetings/mtg_01AAA/members \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "usr_0001",
    "role": "chairperson"
  }'
```

```bash
curl -X POST http://localhost:3000/api/v1/credit/committee/meetings/mtg_01AAA/members \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "usr_0002",
    "role": "member"
  }'
```

**Response (201)**:
```json
{
  "meetingId": "mtg_01AAA",
  "userId": "usr_0001",
  "role": "chairperson",
  "attendance": "pending"
}
```

### Remove a Member

```bash
curl -X DELETE http://localhost:3000/api/v1/credit/committee/meetings/mtg_01AAA/members/usr_0002 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (204)**: No content on success.

---

## 5. Mark Attendance

On the day of the meeting, members mark themselves (or the chair marks them) as present.

```bash
curl -X PATCH http://localhost:3000/api/v1/credit/committee/meetings/mtg_01AAA/members/usr_0001/attendance \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "present" }'
```

Valid `status` values: `present`, `absent`, `excused`.

**Response (200)**:
```json
{
  "meetingId": "mtg_01AAA",
  "userId": "usr_0001",
  "attendance": "present",
  "updatedAt": "2026-05-22T09:02:00Z"
}
```

---

## 6. Check Quorum

Returns whether the minimum number of attending members has been reached.

```bash
curl -X GET http://localhost:3000/api/v1/credit/committee/meetings/mtg_01AAA/quorum \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "meetingId": "mtg_01AAA",
  "quorumRequired": 3,
  "membersPresent": 4,
  "quorumMet": true
}
```

> Voting and finalization are blocked when `quorumMet` is `false`.

---

## 7. Manage Agenda Items

### Add an Application to the Agenda

```bash
curl -X POST http://localhost:3000/api/v1/credit/committee/meetings/mtg_01AAA/agenda \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "app_01XYZ",
    "order": 1,
    "notes": "SME loan for $450K — risk rating: medium"
  }'
```

**Response (201)**:
```json
{
  "id": "ag_01MMM",
  "meetingId": "mtg_01AAA",
  "applicationId": "app_01XYZ",
  "order": 1,
  "status": "pending",
  "notes": "SME loan for $450K — risk rating: medium"
}
```

### Remove an Agenda Item

```bash
curl -X DELETE http://localhost:3000/api/v1/credit/committee/agenda/ag_01MMM \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (204)**: No content on success.

---

## 8. Vote on an Agenda Item

Each member casts a vote. Requires the `credit:approve` role.

```bash
curl -X POST http://localhost:3000/api/v1/credit/committee/agenda/ag_01MMM/vote \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approve",
    "comments": "Strong application with adequate collateral."
  }'
```

Valid `decision` values: `approve`, `reject`, `abstain`.

**Response (200)**:
```json
{
  "agendaItemId": "ag_01MMM",
  "userId": "usr_0001",
  "decision": "approve",
  "comments": "Strong application with adequate collateral.",
  "votedAt": "2026-05-22T09:15:00Z"
}
```

---

## 9. View Voting Results

```bash
curl -X GET http://localhost:3000/api/v1/credit/committee/agenda/ag_01MMM/results \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "agendaItemId": "ag_01MMM",
  "applicationId": "app_01XYZ",
  "totalVotes": 4,
  "approve": 3,
  "reject": 1,
  "abstain": 0,
  "status": "pending_finalization",
  "votes": [
    { "userId": "usr_0001", "decision": "approve", "votedAt": "2026-05-22T09:15:00Z" },
    { "userId": "usr_0003", "decision": "approve", "votedAt": "2026-05-22T09:16:00Z" },
    { "userId": "usr_0004", "decision": "approve", "votedAt": "2026-05-22T09:17:00Z" },
    { "userId": "usr_0005", "decision": "reject",  "votedAt": "2026-05-22T09:18:00Z" }
  ]
}
```

---

## 10. Finalize an Agenda Item

Finalization commits the committee's decision. Requires the `credit:admin` role.

```bash
curl -X POST http://localhost:3000/api/v1/credit/committee/agenda/ag_01MMM/finalize \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "finalDecision": "approved",
    "conditions": [
      "Borrower must provide additional collateral documentation within 30 days.",
      "Disbursement in two tranches subject to compliance review."
    ]
  }'
```

Valid `finalDecision` values: `approved`, `rejected`, `deferred`.

**Response (200)**:
```json
{
  "id": "ag_01MMM",
  "status": "finalized",
  "finalDecision": "approved",
  "conditions": [ … ],
  "finalizedBy": "usr_admin001",
  "finalizedAt": "2026-05-22T09:30:00Z"
}
```

> Once finalized, the agenda item's status changes to `finalized` and the linked application's status is updated accordingly.

---

## 11. Generate Meeting Memo

After a meeting, generate a memo summarizing the committee's deliberations for a specific application.

```bash
curl -X GET http://localhost:3000/api/v1/credit/committee/applications/app_01XYZ/memo \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "applicationId": "app_01XYZ",
  "meetingId": "mtg_01AAA",
  "memoDate": "2026-05-22",
  "summary": {
    "borrower": "Acme Manufacturing Ltd.",
    "amount": 450000,
    "product": "SME Loan",
    "committeeDecision": "approved",
    "conditions": [ … ],
    "votingSummary": {
      "approve": 3,
      "reject": 1,
      "abstain": 0
    }
  },
  "generatedAt": "2026-05-22T10:00:00Z"
}
```

---

## 12. Committee Calendar

Retrieve a calendar view of upcoming and past committee meetings.

```bash
curl -X GET "http://localhost:3000/api/v1/credit/dashboard/committee-calendar?month=2026-05" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "month": "2026-05",
  "meetings": [
    {
      "id": "mtg_01AAA",
      "title": "Weekly Credit Committee — May 2026 W3",
      "scheduledAt": "2026-05-22T09:00:00Z",
      "status": "scheduled",
      "memberCount": 4,
      "agendaItemCount": 3
    }
  ]
}
```

---

## 13. Typical Committee Workflow

Below is the end-to-end sequence for a committee meeting:

1. **Create meeting** — admin schedules the meeting with date, location, quorum.
2. **Add members** — assign users (including a chairperson) to the meeting.
3. **Add agenda items** — link credit applications that need committee review.
4. **On meeting day** — members mark attendance; admin checks quorum.
5. **Discussion & voting** — each member votes on each agenda item.
6. **View results** — chairperson or admin reviews voting tallies.
7. **Finalize** — admin finalizes each agenda item, committing the decision.
8. **Generate memo** — produce a meeting memo for the record.

---

## 14. Troubleshooting

### Quorum Not Met

**Symptom**: Voting returns 422 or finalization is blocked.

**Resolution**: Ensure enough members have marked `attendance: present` to satisfy the `quorumRequired` threshold. Use `/meetings/:id/quorum` to check.

### Duplicate Vote

**Symptom**: A member who has already voted receives a 409.

**Resolution**: Each member can only vote once per agenda item. Use the results endpoint to review existing votes.

### Finalization Requires Admin

**Symptom**: Finalization returns 403.

**Resolution**: The `credit:admin` role is required. Ensure the requesting user has this permission.

---

## Quick Reference

| Action | Method | Endpoint |
|---|---|---|
| Create meeting | POST | `/credit/committee/meetings` |
| List meetings | GET | `/credit/committee/meetings` |
| Get meeting | GET | `/credit/committee/meetings/:id` |
| Update meeting | PATCH | `/credit/committee/meetings/:id` |
| Add member | POST | `/credit/committee/meetings/:id/members` |
| Remove member | DELETE | `/credit/committee/meetings/:id/members/:userId` |
| Mark attendance | PATCH | `/credit/committee/meetings/:id/members/:userId/attendance` |
| Check quorum | GET | `/credit/committee/meetings/:id/quorum` |
| Add agenda item | POST | `/credit/committee/meetings/:id/agenda` |
| Remove agenda item | DELETE | `/credit/committee/agenda/:itemId` |
| Vote | POST | `/credit/committee/agenda/:itemId/vote` |
| View results | GET | `/credit/committee/agenda/:itemId/results` |
| Finalize | POST | `/credit/committee/agenda/:itemId/finalize` |
| Generate memo | GET | `/credit/committee/applications/:applicationId/memo` |
| Committee calendar | GET | `/credit/dashboard/committee-calendar` |
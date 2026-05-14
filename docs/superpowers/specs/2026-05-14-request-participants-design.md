# Request Participants — Design Spec

**Date:** 2026-05-14  
**Status:** Approved  
**Feature:** Allow requesters (and agents/admins) to add participants to a ticket so those people can view the ticket and receive status notifications.

---

## Overview

A new "Participants" concept on service desk requests. Participants are users who are not the requester, agent, or approver but need visibility into a ticket — to stay in the loop. They get read-only access and receive notifications when added and when the ticket status changes.

---

## Data Model

New Prisma model `RequestParticipant`:

```prisma
model RequestParticipant {
  id          String   @id @default(uuid()) @db.Uuid
  requestId   String   @map("request_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  addedById   String   @map("added_by_id") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  request   Request @relation(fields: [requestId], references: [id], onDelete: Cascade)
  user      User    @relation("RequestParticipants", fields: [userId], references: [id])
  addedBy   User    @relation("ParticipantAddedBy", fields: [addedById], references: [id])

  @@unique([requestId, userId])
  @@map("request_participants")
}
```

- `Request` gains a `participants RequestParticipant[]` relation.
- `User` gains two back-relations: `participatingIn` and `participantsAdded`.
- `onDelete: Cascade` ensures participants are cleaned up when a request is deleted.

---

## Backend API

### New endpoints: `/api/v1/requests/:id/participants`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/requests/:id/participants` | Requester, Agent, Admin, Participant | List all participants with user details |
| `POST` | `/requests/:id/participants` | Requester, Agent, Admin | Add a participant `{ userId: string }` |
| `DELETE` | `/requests/:id/participants/:userId` | Requester, Agent, Admin | Remove a participant |

### Access control change — `getRequestById`

Add a 6th condition to the permission gate: if the requesting user is in `request.participants`, grant access (view only — no write actions permitted for participants). Participants are also subject to the existing confidentiality gate: they may not view confidential requests unless they are explicitly added (same as a designated approver pattern).

### User search

Reuse existing `GET /api/v1/users?search=<query>` (or add it if it doesn't exist) for the typeahead. Returns `id`, `firstName`, `lastName`, `email`, `avatarUrl`.

---

## Notifications

### Event: `participant_added`
- Triggered when a participant is added to a request.
- Recipient: the newly added participant.
- Message: "You have been added as a participant to request {referenceNumber}: {summary}."
- Channels: in-app notification + email.

### Event: `request_status_changed` (extended)
- Existing event already notifies the requester on status changes.
- Extended to also fan out to all current participants of the request.
- Message same as requester gets: "Your request {referenceNumber} status has changed to {status}."

Both notifications use the existing `NotificationService` and email service patterns.

---

## Frontend

### `ActionSidebar.tsx`
- New "Participants" section rendered at the bottom of the sidebar.
- Visible to: all users who can view the request.
- Editable (add/remove) by: requester, agents, admins.
- Displays avatar chips: user initials/avatar + name. Requester/agent/admin see a `×` remove button on each chip.
- "+ Add" button toggles an inline typeahead input below the chips.
- Typeahead debounces calls to `GET /api/v1/users?search=<query>`, filters out already-added participants and the requester.
- Selecting a result calls `POST /requests/:id/participants` and refreshes the list.
- `×` on a chip calls `DELETE /requests/:id/participants/:userId`.

### `frontend/src/services/request.service.ts`
Three new functions:
- `getParticipants(requestId)` → `GET /requests/:id/participants`
- `addParticipant(requestId, userId)` → `POST /requests/:id/participants`
- `removeParticipant(requestId, userId)` → `DELETE /requests/:id/participants/:userId`

---

## Out of Scope
- Participants cannot post comments or activities.
- Participants cannot add other participants.
- No participant role differentiation (all participants are equal, read-only).
- No bulk-add of participants.

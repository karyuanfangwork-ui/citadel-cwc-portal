# Entity-Based Approval Routing — Design Spec
**Date:** 2026-04-26  
**Status:** Approved

## Overview

A general-purpose mechanism for routing ticket approvals to designated approvers based on subsidiary entity membership. When a ticket is submitted, the system derives the relevant entities (from the requester's profile or from custom fields the requester fills in), then notifies all applicable entity approvers in parallel. The ticket advances only when all entity approvals are resolved.

This mechanism is request-type agnostic — any request type can opt into entity routing via configuration, with no code changes required.

---

## 1. Data Model

### New: `Entity`
Stores the subsidiary company registry.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | String | e.g. "Citadel Malaysia" |
| `code` | String unique | e.g. "CIT-MY" — used as the value in customFields |
| `description` | String? | |
| `approverId` | UUID FK → User | designated approver for this entity |
| `isActive` | Boolean | soft delete — existing approvals unaffected |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

### New: `RequestTypeEntityRouting`
Per request type, declares which routing rules apply.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `requestTypeId` | UUID FK → RequestType | |
| `routingMode` | Enum: `REQUESTER_ENTITY` \| `CUSTOM_FIELD` | |
| `customFieldKey` | String? | only used when `routingMode = CUSTOM_FIELD` (e.g. "chargeToEntity") |
| `label` | String? | display label for the field key (e.g. "Charge To Entity") |
| `createdAt` | DateTime | |

### Modified: `User`
Add entity membership field.

| New Field | Type | Notes |
|---|---|---|
| `entityId` | UUID? FK → Entity | which subsidiary this staff member belongs to |

### Modified: `RequestApproval`
Add entity reference for audit and display.

| New Field | Type | Notes |
|---|---|---|
| `entityId` | UUID? FK → Entity | null for non-entity approvals |

---

## 2. Routing Modes

| Mode | Trigger | Use Case |
|---|---|---|
| `REQUESTER_ENTITY` | System reads requester's `entityId` from their profile | IT Hardware Request — route to the staff member's own entity approver |
| `CUSTOM_FIELD` | System reads a specific key from `request.customFields` | Inter-company Chargeback — requester selects "charge to entity" and "charge from entity"; both approvers are notified in parallel |

A single request type may have multiple routing rules (e.g. chargeback has two `CUSTOM_FIELD` rules).

---

## 3. Admin Console UI

### A. New "Entities" Tab
New tab in Admin Settings alongside existing tabs. Shows a table:
- Columns: Name, Code, Designated Approver, Status
- Actions: Create entity (name, code, approver dropdown), Edit (update approver), Deactivate

### B. User Accounts Tab Enhancements
- User table: new **Entity** column added next to Department
- User edit modal: new **Entity** dropdown — admin assigns staff to their subsidiary
- User row: read-only **"Approver For"** badge if this user is a designated entity approver

### C. Request Type Entity Routing Config
In the Service Desks / Request Type editor, a new **"Entity Routing"** section:
- Toggle routing on/off for the request type
- Add routing rules: pick mode (`Requester Entity` or `Custom Field`)
- For `CUSTOM_FIELD` mode: enter field key + display label
- Summary list of active routing rules

---

## 4. Approval Engine

### On Ticket Submission
`EntityRoutingService` runs after request is saved:

1. Fetch all active `RequestTypeEntityRouting` rows for the request type
2. Collect entity codes:
   - `REQUESTER_ENTITY` → read requester's `entityId`
   - `CUSTOM_FIELD` → read the key from `request.customFields`
3. Deduplicate entity codes
4. For each unique entity code → look up `Entity.approverId` → create `RequestApproval` (status `PENDING`, `entityId` set)
5. Send email + in-app notification to all approvers simultaneously

### On Approval / Rejection
- When an approver acts: check if **all** entity `RequestApproval` records for this request are `APPROVED`
- All approved → advance request to next workflow status
- Any rejected → mark request rejected, notify requester and all remaining pending approvers

### Ticket Detail Page
New **"Entity Approvals"** panel showing each approval card:
- Entity name, approver name, status badge (Pending / Approved / Rejected), timestamp

---

## 5. Constraints & Edge Cases

| Scenario | Handling |
|---|---|
| Requester has no entity assigned | Skip entity routing; log warning; admin should be notified to assign entity |
| `customFields` key missing or empty | Skip that routing rule silently |
| Both chargeback fields point to same entity | Deduplicate — only one approval record created |
| Entity approver is deactivated | Block ticket submission with error; admin must update entity approver first |
| Entity deactivated after ticket submitted | Existing approval records are unaffected; approver can still act |

---

## 6. Out of Scope

- Multi-level entity approval chains (entity approver → CFO escalation is handled by existing approval tiers)
- Entity-based SLA rules
- Reassigning entity approvals mid-flight (admin can edit entity approver, but in-flight tickets keep original approver)

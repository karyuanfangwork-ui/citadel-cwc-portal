# Runbook 24: Credit Module Feature Flags

## Overview

Feature flags control the availability of credit module capabilities at runtime
without requiring a redeployment. They act as switches that can be toggled by an
administrator to enable or disable individual sub-modules instantly.

| Concept | Description |
|---|---|
| Master flag | `credit:module` — when `false`, ALL credit routes return 403 (except flag admin routes) |
| Sub-capability flags | Fine-grained switches for each credit sub-module |
| `enabled` | Boolean — `true` allows access, `false` blocks it |
| `rolloutPct` | Reserved for gradual rollout (0-100); currently not enforced |
| Cache | 60-second in-memory cache; changes take up to 60 seconds to propagate |

Base URL: `http://localhost:3000/api/v1`

---

## 1. Flag Hierarchy

```
credit:module          ← MASTER FLAG (blocks everything when disabled)
├── credit:borrowers   ← Borrower management
├── credit:applications ← Application submission & processing
├── credit:spreading   ← Financial statement spreading
├── credit:scoring     ← Scorecard & automated scoring
├── credit:committee   ← Committee scheduling & voting
├── credit:collateral  ← Collateral registration & valuation
├── credit:conditions  ← Covenant & condition tracking
├── credit:monitoring  ← Ongoing portfolio monitoring
├── credit:dashboards  ← Analytics & reporting dashboards
└── credit:ai          ← AI-assisted analysis features
```

> The master flag `credit:module` is enforced by middleware on every credit route.
> Sub-capability flags currently exist in the database but are **not yet enforced as
> middleware** — they are reserved for future use.

---

## 2. List All Feature Flags

Requires the `credit:admin` role.

```bash
curl -X GET http://localhost:3000/api/v1/credit/feature-flags \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{
  "flags": [
    {
      "key": "credit:module",
      "enabled": true,
      "rolloutPct": 100,
      "description": "Master flag for the entire credit module",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    },
    {
      "key": "credit:borrowers",
      "enabled": true,
      "rolloutPct": 100,
      "description": "Borrower management capabilities",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    },
    {
      "key": "credit:applications",
      "enabled": true,
      "rolloutPct": 100,
      "description": "Credit application submission and processing",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    },
    {
      "key": "credit:spreading",
      "enabled": true,
      "rolloutPct": 100,
      "description": "Financial statement spreading",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    },
    {
      "key": "credit:scoring",
      "enabled": true,
      "rolloutPct": 100,
      "description": "Automated credit scoring and scorecards",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    },
    {
      "key": "credit:committee",
      "enabled": true,
      "rolloutPct": 100,
      "description": "Credit committee scheduling and voting",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    },
    {
      "key": "credit:collateral",
      "enabled": true,
      "rolloutPct": 100,
      "description": "Collateral registration and valuation",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    },
    {
      "key": "credit:conditions",
      "enabled": true,
      "rolloutPct": 100,
      "description": "Covenant and condition tracking",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    },
    {
      "key": "credit:monitoring",
      "enabled": true,
      "rolloutPct": 100,
      "description": "Ongoing portfolio monitoring",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    },
    {
      "key": "credit:dashboards",
      "enabled": true,
      "rolloutPct": 100,
      "description": "Analytics and reporting dashboards",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    },
    {
      "key": "credit:ai",
      "enabled": false,
      "rolloutPct": 0,
      "description": "AI-assisted analysis features (experimental)",
      "updatedAt": "2026-05-18T08:00:00Z",
      "updatedBy": "usr_admin001"
    }
  ]
}
```

---

## 3. Update a Feature Flag

Requires the `credit:admin` role.

### Enable a Sub-Capability

```bash
curl -X PATCH http://localhost:3000/api/v1/credit/feature-flags/credit:ai \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true }'
```

**Response (200)**:
```json
{
  "key": "credit:ai",
  "enabled": true,
  "rolloutPct": 0,
  "updatedAt": "2026-05-18T11:00:00Z",
  "updatedBy": "usr_admin001"
}
```

### Disable a Sub-Capability

```bash
curl -X PATCH http://localhost:3000/api/v1/credit/feature-flags/credit:committee \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

**Response (200)**:
```json
{
  "key": "credit:committee",
  "enabled": false,
  "rolloutPct": 100,
  "updatedAt": "2026-05-18T11:05:00Z",
  "updatedBy": "usr_admin001"
}
```

> **Note**: Disabling sub-capability flags has no middleware effect until those flags are wired into route guards in a future release. Use them today as documentation of intent and administrative readiness.

---

## 4. Emergency Kill Switch

The `credit:module` flag is the master kill switch. When set to `enabled: false`,
**all** credit module routes immediately return HTTP 403 Forbidden — except for the
feature flag admin routes themselves, so that administrators can re-enable the module.

### Disable All Credit Operations

```bash
curl -X PATCH http://localhost:3000/api/v1/credit/feature-flags/credit:module \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

**Response (200)**:
```json
{
  "key": "credit:module",
  "enabled": false,
  "rolloutPct": 100,
  "updatedAt": "2026-05-18T11:10:00Z",
  "updatedBy": "usr_admin001"
}
```

After this call, any request to credit endpoints (scorecards, applications, committee, etc.) will receive:

```json
{ "error": "FORBIDDEN", "message": "Credit module is currently disabled" }
```

### Re-Enable All Credit Operations

```bash
curl -X PATCH http://localhost:3000/api/v1/credit/feature-flags/credit:module \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true }'
```

> **Critical**: In an emergency, remember that the kill switch takes up to 60 seconds to propagate through the in-memory cache. If immediate effect is required, manually invalidate the cache (see Section 6).

---

## 5. Feature Flag Caching

Feature flags are cached in memory for **60 seconds** to avoid querying the database on
every request. This means:

- After toggling a flag, it may take up to **60 seconds** for the change to take effect across all running instances.
- The cache is per-process; in a multi-instance deployment, each instance has its own cache and refreshes independently.

### Cache Behavior Summary

| Scenario | Behavior |
|---|---|
| Flag toggled | Up to 60 seconds delay before routes enforce the new state |
| Kill switch (`credit:module`) | Same 60-second cache applies — use cache invalidation for immediate effect |
| Database direct update | Not recommended; always use the API endpoints |

---

## 6. Cache Invalidation

If you need changes to take effect immediately (e.g., during an emergency kill switch
activation), you can programmatically invalidate the cache.

```bash
curl -X POST http://localhost:3000/api/v1/credit/feature-flags/invalidate \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200)**:
```json
{ "message": "Feature flag cache invalidated successfully" }
```

> If the `/invalidate` endpoint is not available in your deployment version, flags will
> auto-refresh after the 60-second cache expiry. In such cases, wait up to 60 seconds
> for changes to propagate.

---

## 7. rolloutPct Field

Each flag includes a `rolloutPct` field (integer, 0-100) reserved for future gradual
rollout capabilities. It is intended to support percentage-based rollout (e.g., enable
`credit:ai` for 10% of users initially, then increase).

**Current status**: The `rolloutPct` field is persisted in the database but is **not
enforced** by any middleware or routing logic. Setting it has no operational effect
today.

```bash
curl -X PATCH http://localhost:3000/api/v1/credit/feature-flags/credit:ai \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true, "rolloutPct": 25 }'
```

**Response (200)**:
```json
{
  "key": "credit:ai",
  "enabled": true,
  "rolloutPct": 25,
  "updatedAt": "2026-05-18T11:15:00Z",
  "updatedBy": "usr_admin001"
}
```

> The value is stored for future use. When gradual rollout middleware is implemented, this field will control the experience for a percentage of traffic.

---

## 8. Troubleshooting

### Changes Not Taking Effect

**Symptom**: You toggled a flag but routes still behave as before.

**Cause**: The 60-second in-memory cache has not yet expired.

**Resolution**:
1. Wait up to 60 seconds.
2. Or call `POST /credit/feature-flags/invalidate` to force immediate refresh.

### 403 on All Credit Routes

**Symptom**: Every credit endpoint returns `{"error":"FORBIDDEN","message":"Credit module is currently disabled"}`.

**Cause**: The master flag `credit:module` is set to `enabled: false`.

**Resolution**:
```bash
curl -X PATCH http://localhost:3000/api/v1/credit/feature-flags/credit:module \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true }'
```

Then invalidate cache if immediate effect is needed:
```bash
curl -X POST http://localhost:3000/api/v1/credit/feature-flags/invalidate \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 403 on Feature Flag Endpoints

**Symptom**: Listing or updating flags returns 403.

**Cause**: The `credit:admin` role is required for flag management.

**Resolution**: Ensure the JWT token includes the `credit:admin` permission. The flag admin routes are the **only** credit routes that remain accessible when `credit:module` is disabled — but they still require the admin role.

---

## Quick Reference

| Action | Method | Endpoint |
|---|---|---|
| List all flags | GET | `/credit/feature-flags` |
| Update a flag | PATCH | `/credit/feature-flags/:key` |
| Invalidate cache | POST | `/credit/feature-flags/invalidate` |

### Flag Key Reference

| Flag Key | Scope | Enforced |
|---|---|---|
| `credit:module` | Master — entire credit module | Yes |
| `credit:borrowers` | Borrower management | No (future) |
| `credit:applications` | Application submission & processing | No (future) |
| `credit:spreading` | Financial statement spreading | No (future) |
| `credit:scoring` | Scorecards & automated scoring | No (future) |
| `credit:committee` | Committee scheduling & voting | No (future) |
| `credit:collateral` | Collateral registration & valuation | No (future) |
| `credit:conditions` | Covenant & condition tracking | No (future) |
| `credit:monitoring` | Portfolio monitoring | No (future) |
| `credit:dashboards` | Analytics & reporting | No (future) |
| `credit:ai` | AI-assisted analysis | No (future) |
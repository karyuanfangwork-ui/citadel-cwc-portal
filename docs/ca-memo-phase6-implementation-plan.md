# CA Memo — Phase 6 Implementation Plan
## PII Encryption Hardening & Document Checklist Alignment

**Date:** 2026-05-20
**Depends on:** Phase 5 complete
**Scope:** Field-level encryption for NRIC/Passport across `Director`, `Shareholder`, `UltimateBeneficialOwner`, `KeyCounterparty`; backfill migration; document checklist seed update
**Complexity:** M (but highest-risk phase) · **Estimated touch:** ~10 files

---

## Why this phase exists

Memory observation [758] confirmed: `nricPassportEncrypted` column name implies encryption but the actual implementation was never verified. Phases 1–5 added more NRIC-adjacent data (`KeyCounterparty`). Before production, all NRIC/Passport data must be:

1. Encrypted at rest using a verifiable mechanism
2. Searchable without decrypting (HMAC-indexed lookup)
3. Masked on read (show only last 4 chars by default)
4. Audit-logged on every read that exposes plaintext (existing `piiReadLog.middleware.ts`)

---

## 1. Decision: encryption approach

### Option A — Application-layer AES-256-GCM (recommended)
- Encrypt/decrypt in `backend/src/utils/encryption.util.ts` using Node.js `crypto`
- Key stored in environment variable (`PII_ENCRYPTION_KEY` — 32-byte hex)
- Store ciphertext as base64 string in existing `*Encrypted` columns
- Add deterministic HMAC column (`nricHmac`) for exact-match lookups (e.g. AML search)
- **Pros:** No DB extension dependency; portable; auditable; key rotation possible
- **Cons:** Plaintext in app memory during processing (acceptable for server-side)

### Option B — pgcrypto (database-layer)
- `pgp_sym_encrypt(nric, key)` / `pgp_sym_decrypt(nric_encrypted, key)`
- **Pros:** Encryption never leaves DB layer
- **Cons:** Key visible in DB logs; harder to rotate; query-time overhead; not portable

**Decision: Option A** unless infra team has a KMS preference.

---

## 2. Schema changes

### 2a. Add HMAC search columns

On `Director`, `Shareholder`, `UltimateBeneficialOwner`:

```prisma
nricPassportHmac   String?  @map("nric_passport_hmac") @db.VarChar(64)
// SHA-256 HMAC of the raw NRIC/passport number, used for lookup without decryption
// Indexed for AML/PEP exact-match search
@@index([nricPassportHmac])
```

On `KeyCounterparty` (if contact NRIC is stored — confirm with Credit Risk whether suppliers/buyers warrant NRIC storage):
- If yes: add `contactNricEncrypted String?` + `contactNricHmac String?`
- If no: skip — `KeyCounterparty` stores only name/address/phone (no NRIC needed)

**Recommendation:** KeyCounterparty does NOT need NRIC. Suppliers/buyers are companies, not individuals. Add a schema comment confirming this.

### 2b. Verify `nricPassportEncrypted` column type
Current type: `@db.Text` — sufficient for base64 ciphertext (AES-256-GCM output is longer than plaintext). No type change needed.

### 2c. Migration
`backend/prisma/migrations/20260520000005_phase6_pii_encryption/migration.sql`:
- `ALTER TABLE directors ADD COLUMN nric_passport_hmac VARCHAR(64)`
- `CREATE INDEX ON directors(nric_passport_hmac)`
- Same for `shareholders`, `ultimate_beneficial_owners`

---

## 3. Backend changes

### 3a. `backend/src/utils/encryption.util.ts` (new or harden existing)

```typescript
// AES-256-GCM encrypt + HMAC-SHA256 utilities for PII fields

export function encryptPii(plaintext: string): string {
  // returns base64(iv + authTag + ciphertext)
}

export function decryptPii(ciphertext: string): string {
  // inverse
}

export function hmacPii(plaintext: string): string {
  // HMAC-SHA256(plaintext, HMAC_KEY) → hex string
  // Used for indexed lookup without decryption
}

export function maskNric(plaintext: string): string {
  // Returns "****1234" — last 4 chars visible
}
```

Key config in `backend/src/config/index.ts`:
```typescript
piiEncryptionKey: process.env.PII_ENCRYPTION_KEY,  // 32-byte hex
piiHmacKey: process.env.PII_HMAC_KEY,              // 32-byte hex (separate key)
```

### 3b. Verify / update `Director`, `Shareholder`, `UBO` create/update handlers

In `director.controller.ts`, `shareholder.controller.ts`, `ubo.controller.ts`:
- On create/update: if `nricPassport` plain value received, call `encryptPii()` → store in `nricPassportEncrypted`; call `hmacPii()` → store in `nricPassportHmac`
- Never store plaintext in DB

In read handlers (getById, list):
- By default: return `nricPassportMasked` (last 4 chars) — not the decrypted value
- For authorised reads (credit analyst role with `credit:pii:read` permission): return decrypted value, log via `piiReadLog.middleware.ts`
- Remove `nricPassportEncrypted` from default `select` clause in list queries

### 3c. `piiReadLog.middleware.ts` audit extension
Ensure `piiReadLog` middleware captures: `userId`, `resourceType` (director/shareholder/ubo), `resourceId`, `fieldName`, `ipAddress`, `readAt`. Already exists — verify it covers all three models and the new fields added in Phase 4.

### 3d. Backfill migration script
`backend/prisma/seed-backfill-pii-encryption.ts`:

```typescript
// For each existing Director/Shareholder/UBO row where nricPassportEncrypted is not null:
// 1. Attempt decrypt — if it fails (not yet encrypted), treat as plaintext
// 2. Re-encrypt with encryptPii()
// 3. Compute hmacPii()
// 4. Write back via prisma.director.update()
// Run ONCE, with dry-run flag first
```

**Critical safeguards:**
- Run in a transaction with rollback on any error
- Take DB backup before running
- Run with `DRY_RUN=true` first — logs what would change without writing
- Run in off-peak hours
- Verify 5 sample rows manually after completion

### 3e. Update `backend/prisma/seed.ts` and `creditDemoSeed.ts`
- Replace any plaintext NRIC values in seed data with `encryptPii('S1234567A')` calls
- Add `nricPassportHmac: hmacPii('S1234567A')` to seed rows

---

## 4. Frontend changes

### 4a. NRIC display masking
- All components displaying `nricPassport` should show masked value by default: `****1234`
- "Reveal" button for authorised users: calls `GET /directors/:id/nric?reveal=true` (new endpoint, logged)
- `BorrowerProfileDetail.tsx` — Directors and Shareholders tabs
- `frontend/pages/credit/tabs/CounterpartiesTab.tsx` — No change (no NRIC stored)

### 4b. Input handling
- Director/Shareholder create/edit forms: accept raw NRIC input from user, send to API as plaintext in request body — encryption happens server-side only, never client-side
- Never store or log NRIC in browser localStorage, sessionStorage, or console

---

## 5. Document checklist seed update

Extend `backend/prisma/seed.ts` (or dedicated checklist seed) to add `DocumentRequirement` templates for the document types implied by the CA Memo form:

| DocumentClass | Label | Mandatory |
|---|---|---|
| `CCRIS_REPORT` | CCRIS Report (Customer) | Yes |
| `CCRIS_REPORT` | CCRIS Report (Corporate Guarantor) | Conditional |
| `CTOS_REPORT` | CTOS / Experian Report | Yes |
| `PEP_WATCHLIST_REPORT` | PEP / Watchlist Screening Report | Yes |
| `SITE_VISIT_REPORT` | Site Visit Report (last 12 months) | Yes |
| `VALUATION_REPORT` | Panel Valuer — Property Valuation Report | Conditional |
| `VALUATION_REPORT` | PMMD — Internal Valuation Report | Conditional |
| `ESG_CHECKLIST` | BNM CCPT ESG Checklist | Yes |
| `FINANCIAL_STATEMENT` | Audited Financial Statements (latest 3 FYs) | Yes |

These are added to the `DocumentRequirement` seeder, associated with applicable `productType` and `borrowerType` combinations.

---

## 6. File touch list

| Path | Action |
|---|---|
| `backend/prisma/schema.prisma` | Add `nricPassportHmac` columns + indexes on 3 models |
| `backend/prisma/migrations/20260520000005_.../migration.sql` | New |
| `backend/src/utils/encryption.util.ts` | New (or harden if exists) |
| `backend/src/config/index.ts` | Add `piiEncryptionKey`, `piiHmacKey` config |
| `backend/src/credit/controllers/director.controller.ts` | Encrypt on write, mask on read |
| `backend/src/credit/controllers/shareholder.controller.ts` | Encrypt on write, mask on read |
| `backend/src/credit/controllers/ubo.controller.ts` | Encrypt on write, mask on read |
| `backend/src/credit/middleware/piiReadLog.middleware.ts` | Extend to cover all 3 models |
| `backend/prisma/seed-backfill-pii-encryption.ts` | New (one-time run) |
| `backend/prisma/seed.ts` / `creditDemoSeed.ts` | Use encrypt util for NRIC seed values |
| `frontend/pages/BorrowerProfileDetail.tsx` | Mask NRIC display; add reveal button |

---

## 7. Acceptance criteria

- [ ] New Director/Shareholder/UBO records: NRIC stored as AES-256-GCM ciphertext; never plaintext in DB
- [ ] HMAC column populated on every create/update; indexed
- [ ] Default API response shows masked NRIC (`****1234`) — not ciphertext, not plaintext
- [ ] Authorised read (credit analyst with `credit:pii:read`): returns decrypted NRIC, creates `PiiReadLog` entry
- [ ] Backfill script runs successfully on staging; all existing rows re-encrypted; zero plaintext NRIC in DB after run
- [ ] `PII_ENCRYPTION_KEY` and `PII_HMAC_KEY` validated at app startup — fail-fast if missing
- [ ] Frontend never logs, displays, or caches raw NRIC
- [ ] Document checklist seed adds 9 new requirement templates
- [ ] All seeded demo data uses encrypted NRIC values (seed runs clean)

---

## 8. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Key loss = permanent data loss | Critical | Store `PII_ENCRYPTION_KEY` in a KMS (AWS KMS / Azure Key Vault / HashiCorp Vault), not just `.env`. Implement key rotation path. |
| Backfill failure mid-run leaves DB in mixed state | High | Wrap in transaction with rollback; dry-run first; take snapshot backup before run. |
| Search/lookup on NRIC (AML, de-dup) broken after encryption | High | HMAC-indexed column allows exact-match lookup without decryption. Implement `findByNricHmac(nric)` helper. |
| Performance impact on bulk reads (list of 50 directors) | Medium | Masked read returns pre-stored masked display string — no decryption on list. Only decrypt on individual reveal. |
| Different encryption keys per environment (dev/staging/prod) | Medium | Ensure each environment has its own keys. Dev seed data encrypted with dev key — never copy prod keys to dev. |
| Existing rows with genuinely plaintext NRIC (if column was never encrypted) | High | Backfill script detects: attempt `decryptPii()` → if error, treat as plaintext, encrypt, write back. Handles both states gracefully. |

---

## Appendix — Full phase summary

| Phase | Scope | Status | Key files |
|---|---|---|---|
| ✅ 1 | Schema foundation, header/narrative tabs | **Complete** | `schema.prisma`, `HeaderBackgroundTab.tsx` |
| 2 | Facilities, requests, exposure | Pending | `RequestsFacilitiesTab.tsx`, `RequestItem` model |
| 3 | Risk rating, ECL, projections | Pending | `RiskRatingEclTab.tsx`, `PaymentCapabilityTab.tsx` |
| 4 | Security, profitability, counterparties, directors | Pending | 4 new tab components |
| 5 | Bureau, ESG, SICR, risk, sign-off, PDF | Pending | `SignoffTab.tsx`, `caMemoPdf.service.ts` |
| 6 | PII encryption hardening | Pending | `encryption.util.ts`, backfill script |

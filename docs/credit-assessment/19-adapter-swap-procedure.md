# 19 — Adapter Swap Procedure

> Sprint 6 — Credit Assessment Module  
> Last updated: 2026-05-18

---

## 1. Current Integration Landscape

### Active external integration

| Integration | Location | Protocol | Purpose |
|---|---|---|---|
| **ClamAV** | `security.routes.ts` → `clamav.controller.ts` | TCP (port 3310) | Document virus scanning on upload |

The ClamAV integration is the **only** external adapter currently in the credit module. It is invoked when documents are uploaded to scan for malware before storage.

### No other external adapters exist yet

The following integrations do **not** currently exist in the codebase but are anticipated:

- Credit Bureau (Experian, Dun & Bradstreet)
- Banking Core API
- External Scoring Engine
- Regulatory Reporting API
- KYC/AML Provider

---

## 2. Adapter Swap Procedure

When integrating any new external service, follow this procedure to ensure adapters can be swapped without code changes.

### 2.1 Define a TypeScript Interface (Contract)

Every external integration must have a TypeScript interface that defines the contract. Mock and real implementations both satisfy this interface.

```typescript
// src/credit/adapters/icredit-bureau-provider.ts

export interface ICreditBureauProvider {
  /**
   * Fetch a credit report for a borrower.
   * @param borrowerId - Internal borrower UUID
   * @returns Credit bureau report data
   */
  getReport(borrowerId: string): Promise<CreditBureauReport>;

  /**
   * Check if a report is available for a borrower.
   * @param borrowerId - Internal borrower UUID
   */
  hasReport(borrowerId: string): Promise<boolean>;
}

export interface CreditBureauReport {
  provider: string;
  reportId: string;
  borrowerId: string;
  creditScore: number;
  riskFactors: string[];
  tradeLines: TradeLine[];
  inquiries: Inquiry[];
  fetchedAt: Date;
}
```

```typescript
// src/credit/adapters/iscoring-provider.ts

export interface IScoringProvider {
  /**
   * Calculate a credit score for an application.
   * @param applicationId - Internal application UUID
   * @returns Score calculation result
   */
  calculateScore(applicationId: string): Promise<ScoreResult>;

  /**
   * Validate that required data exists for scoring.
   * @param applicationId - Internal application UUID
   */
  validateInputs(applicationId: string): Promise<ValidationResult>;
}

export interface ScoreResult {
  provider: string;
  applicationId: string;
  score: number;
  riskRating: string;
  factors: ScoreFactor[];
  calculatedAt: Date;
}
```

### 2.2 Use a Factory Pattern to Resolve the Active Adapter

A factory resolves which adapter to use based on environment configuration.

```typescript
// src/credit/adapters/adapter-factory.ts

import { ICreditBureauProvider } from './icredit-bureau-provider';
import { IScoringProvider } from './iscoring-provider';

import { MockCreditBureauProvider } from './mock/mock-credit-bureau-provider';
import { ExperianCreditBureauProvider } from './experian/experian-credit-bureau-provider';
import { DnBCreditBureauProvider } from './dnb/dnb-credit-bureau-provider';

import { MockScoringProvider } from './mock/mock-scoring-provider';
import { InternalScoringProvider } from './internal/internal-scoring-provider';
import { ExternalScoringProvider } from './external/external-scoring-provider';

export class AdapterFactory {
  static getCreditBureauProvider(): ICreditBureauProvider {
    const provider = process.env.CREDIT_BUREAU_PROVIDER || 'mock';

    switch (provider) {
      case 'experian':
        return new ExperianCreditBureauProvider();
      case 'dnb':
        return new DnBCreditBureauProvider();
      case 'mock':
      default:
        return new MockCreditBureauProvider();
    }
  }

  static getScoringProvider(): IScoringProvider {
    const provider = process.env.SCORING_PROVIDER || 'mock';

    switch (provider) {
      case 'internal':
        return new InternalScoringProvider();
      case 'external':
        return new ExternalScoringProvider();
      case 'mock':
      default:
        return new MockScoringProvider();
    }
  }
}
```

### 2.3 Swap Adapters by Changing Configuration, Not Code

Adapters are selected via environment variables. To swap adapters:

1. Update the environment variable (e.g., `CREDIT_BUREAU_PROVIDER=experian`).
2. Restart the application (or use runtime config reload if implemented).
3. No code changes required.

Environment variable pattern:

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `CREDIT_BUREAU_PROVIDER` | `mock` \| `experian` \| `dnb` | `mock` | Select credit bureau adapter |
| `SCORING_PROVIDER` | `mock` \| `internal` \| `external` | `mock` | Select scoring engine adapter |
| `BANKING_CORE_PROVIDER` | `mock` \| `temenos` \| `flexcube` | `mock` | Select banking core adapter |
| `KYC_AML_PROVIDER` | `mock` \| `dowjones` \| `refinitiv` | `mock` | Select KYC/AML adapter |
| `REGULATORY_REPORT_PROVIDER` | `mock` \| `centralbank` | `mock` | Select regulatory reporting adapter |

### 2.4 Mock Adapters for Development and Testing

Every adapter must have a `mock` implementation that:
- Returns deterministic, predefined data.
- Requires no external network calls.
- Is suitable for integration tests.

```typescript
// src/credit/adapters/mock/mock-credit-bureau-provider.ts

import { ICreditBureauProvider, CreditBureauReport } from '../icredit-bureau-provider';

export class MockCreditBureauProvider implements ICreditBureauProvider {
  async getReport(borrowerId: string): Promise<CreditBureauReport> {
    return {
      provider: 'mock',
      reportId: `mock-report-${borrowerId}`,
      borrowerId,
      creditScore: 720,
      riskFactors: ['High utilization', 'Short credit history'],
      tradeLines: [],
      inquiries: [],
      fetchedAt: new Date(),
    };
  }

  async hasReport(borrowerId: string): Promise<boolean> {
    return true; // Always available in mock
  }
}
```

### 2.5 Integration Test Strategy

1. **Write tests against the interface, not the implementation.**
   - Tests use `MockAdapter` by default.
   - Tests verify contract behavior (input/output shapes, error handling).

2. **Run integration tests against mock first:**
   ```bash
   CREDIT_BUREAU_PROVIDER=mock npm run test:integration
   ```

3. **Swap to real adapter for full integration test:**
   ```bash
   CREDIT_BUREAU_PROVIDER=experian npm run test:integration
   ```

4. **CI pipeline** runs mock tests by default. Real-adapter tests are run manually or in a dedicated pipeline with secrets configured.

---

## 3. ClamAV Adapter — Current Implementation

### Architecture

```
Document Upload Request
  → security.routes.ts
    → clamav.controller.ts
      → ClamAV TCP client (port 3310)
        → Scan file buffer
          → Return scan result (clean / infected)
```

### Swap procedure for ClamAV

If ClamAV needs to be replaced with an alternative (e.g., Sophos, Windows Defender):

1. Create `IVirusScanProvider` interface:
   ```typescript
   export interface IVirusScanProvider {
     scanFile(filePath: string): Promise<ScanResult>;
     scanBuffer(buffer: Buffer, filename: string): Promise<ScanResult>;
   }

   export interface ScanResult {
     provider: string;
     isClean: boolean;
     virusName: string | null;
     scannedAt: Date;
   }
   ```

2. Create `ClamAvProvider` implementing `IVirusScanProvider` (wraps current logic).
3. Create `MockVirusScanProvider` returning `{ isClean: true }`.
4. Add `VIRUS_SCAN_PROVIDER` env var (`mock` | `clamav`).
5. Register in `AdapterFactory`.
6. Migrate `clamav.controller.ts` to use the factory.
7. Run integration tests with mock provider, then with real ClamAV.

---

## 4. Current Adapter Registry (as implemented)

The actual adapter registry lives in `backend/src/credit/adapters/registry.ts`. The current
implementation uses lazy singletons wired through provider-specific factory functions:

| Factory function | No-op implementation | Status |
|---|---|---|
| `getAmlProvider()` | `PlaceholderAmlProvider` | Placeholder — no real vendor yet |
| `getOcrProvider()` | `PlaceholderOcrProvider` | Placeholder — no real vendor yet |
| `getBureauProvider()` | **`NoopBureauProvider`** | No-op with boot-time guard (see §4.1 below) |
| `getCbsProvider()` | `PlaceholderCbsProvider` | Placeholder — no real vendor yet |
| `getEsignProvider()` | `PlaceholderEsignProvider` | Placeholder — no real vendor yet |

> **Note:** `PlaceholderBureauProvider` was renamed to `NoopBureauProvider` (in
> `bureau.noop.ts`) as part of the bureau-check surface cleanup. See
> [doc 29 — Bureau Placeholder Cleanup](./29-bureau-placeholder-cleanup-plan.md).

### 4.1 Bureau Provider — Boot-Time Guard

`getBureauProvider()` includes a production-safety guard:

| `NODE_ENV` | `credit:bureau_checks` flag | Real provider? | Behaviour |
|---|---|---|---|
| development / test | any | any | Returns `NoopBureauProvider`, debug log |
| production | `false` (default) | no | Returns `NoopBureauProvider`, **warning** once at boot |
| production | `true` | no | **Throws** — refuses to serve mocks when flag claims bureau is live |
| production | `true` | yes | Returns real provider |

To wire a real bureau vendor (e.g. CTOS), implement `IBureauProvider`, set `BUREAU_PROVIDER=ctos` in env, and update the `loadRealProvider()` stub in `registry.ts`. See Wave 4.3 in [doc 27 — Implementation Plan](./27-implementation-plan-2026-05-29.md).

---

## 5. Future Adapters to Plan For

| Adapter | Interface | Method(s) | Env Var | Priority |
|---|---|---|---|---|
| **Credit Bureau** (Experian/DnB) | `ICreditBureauProvider` | `getReport(borrowerId)`, `hasReport(borrowerId)` | `CREDIT_BUREAU_PROVIDER` | High |
| **Banking Core API** | `IBankingCoreProvider` | `getAccount(borrowerId)`, `getTransactionHistory(accountId)` | `BANKING_CORE_PROVIDER` | Medium |
| **External Scoring Engine** | `IScoringProvider` | `calculateScore(applicationId)`, `validateInputs(applicationId)` | `SCORING_PROVIDER` | High |
| **Regulatory Reporting API** | `IRegulatoryReportProvider` | `submitReport(reportData)`, `getReportStatus(reportId)` | `REGULATORY_REPORT_PROVIDER` | Medium |
| **KYC/AML Provider** | `IKycAmlProvider` | `screenBorrower(borrowerId)`, `getScreeningStatus(screeningId)` | `KYC_AML_PROVIDER` | High |

### Recommended directory structure

```
src/credit/adapters/
├── adapter-factory.ts
├── icredit-bureau-provider.ts
├── iscoring-provider.ts
├── ibanking-core-provider.ts
├── iregulatory-report-provider.ts
├── ikyc-aml-provider.ts
├── ivirus-scan-provider.ts
├── mock/
│   ├── mock-credit-bureau-provider.ts
│   ├── mock-scoring-provider.ts
│   ├── mock-banking-core-provider.ts
│   ├── mock-regulatory-report-provider.ts
│   ├── mock-kyc-aml-provider.ts
│   └── mock-virus-scan-provider.ts
├── experian/
│   └── experian-credit-bureau-provider.ts
├── dnb/
│   └── dnb-credit-bureau-provider.ts
├── internal/
│   └── internal-scoring-provider.ts
├── clamav/
│   └── clamav-virus-scan-provider.ts
└── ... (other real implementations)
```

---

## 6. Verification Checklist

### ClamAV (current)

- [ ] ClamAV is reachable on configured host:port
- [ ] Document upload triggers virus scan
- [ ] Infected file upload returns 400 with descriptive error
- [ ] Clean file upload proceeds to storage
- [ ] ClamAV connection failure is handled gracefully (500 or fallback)

### Adapter factory (after implementation)

- [ ] `AdapterFactory.getCreditBureauProvider()` returns correct provider based on env var
- [ ] Default provider is `mock` when env var is unset
- [ ] Invalid env var value falls back to `mock` with a warning log
- [ ] Each adapter satisfies its TypeScript interface (compile-time check)
- [ ] Mock adapters return deterministic data without network calls
- [ ] Real adapters handle network errors with retries/timeouts

### Swapping adapters

- [ ] Change env var `CREDIT_BUREAU_PROVIDER` from `mock` to `experian`
- [ ] Restart application
- [ ] Verify credit bureau calls go to Experian (check logs)
- [ ] Change back to `mock`
- [ ] Restart application
- [ ] Verify mock data is returned

---

## 7. Notes & Open Questions

1. **Runtime swap** — Can adapters be swapped at runtime without restart? Current design requires restart. Consider config-reload mechanism for zero-downtime swaps.
2. **Health checks** — Each real adapter should expose a health check endpoint. The application `/health` endpoint should aggregate all adapter healths.
3. **Timeouts** — Define reasonable timeout defaults per adapter (e.g., credit bureau: 30s, virus scan: 60s).
4. **Retry policy** — Define retry behavior per adapter (e.g., credit bureau: 3 retries with exponential backoff, virus scan: no retry).
5. **Circuit breaker** — Consider implementing circuit breaker pattern for external adapters to prevent cascading failures.
6. **Secrets management** — API keys for external providers (Experian, DnB) should be stored in vault, not env vars directly.
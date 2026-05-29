import type { ApplicationType, AccountClassification, AccountStrategy, BureauProvider } from '../services/credit.service';

// CA Memo Phase 1 — centralized enum option arrays.
// Single source of truth for labels; enum keys stay English for DB wire format.
// Future i18n: swap label values, keys remain stable.

export const APPLICATION_TYPE_OPTIONS: { value: ApplicationType; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'ADDITIONAL', label: 'Additional' },
  { value: 'RENEWAL', label: 'Renewal' },
  { value: 'VARIATION', label: 'Variation' },
];

export const ACCOUNT_CLASSIFICATION_OPTIONS: { value: AccountClassification; label: string }[] = [
  { value: 'PERFORMING', label: 'Performing' },
  { value: 'EARLY_CARE', label: 'Early Care' },
  { value: 'WATCHLIST', label: 'Watchlist' },
  { value: 'NON_CCRIS_RR', label: 'Non-CCRIS R&R' },
  { value: 'CCRIS_RR', label: 'CCRIS R&R' },
  { value: 'IMPAIRED', label: 'Impaired' },
];

export const ACCOUNT_STRATEGY_OPTIONS: { value: AccountStrategy; label: string }[] = [
  { value: 'GROW', label: 'Grow' },
  { value: 'MAINTAIN', label: 'Maintain' },
  { value: 'EXIT', label: 'Exit' },
];

// ── Bureau Provider (Phase 5) ────────────────────────────────────────────
// CCRIS is excluded from selectable options — it is retained for historical
// rows only. New manual checks should default to CCRIS_BORROWER_UPLOAD.
export const BUREAU_PROVIDER_OPTIONS: { value: BureauProvider; label: string }[] = [
  { value: 'CCRIS_BORROWER_UPLOAD', label: 'CCRIS (borrower self-pull via eCCRIS)' },
  { value: 'CTOS', label: 'CTOS' },
  { value: 'EXPERIAN', label: 'Experian RAMCI' },
  { value: 'CBM', label: 'Credit Bureau Malaysia (CBM)' },
  { value: 'SSM_EINFO', label: 'SSM e-Info' },
  { value: 'BANK_STATEMENT_ANALYSIS', label: 'Bank Statement Analysis' },
  { value: 'PEP_WATCHLIST', label: 'PEP / Sanctions / Watchlist' },
  { value: 'IF_ACTIVA', label: 'IF Activa' },
  { value: 'PUBLIC_DOMAIN', label: 'Public Domain (news, registries)' },
];

/** Human-readable label lookup — returns the enum key itself if no match found. */
export const applicationTypeLabel = (v: ApplicationType | null | undefined) =>
  APPLICATION_TYPE_OPTIONS.find(o => o.value === v)?.label ?? (v ?? '—');

export const accountClassificationLabel = (v: AccountClassification | null | undefined) =>
  ACCOUNT_CLASSIFICATION_OPTIONS.find(o => o.value === v)?.label ?? (v ?? '—');

export const accountStrategyLabel = (v: AccountStrategy | null | undefined) =>
  ACCOUNT_STRATEGY_OPTIONS.find(o => o.value === v)?.label ?? (v ?? '—');

export const bureauProviderLabel = (v: BureauProvider | null | undefined): string => {
  if (v === 'CCRIS') return 'CCRIS (legacy — do not select)';
  return BUREAU_PROVIDER_OPTIONS.find(o => o.value === v)?.label ?? (v ?? '—');
};
import type { ApplicationType, AccountClassification, AccountStrategy } from '../services/credit.service';

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

/** Human-readable label lookup — returns the enum key itself if no match found. */
export const applicationTypeLabel = (v: ApplicationType | null | undefined) =>
  APPLICATION_TYPE_OPTIONS.find(o => o.value === v)?.label ?? (v ?? '—');

export const accountClassificationLabel = (v: AccountClassification | null | undefined) =>
  ACCOUNT_CLASSIFICATION_OPTIONS.find(o => o.value === v)?.label ?? (v ?? '—');

export const accountStrategyLabel = (v: AccountStrategy | null | undefined) =>
  ACCOUNT_STRATEGY_OPTIONS.find(o => o.value === v)?.label ?? (v ?? '—');
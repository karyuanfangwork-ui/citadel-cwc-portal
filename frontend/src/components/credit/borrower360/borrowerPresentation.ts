import type { ApplicationState, CreditProductType } from '../../../services/credit.service';
import type { BorrowerReadinessStatus } from './borrowerReadiness';

const titleCaseEnum = (value: string): string => value
  .toLowerCase()
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

export function formatBorrowerType(type: string): string {
  const labels: Record<string, string> = {
    INDIVIDUAL: 'Individual',
    CORPORATE: 'Corporate',
    SOLE_PROPRIETOR: 'Sole proprietor',
    SME: 'SME',
    JOINT: 'Joint',
  };
  return labels[type] ?? titleCaseEnum(type);
}

export function formatApplicationState(state: ApplicationState): string {
  return titleCaseEnum(state);
}

export function formatProductType(type: CreditProductType): string {
  const labels: Record<CreditProductType, string> = {
    TERM_LOAN: 'Term loan',
    REVOLVING_CREDIT: 'Revolving credit',
    TRADE_FINANCE: 'Trade finance',
    PROJECT_FINANCE: 'Project finance',
    SYNDICATED: 'Syndicated',
    BRIDGE_LOAN: 'Bridge loan',
    OVERDRAFT: 'Overdraft',
    LETTER_OF_CREDIT: 'Letter of credit',
    BANK_GUARANTEE: 'Bank guarantee',
  };
  return labels[type] ?? titleCaseEnum(type);
}

export function formatBorrowerDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatMyr(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—';
  const number = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-MY', {
    style: 'currency', currency: 'MYR', maximumFractionDigits: 0,
  }).format(number);
}

/** Format a Malaysian 12-digit NRIC while leaving passport values unchanged. */
export function formatMalaysianNric(value: string | null | undefined): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  return /^\d{12}$/.test(digits)
    ? `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`
    : value;
}

/** Format numeric NRIC input progressively; preserve passport/alphanumeric input. */
export function formatMalaysianNricInput(value: string): string {
  if (!/^[\d\s-]*$/.test(value)) return value;
  const digits = value.replace(/\D/g, '').slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

export function getApplicationStateTone(state: ApplicationState): 'neutral' | 'info' | 'warn' | 'pos' | 'neg' {
  if (['REJECTED', 'WITHDRAWN', 'CLOSED', 'KYC_REJECTED'].includes(state)) return 'neg';
  if (['APPROVED', 'ACCEPTED', 'DISBURSED', 'ACTIVE'].includes(state)) return 'pos';
  if (['COMPLIANCE_HOLD', 'REFERRED_BACK', 'CONDITION_FULFILMENT'].includes(state)) return 'warn';
  if (['SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW', 'OFFER'].includes(state)) return 'info';
  return 'neutral';
}

export function getReadinessTone(status: BorrowerReadinessStatus): 'pos' | 'warn' | 'neg' {
  if (status === 'READY') return 'pos';
  if (status === 'WARNING') return 'warn';
  return 'neg';
}

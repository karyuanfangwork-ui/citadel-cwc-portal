export type OperationalSegment = 'INDIVIDUAL' | 'SME' | 'CORPORATE';
export type OperationalLifecycleStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export function mapBorrowerSegment(borrowerType: string): OperationalSegment {
  switch (borrowerType) {
    case 'INDIVIDUAL':
    case 'JOINT':
      return 'INDIVIDUAL';
    case 'SOLE_PROPRIETOR':
      return 'SME';
    case 'CORPORATE':
    default:
      // Corporate legal type is not enough evidence to reclassify a borrower
      // as SME; leave it CORPORATE for explicit business review.
      return 'CORPORATE';
  }
}

export function mapBorrowerLifecycle(isActive: boolean): OperationalLifecycleStatus {
  return isActive ? 'ACTIVE' : 'INACTIVE';
}

export function formatBorrowerNumber(sequenceValue: number): string {
  if (!Number.isSafeInteger(sequenceValue) || sequenceValue < 1) {
    throw new Error('Borrower number sequence must be a positive safe integer');
  }
  return `BRW-${String(sequenceValue).padStart(6, '0')}`;
}

export function chooseUnambiguousOwner(ownerIds: Array<string | null | undefined>): string | null {
  const uniqueIds = [...new Set(ownerIds.filter((id): id is string => Boolean(id)))];
  return uniqueIds.length === 1 ? uniqueIds[0] : null;
}

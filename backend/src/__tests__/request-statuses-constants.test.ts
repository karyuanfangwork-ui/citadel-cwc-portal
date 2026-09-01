import { describe, it, expect } from '@jest/globals';
import { RequestStatus } from '../constants/requestStatusCompat';
import { CLOSED_STATUSES, RESOLVED_STATUSES } from '../constants/requestStatuses';

describe('CANCELLED status classification', () => {
    it('is present in the RequestStatus enum', () => {
        expect(RequestStatus.CANCELLED).toBe('CANCELLED');
    });

    it('is treated as a closed/terminal status', () => {
        expect(CLOSED_STATUSES).toContain(RequestStatus.CANCELLED);
    });

    it('is NOT treated as a positively resolved status', () => {
        expect(RESOLVED_STATUSES).not.toContain(RequestStatus.CANCELLED);
    });
});
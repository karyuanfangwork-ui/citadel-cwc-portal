import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '../relativeTime';

const NOW = new Date('2026-09-02T12:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW.getTime() - offsetMs).toISOString();

describe('formatRelativeTime', () => {
    afterEach(() => vi.useRealTimers());

    const freeze = () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    };

    it.each([
        [null, 'Never'],
        [undefined, 'Never'],
        ['not-a-date', 'Never'],
        [at(30 * 1000), 'Just now'],
        [at(60 * 1000), '1 minute ago'],
        [at(5 * 60 * 1000), '5 minutes ago'],
        [at(3 * 60 * 60 * 1000), '3 hours ago'],
        [at(12 * 24 * 60 * 60 * 1000), '12 days ago'],
        [at(70 * 24 * 60 * 60 * 1000), '2 months ago'],
        [at(400 * 24 * 60 * 60 * 1000), '1 year ago'],
    ])('formats %s as %s', (value, expected) => {
        freeze();
        expect(formatRelativeTime(value as string | null | undefined)).toBe(expected);
    });

    it('accepts a Date and treats future timestamps as Just now', () => {
        freeze();
        expect(formatRelativeTime(new Date(NOW.getTime() - 2 * 60 * 60 * 1000))).toBe('2 hours ago');
        expect(formatRelativeTime(at(-60 * 1000))).toBe('Just now');
    });
});

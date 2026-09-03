/**
 * Coarse human-readable relative time for admin tables.
 */
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function plural(count: number, unit: string): string {
    return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
    if (value === null || value === undefined) return 'Never';

    const date = value instanceof Date ? value : new Date(value);
    const ms = date.getTime();
    if (Number.isNaN(ms)) return 'Never';

    const diff = Date.now() - ms;
    if (diff < MINUTE) return 'Just now';
    if (diff < HOUR) return plural(Math.floor(diff / MINUTE), 'minute');
    if (diff < DAY) return plural(Math.floor(diff / HOUR), 'hour');
    if (diff < MONTH) return plural(Math.floor(diff / DAY), 'day');
    if (diff < YEAR) return plural(Math.floor(diff / MONTH), 'month');
    return plural(Math.floor(diff / YEAR), 'year');
}

export function formatAbsoluteTime(value: string | Date | null | undefined): string {
    if (value === null || value === undefined) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
}

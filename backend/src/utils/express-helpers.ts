import { Request } from 'express';

/**
 * Express v5 types req.params as Record<string, string | string[]>, 
 * but in practice params are always strings. This helper safely extracts
 * a single param value as string.
 */
export function getParam(req: Request, name: string): string {
    const val = req.params[name];
    return Array.isArray(val) ? val[0] : (val ?? '');
}

/**
 * Express v5 types req.query values as string | string[] | QueryString.ParsedQs | undefined.
 * This helper safely extracts a single query value as string.
 */
export function getQuery(req: Request, name: string): string {
    const val = req.query[name];
    if (Array.isArray(val)) return String(val[0] ?? '');
    return typeof val === 'string' ? val : String(val ?? '');
}

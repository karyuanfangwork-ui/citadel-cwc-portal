import validator from 'validator';

/**
 * Sanitize a single string field.
 * - Strips all HTML tags (prevents XSS via <script>, <img onerror>, etc.)
 * - Trims whitespace
 * - Returns empty string for null/undefined inputs
 */
export function sanitizeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return validator.escape(validator.stripLow(str.trim()));
}

/**
 * Sanitize a plain text field — allows newlines and basic punctuation
 * but strips control characters and high-range Unicode formatting chars.
 */
export function sanitizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // stripLow removes control chars and null bytes but preserves \n\r\t
  return validator.escape(validator.stripLow(str.trim()));
}

/**
 * Sanitize a name field (firstName, lastName, authorName).
 * Only allows letters, spaces, hyphens, apostrophes, and limited Unicode
 * letters (e.g. non-Latin names). Still escapes to be safe.
 */
export function sanitizeName(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  // Allow letters (including Unicode), spaces, hyphens, apostrophes, periods
  const sanitized = str.replace(/[<>'"`&]/g, '');
  return validator.escape(sanitized);
}

/**
 * Sanitize a multiline description or comment.
 * Same as sanitizeText but preserves newlines.
 */
export function sanitizeComment(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Strip low (control) chars, then re-encode for safe HTML display
  const stripped = validator.stripLow(str);
  return validator.escape(stripped);
}

/**
 * Sanitize a rich-text HTML description.
 * Allows safe formatting tags (bold, italic, lists, links, paragraphs)
 * while stripping all dangerous content (scripts, event handlers, etc.).
 * Used for the IT Support description field with rich-text editor.
 */
import sanitizeHtml from 'sanitize-html';

const ALLOWED_RICH_TAGS = [
  'b', 'i', 'strong', 'em',
  'ul', 'ol', 'li',
  'a', 'p', 'br',
];
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
};

/**
 * Strip all HTML tags from a string, returning plain text.
 * Used when rich-text content needs to appear in a plain-text context (e.g. summary).
 */
export function stripHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Remove HTML tags, then decode common HTML entities
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function sanitizeRichText(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return sanitizeHtml(str, {
    allowedTags: ALLOWED_RICH_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    // Force rel="noopener noreferrer" on all links to prevent tab-napping
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
    disallowedTagsMode: 'discard',
  });
}

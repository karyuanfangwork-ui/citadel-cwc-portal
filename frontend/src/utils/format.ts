/**
 * Strip all HTML tags from a string, returning plain text.
 * Handles common HTML entities as well.
 */
export function stripHtml(html: string): string {
    if (!html) return '';
    const decoded = html
        // Decode numeric entities first so encoded closing tags such as
        // &lt;&#x2F;p&gt; become valid markup before tags are removed.
        .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&nbsp;/gi, ' ');

    return decoded
        .replace(/<[^>]*>/g, '')
        .trim();
}
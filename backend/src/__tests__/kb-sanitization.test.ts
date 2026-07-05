/**
 * P1-13 — XSS regression tests for KB content sanitization
 *
 * Verifies that sanitizeKBContent strips dangerous HTML while preserving
 * safe rich-text formatting used by TipTap/ProseMirror.
 */

import { sanitizeKBContent, sanitizeString } from '../utils/sanitize';

describe('P1-13: KB content XSS sanitization', () => {
    describe('sanitizeKBContent', () => {
        it('strips <script> tags', () => {
            const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
            const result = sanitizeKBContent(input);
            expect(result).not.toContain('<script');
            expect(result).not.toContain('alert');
            expect(result).toContain('<p>Hello</p>');
            expect(result).toContain('<p>World</p>');
        });

        it('strips on* event handlers', () => {
            const input = '<p onclick="alert(1)">Click me</p><img src="x" onerror="alert(2)">';
            const result = sanitizeKBContent(input);
            expect(result).not.toContain('onclick');
            expect(result).not.toContain('onerror');
            expect(result).toContain('Click me');
        });

        it('strips javascript: URLs in href', () => {
            const input = '<a href="javascript:alert(1)">Click</a>';
            const result = sanitizeKBContent(input);
            expect(result).not.toContain('javascript:');
            // sanitize-html removes the href entirely for bad schemes
            expect(result).toContain('Click');
        });

        it('strips data: URLs in href', () => {
            const input = '<a href="data:text/html,<script>alert(1)</script>">Data</a>';
            const result = sanitizeKBContent(input);
            expect(result).not.toContain('data:');
        });

        it('strips <iframe>, <object>, <embed>, <applet>', () => {
            const tags = ['iframe', 'object', 'embed', 'applet'];
            for (const tag of tags) {
                const input = `<p>Before</p><${tag} src="evil"></${tag}><p>After</p>`;
                const result = sanitizeKBContent(input);
                expect(result).not.toContain(`<${tag}`);
                expect(result).toContain('<p>Before</p>');
                expect(result).toContain('<p>After</p>');
            }
        });

        it('preserves safe formatting tags', () => {
            const input = '<h2>Title</h2><p><strong>Bold</strong> <em>Italic</em> <u>Underline</u></p>';
            const result = sanitizeKBContent(input);
            expect(result).toContain('<h2>Title</h2>');
            expect(result).toContain('<strong>Bold</strong>');
            expect(result).toContain('<em>Italic</em>');
            expect(result).toContain('<u>Underline</u>');
        });

        it('preserves tables', () => {
            const input = '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>';
            const result = sanitizeKBContent(input);
            expect(result).toContain('<table>');
            expect(result).toContain('<th>H</th>');
            expect(result).toContain('<td>D</td>');
        });

        it('preserves images with valid src', () => {
            const input = '<img src="https://example.com/img.png" alt="desc" width="100">';
            const result = sanitizeKBContent(input);
            expect(result).toContain('src="https://example.com/img.png"');
            expect(result).toContain('alt="desc"');
        });

        it('adds rel=noopener to links', () => {
            const input = '<a href="https://example.com">Link</a>';
            const result = sanitizeKBContent(input);
            expect(result).toContain('rel="noopener noreferrer"');
            expect(result).toContain('target="_blank"');
        });

        it('preserves lists', () => {
            const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
            const result = sanitizeKBContent(input);
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>Item 1</li>');
        });

        it('returns empty string for null/undefined', () => {
            expect(sanitizeKBContent(null)).toBe('');
            expect(sanitizeKBContent(undefined)).toBe('');
        });
    });

    describe('sanitizeString (KB title/excerpt)', () => {
        it('strips all HTML from title', () => {
            const input = '<script>alert(1)</script>Hello <b>World</b>';
            const result = sanitizeString(input);
            expect(result).not.toContain('<script');
            expect(result).not.toContain('<b>');
            expect(result).toContain('Hello');
        });

        it('returns empty string for null/undefined', () => {
            expect(sanitizeString(null)).toBe('');
            expect(sanitizeString(undefined)).toBe('');
        });
    });
});
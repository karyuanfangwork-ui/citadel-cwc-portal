/**
 * Branded email layout wrapper for CWC 2.0
 *
 * Wraps inner email body HTML in a consistent branded shell
 * with header, footer, and responsive styling.
 * Used by email.service.ts sendEmail() by default.
 */

export interface EmailLayoutOptions {
  subject: string;
  innerHtml: string;
  appUrl?: string;
  year?: number;
}

const CURRENT_YEAR = new Date().getFullYear();

export function emailLayout(options: EmailLayoutOptions): string {
  const { subject, innerHtml, appUrl = 'http://localhost:5173', year = CURRENT_YEAR } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    /* Reset */
    body, html { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; }

    /* Layout */
    .email-wrapper { width: 100%; background-color: #f4f5f7; padding: 32px 16px; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

    /* Header */
    .email-header { background-color: #1a1a2e; padding: 24px 32px; }
    .email-header h1 { margin: 0; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 0.02em; }
    .email-header .subtitle { color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    /* Body */
    .email-body { padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #333333; }

    /* Footer */
    .email-footer { padding: 20px 32px; border-top: 1px solid #eeeeee; background-color: #fafafa; }
    .email-footer p { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #999999; line-height: 1.5; }
    .email-footer a { color: #1a1a2e; text-decoration: none; }

    /* Responsive */
    @media only screen and (max-width: 620px) {
      .email-wrapper { padding: 8px; }
      .email-body { padding: 20px; }
      .email-header { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <!-- Header -->
      <div class="email-header">
        <h1>Citadel Help Center</h1>
        <div class="subtitle">Enterprise Service Desk</div>
      </div>

      <!-- Body -->
      <div class="email-body">
        ${innerHtml}
      </div>

      <!-- Footer -->
      <div class="email-footer">
        <p>&copy; ${year} Citadel Group Technologies Sdn Bhd. All rights reserved.</p>
        <p style="margin-top: 8px;">
          You received this email because you have an account on the
          <a href="${appUrl}">Citadel Help Center</a>.
          If you believe this was sent in error, please contact your system administrator.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate a plain-text version from inner HTML.
 * Strips tags and normalizes whitespace for the text/plain MIME part.
 */
export function htmlToPlainText(html: string): string {
  return html
    // Replace <br> and <br/> with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Replace block-level tags with double newlines
    .replace(/<\/(p|h[1-6]|div|li|tr|table)>/gi, '\n')
    // Replace </td> with a space (table cells side by side)
    .replace(/<\/td>/gi, ' ')
    // Convert links: <a href="url">text</a> → text (url)
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
import { Resend } from 'resend';
import { config } from '../config';
import { logger } from '../utils/logger';
import { emailLayout, htmlToPlainText } from '../templates/email-layout';

const resend = new Resend(config.email.resendApiKey);

export interface SendEmailOptions {
  /** If true, wrap body HTML in the branded email layout (default: true) */
  wrapInLayout?: boolean;
  /** If true, include a text/plain alternative derived from HTML (default: true) */
  includeTextFallback?: boolean;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  options: SendEmailOptions = {}
): Promise<boolean> {
  const { wrapInLayout = true, includeTextFallback = true } = options;

  // Silently skip if Resend is not configured (no API key)
  if (!config.email.resendApiKey) {
    logger.warn(`Resend not configured — email to ${to} skipped (set RESEND_API_KEY to enable)`);
    return false;
  }

  // Dev workaround: redirect all emails to a single recipient when using
  // Resend's test domain (onboarding@resend.dev can only send to account owner)
  const devRecipient = config.email.devRecipient;
  const actualTo = devRecipient ? devRecipient : to;
  if (devRecipient && devRecipient !== to) {
    logger.info(`[DEV] Email redirect: ${to} → ${devRecipient}`);
  }

  const htmlContent = wrapInLayout
    ? emailLayout({ subject, innerHtml: body, appUrl: config.app.url })
    : body;

  const textContent = includeTextFallback
    ? htmlToPlainText(htmlContent)
    : undefined;

  try {
    const { error } = await resend.emails.send({
      from: config.email.from,
      to: actualTo,
      subject,
      html: htmlContent,
      ...(textContent ? { text: textContent } : {}),
      replyTo: config.email.replyTo,
    });

    if (error) {
      logger.error(`Resend error sending to ${to}: ${error.message}`);
      return false;
    }

    logger.info(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${to}`, { error });
    return false;
  }
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}
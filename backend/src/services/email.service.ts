import { Resend } from 'resend';
import { config } from '../config';
import { logger } from '../utils/logger';

const resend = new Resend(config.email.resendApiKey);

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  // Silently skip if Resend is not configured (no API key)
  if (!config.email.resendApiKey) {
    logger.warn(`Resend not configured — email to ${to} skipped (set RESEND_API_KEY to enable)`);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: config.email.from,
      to,
      subject,
      html: body,
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

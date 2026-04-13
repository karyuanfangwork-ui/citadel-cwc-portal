import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.secure,
  auth: config.email.smtp.user
    ? { user: config.email.smtp.user, pass: config.email.smtp.password }
    : undefined,
});

export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html: body,
    });
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

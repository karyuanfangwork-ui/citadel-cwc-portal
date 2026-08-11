export function maskPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

export function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const [local, domain] = value.split('@');
  if (!domain) return '****';
  const visibleLocal = local.length > 1 ? `${local[0]}***` : '*';
  return `${visibleLocal}@${domain}`;
}

export function maskPrimaryContact(phone: string | null | undefined, email: string | null | undefined): string | null {
  return phone ? maskPhone(phone) : maskEmail(email);
}

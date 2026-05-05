const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g;

export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) {
    return email;
  }

  const visible = localPart.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(localPart.length - 2, 3))}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 4) {
    return '****';
  }

  return `${'*'.repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
}

export function maskPii(value: unknown): string {
  const text =
    typeof value === 'string' ? value : (JSON.stringify(value, null, 0) ?? '');

  return text
    .replace(EMAIL_PATTERN, (match: string) => maskEmail(match))
    .replace(PHONE_PATTERN, (match: string) => maskPhone(match));
}

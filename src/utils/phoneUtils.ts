/**
 * Utility functions for formatting and validating telephone and WhatsApp links
 */

/**
 * Validates if the phone string contains a plausible phone number (at least 10 digits)
 */
export function isValidPhoneNumber(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

/**
 * Normalizes phone number for telephone link: tel:<number>
 * Preserves leading '+' for international country codes, removes spaces, dashes, and parentheses.
 */
export function formatTelHref(phone?: string | null): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return `tel:${hasPlus ? '+' : ''}${digits}`;
}

/**
 * Converts phone number to official WhatsApp click-to-chat format:
 * https://wa.me/<international-phone-number>
 * Requirements:
 * - Numbers in international format without spaces, dashes, parentheses, or '+'
 * - If 10 digits (standard Indian mobile without country code), default to country code '91'
 */
export function formatWhatsAppUrl(phone?: string | null, message?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // If 10 digits without country code, prepend India's code (91)
  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  const base = `https://wa.me/${digits}`;
  if (message && message.trim()) {
    return `${base}?text=${encodeURIComponent(message.trim())}`;
  }
  return base;
}

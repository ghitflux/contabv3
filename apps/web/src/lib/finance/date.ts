/**
 * Date utilities for the financial module.
 *
 * IMPORTANT: `new Date("YYYY-MM-DD")` parses date-only strings as UTC midnight.
 * In UTC-3 (Brazil), this causes the displayed date to be 1 day earlier than
 * intended. These helpers parse date-only strings in LOCAL time to avoid the shift.
 */

/**
 * Parse a date-only string (YYYY-MM-DD) as a local-time Date, not UTC.
 * Handles strings with optional time component by ignoring it.
 *
 * @returns A Date at local midnight, or null if the input is invalid.
 */
export const parseLocalDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const datePart = value.split('T')[0];
  if (!datePart) return null;
  const parts = datePart.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return null;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Format a date string (YYYY-MM-DD or ISO) as a pt-BR date (DD/MM/YYYY).
 * Returns '-' for null/invalid inputs.
 */
export const formatLocalDate = (value?: string | null): string => {
  const d = parseLocalDate(value);
  if (!d) return '-';
  return d.toLocaleDateString('pt-BR');
};

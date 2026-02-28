/**
 * Helpers for parsing and normalizing BRL amounts from form inputs.
 */

const EPSILON = Number.EPSILON;

export const roundCurrency = (value: number): number =>
  Math.round((value + EPSILON) * 100) / 100;

export const parseAmountInput = (value: string | number | null | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value !== "string") {
    return Number.NaN;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return Number.NaN;
  }

  // Keep only digits/sign/separators and remove optional currency prefix.
  let normalized = trimmed
    .replace(/\s+/g, "")
    .replace(/^R\$/i, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized || normalized === "-" || normalized === "," || normalized === ".") {
    return Number.NaN;
  }

  const commaCount = (normalized.match(/,/g) || []).length;
  const dotCount = (normalized.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    // Assume the rightmost separator is the decimal separator.
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    const decimalIsComma = lastComma > lastDot;

    if (decimalIsComma) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (commaCount > 0) {
    // Common pt-BR format: 1.234,56
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (dotCount > 1) {
    // Keep only last dot as decimal separator.
    const lastDot = normalized.lastIndexOf(".");
    normalized =
      normalized.slice(0, lastDot).replace(/\./g, "") + normalized.slice(lastDot);
  } else if (dotCount === 1) {
    // Heuristic: a single dot with 3 digits after is likely thousands separator.
    const [intPart = "", fractionPart = ""] = normalized.split(".");
    if (fractionPart.length === 3 && intPart.length >= 1) {
      normalized = `${intPart}${fractionPart}`;
    }
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const normalizeAmountForRequest = (
  value: string | number | null | undefined
): number => {
  const parsed = parseAmountInput(value);
  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }
  return roundCurrency(parsed);
};

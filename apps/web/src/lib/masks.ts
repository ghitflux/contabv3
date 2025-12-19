/**
 * Input masks and formatters for common Brazilian formats
 */

/**
 * Format CNPJ (XX.XXX.XXX/XXXX-XX)
 */
export function formatCNPJ(value: string | undefined | null): string {
  if (!value) return "";

  const numbers = value.replace(/\D/g, "");

  if (numbers.length <= 14) {
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return numbers.slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/**
 * Format CPF (XXX.XXX.XXX-XX)
 */
export function formatCPF(value: string | undefined | null): string {
  if (!value) return "";

  const numbers = value.replace(/\D/g, "");

  if (numbers.length <= 11) {
    return numbers
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return numbers.slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/**
 * Format phone number (XX) XXXXX-XXXX or (XX) XXXX-XXXX
 */
export function formatPhone(value: string | undefined | null): string {
  if (!value) return "";

  const numbers = value.replace(/\D/g, "");

  if (numbers.length <= 10) {
    return numbers
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return numbers
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

/**
 * Format CEP (XXXXX-XXX)
 */
export function formatCEP(value: string | undefined | null): string {
  if (!value) return "";

  const numbers = value.replace(/\D/g, "");

  return numbers.replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
}

/**
 * Format currency (BRL)
 */
export function formatCurrency(value: number | string | undefined | null): string {
  if (value === null || value === undefined) return "R$ 0,00";

  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(numValue)) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number | string | undefined | null, decimals: number = 2): string {
  if (value === null || value === undefined) return "0%";

  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(numValue)) return "0%";

  return `${numValue.toFixed(decimals)}%`;
}

/**
 * Format date (DD/MM/YYYY)
 */
export function formatDate(value: string | Date | undefined | null): string {
  if (!value) return "";

  const date = typeof value === "string" ? new Date(value) : value;

  if (isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

/**
 * Format date and time (DD/MM/YYYY HH:mm)
 */
export function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return "";

  const date = typeof value === "string" ? new Date(value) : value;

  if (isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Remove all non-numeric characters
 */
export function onlyNumbers(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

/**
 * Mask input for CNPJ
 */
export function maskCNPJ(value: string): string {
  return formatCNPJ(value);
}

/**
 * Mask input for CPF
 */
export function maskCPF(value: string): string {
  return formatCPF(value);
}

/**
 * Mask input for phone
 */
export function maskPhone(value: string): string {
  return formatPhone(value);
}

/**
 * Mask input for CEP
 */
export function maskCEP(value: string): string {
  return formatCEP(value);
}

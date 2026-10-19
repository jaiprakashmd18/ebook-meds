/**
 * Currency strategy
 * -----------------
 * All amounts are integers in the currency's minor unit (paise for INR,
 * cents for USD). Every price, order and order item stores its ISO 4217
 * currency code alongside the amount. Amounts in different currencies are
 * never summed together; reports group by currency. No floating-point
 * arithmetic is used for money anywhere in the application.
 */

const MINOR_UNIT_DIGITS: Record<string, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
};

export function minorUnitDigits(currency: string): number {
  return MINOR_UNIT_DIGITS[currency.toUpperCase()] ?? 2;
}

export function formatMoney(amountMinor: number, currency: string): string {
  if (!Number.isInteger(amountMinor)) throw new Error("Money amounts must be integers in minor units");
  const digits = minorUnitDigits(currency);
  const divisor = 10 ** digits;
  const whole = amountMinor / divisor; // display only, never stored
  const hasFraction = amountMinor % divisor !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: hasFraction ? digits : 0,
    maximumFractionDigits: digits,
  }).format(whole);
}

/** Parse a user-entered major-unit string ("249" or "249.50") into minor units without floats. */
export function parseMajorToMinor(input: string, currency: string): number | null {
  const digits = minorUnitDigits(currency);
  const trimmed = input.trim();
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`);
  if (!pattern.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const padded = (fraction + "0".repeat(digits)).slice(0, digits);
  const value = Number(whole) * 10 ** digits + (digits ? Number(padded) : 0);
  return Number.isSafeInteger(value) ? value : null;
}

export function minorToMajorString(amountMinor: number, currency: string): string {
  const digits = minorUnitDigits(currency);
  if (digits === 0) return String(amountMinor);
  const s = String(Math.abs(amountMinor)).padStart(digits + 1, "0");
  const sign = amountMinor < 0 ? "-" : "";
  return `${sign}${s.slice(0, -digits)}.${s.slice(-digits)}`;
}

export type DiscountType = "percent" | "fixed";

/**
 * Compute a discount in minor units. Percent discounts use integer basis
 * points and round down so the customer is never charged less than intended
 * by rounding drift. Fixed discounts must be in the order's currency.
 */
export function computeDiscount(
  subtotalMinor: number,
  discount: { type: DiscountType; value: number },
): number {
  if (subtotalMinor <= 0) return 0;
  if (discount.type === "percent") {
    const pct = Math.min(Math.max(Math.trunc(discount.value), 0), 100);
    return Math.floor((subtotalMinor * pct) / 100);
  }
  return Math.min(Math.max(Math.trunc(discount.value), 0), subtotalMinor);
}

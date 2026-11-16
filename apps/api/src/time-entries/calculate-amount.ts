// Rates are numeric(18, 6). Calculate in integers, then round half-up to
// the currency's minor unit without passing monetary values through Number.
export function calculateAmount(
  rate: string,
  currency: string,
  durationMs: number,
) {
  if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
    throw new Error('Invalid duration');
  }
  if (!/^\d{1,12}(?:\.\d{1,6})?$/.test(rate)) {
    throw new Error('Invalid hourly rate');
  }
  const digits =
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  if (digits > 6) throw new Error('Unsupported currency precision');
  const [whole, fraction = ''] = rate.split('.');
  const rateUnits = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  const numerator = BigInt(durationMs) * rateUnits;
  const denominator = 3600000n * 10n ** BigInt(6 - digits);
  const minorUnits = (numerator + denominator / 2n) / denominator;
  if (digits === 0) return minorUnits.toString();
  const scale = 10n ** BigInt(digits);
  return `${minorUnits / scale}.${(minorUnits % scale).toString().padStart(digits, '0')}`;
}

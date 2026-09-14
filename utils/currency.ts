// Single formatter for money, matching the admin dashboard's own
// lib/utils.ts formatCurrency (same locale/currency/thousands-separator
// choice) — this screen used to hand-roll `$${n.toFixed(2)}`, so a $1,234
// quote showed as "$1234.00" here while the admin Quotes page showed
// "$1,234.00" for the exact same value.
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}

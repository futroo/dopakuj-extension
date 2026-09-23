import type { Money } from '../types/offers';

export function parsePolishPrice(input?: string | null): Money | undefined {
  if (!input) return undefined;
  const normalized = input.replace(/\u00a0/g, ' ').trim();
  const match = normalized.match(/(-?[\d\s.]+(?:,\d{1,2})?)/);
  if (!match?.[1]) return undefined;
  const amount = Number(match[1].replace(/[\s.]/g, '').replace(',', '.'));
  if (!Number.isFinite(amount)) return undefined;
  const currency = /EUR|€/.test(normalized) ? 'EUR' : /USD|\$/.test(normalized) ? 'USD' : 'PLN';
  return { amount, currency, formatted: normalized };
}

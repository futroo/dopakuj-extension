import type { OfferSearchResult } from '../types/offers';

export function deduplicateOffers(offers: OfferSearchResult[]): OfferSearchResult[] {
  const seen = new Set<string>();
  return offers.filter((offer) => {
    const key = offer.id || offer.offerUrl;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

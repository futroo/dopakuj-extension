import { ALLEGRO_ORIGIN } from '../constants/allegro';

export function extractSellerLogin(value: string): string | undefined {
  try {
    const url = new URL(value, ALLEGRO_ORIGIN);
    if (url.protocol !== 'https:' || !(url.hostname === 'allegro.pl' || url.hostname.endsWith('.allegro.pl'))) return undefined;
    const match = url.pathname.match(/^\/uzytkownik\/([^/?#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]).trim() : undefined;
  } catch {
    return undefined;
  }
}

export function buildSellerShopUrl(login: string): string {
  const url = new URL(`/uzytkownik/${encodeURIComponent(login)}`, ALLEGRO_ORIGIN);
  return url.toString();
}

export function buildSellerSearchUrl(login: string, query: string, page = 1): string {
  const url = new URL(`/uzytkownik/${encodeURIComponent(login)}`, ALLEGRO_ORIGIN);
  url.searchParams.set('string', query);
  if (page > 1) url.searchParams.set('p', String(page));
  return url.toString();
}

export function normalizeOfferUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, ALLEGRO_ORIGIN);
    if (url.protocol !== 'https:' || !(url.hostname === 'allegro.pl' || url.hostname.endsWith('.allegro.pl'))) return undefined;
    const isOfferPath = /^\/oferta\//.test(url.pathname);
    const isProductOffer = /^\/produkt\//.test(url.pathname) && /^\d+$/.test(url.searchParams.get('offerId') ?? '');
    if (!isOfferPath && !isProductOffer) return undefined;
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'reco_id'].forEach((key) => url.searchParams.delete(key));
    return url.toString();
  } catch {
    return undefined;
  }
}

export function normalizeImageUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, ALLEGRO_ORIGIN);
    if (url.protocol !== 'https:') return undefined;
    if (!(url.hostname === 'allegro.pl' || url.hostname.endsWith('.allegro.pl') || url.hostname.endsWith('.allegroimg.com') || url.hostname.endsWith('.allegrostatic.com'))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function offerIdFromUrl(url: string): string {
  const parsed = new URL(url);
  const queryId = parsed.searchParams.get('offerId');
  if (queryId && /^\d+$/.test(queryId)) return queryId;
  const match = parsed.pathname.match(/-(\d{6,})(?:$|\/)/);
  return match?.[1] ?? url;
}

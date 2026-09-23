import { PARSER_VERSION } from '../constants/allegro';
import type { CartSeller } from '../types/cart';
import type { OfferSearchResult, ParsedOffersPage } from '../types/offers';
import { parsePolishPrice } from '../utils/currency';
import { normalizeImageUrl, normalizeOfferUrl, offerIdFromUrl } from '../utils/normalize-url';
import { deduplicateOffers } from '../utils/result-deduplication';

export const OFFERS_PARSER_VERSION = PARSER_VERSION;

function firstSearchPage(searchUrl: string): string {
  const url = new URL(searchUrl);
  url.searchParams.delete('p');
  return url.toString();
}

function productToOffer(product: Record<string, unknown>, seller: CartSeller, searchUrl: string, order: number): OfferSearchResult | undefined {
  const rawUrl = typeof product.url === 'string' ? product.url : undefined;
  const offerUrl = normalizeOfferUrl(rawUrl);
  const title = typeof product.name === 'string' ? product.name.trim() : '';
  const offers = product.offers as Record<string, unknown> | undefined;
  const priceValue = offers?.price;
  const currency = typeof offers?.priceCurrency === 'string' ? offers.priceCurrency : 'PLN';
  const numericPrice = typeof priceValue === 'number' ? priceValue : typeof priceValue === 'string' ? Number(priceValue) : NaN;
  const price = Number.isFinite(numericPrice) ? {
    amount: numericPrice,
    currency,
    formatted: new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(numericPrice)
  } : undefined;
  if (!offerUrl || !title || !price) return undefined;
  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  return {
    id: typeof product.sku === 'string' ? product.sku : offerIdFromUrl(offerUrl),
    title, offerUrl, imageUrl: normalizeImageUrl(typeof image === 'string' ? image : undefined),
    sellerId: seller.id, sellerLogin: seller.login, sellerShopUrl: seller.shopUrl,
    sellerSearchUrl: firstSearchPage(searchUrl), price, sourceOrder: order,
    condition: typeof product.itemCondition === 'string' ? product.itemCondition.split('/').pop() : undefined
  };
}

function jsonLdOffers(document: Document, seller: CartSeller, searchUrl: string): OfferSearchResult[] {
  const found: OfferSearchResult[] = [];
  for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent || 'null') as unknown;
      const walk = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) return value.forEach(walk);
        const record = value as Record<string, unknown>;
        if (record['@type'] === 'Product') {
          const offer = productToOffer(record, seller, searchUrl, found.length);
          if (offer) found.push(offer);
        }
        if (Array.isArray(record.itemListElement)) record.itemListElement.forEach((item) => {
          if (item && typeof item === 'object') walk((item as Record<string, unknown>).item ?? item);
        });
        if (Array.isArray(record['@graph'])) record['@graph'].forEach(walk);
      };
      walk(data);
    } catch {
      // Invalid JSON-LD is ignored; the DOM fallback remains available.
    }
  }
  return found;
}

function embeddedJsonOffers(document: Document, seller: CartSeller, searchUrl: string): OfferSearchResult[] {
  const found: OfferSearchResult[] = [];
  let visited = 0;
  const walk = (value: unknown): void => {
    if (++visited > 150_000 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(walk);
    const record = value as Record<string, unknown>;
    const rawUrl = [record.url, record.offerUrl, record.link].find((candidate): candidate is string => typeof candidate === 'string' && (candidate.includes('/oferta/') || (candidate.includes('/produkt/') && candidate.includes('offerId='))));
    const title = [record.name, record.title].find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 2);
    const sellingMode = record.sellingMode as Record<string, unknown> | undefined;
    const rawPrice = (sellingMode?.price ?? record.price) as Record<string, unknown> | string | number | undefined;
    const amountValue = rawPrice && typeof rawPrice === 'object' ? rawPrice.amount : rawPrice;
    const amount = typeof amountValue === 'number' ? amountValue : typeof amountValue === 'string' ? Number(amountValue.replace(',', '.')) : NaN;
    if (rawUrl && title && Number.isFinite(amount)) {
      const offerUrl = normalizeOfferUrl(rawUrl);
      if (offerUrl) {
        const currency = rawPrice && typeof rawPrice === 'object' && typeof rawPrice.currency === 'string' ? rawPrice.currency : 'PLN';
        const images = record.images;
        const firstImage = Array.isArray(images) && images[0] && typeof images[0] === 'object' ? (images[0] as Record<string, unknown>).url : record.imageUrl;
        found.push({
          id: typeof record.id === 'string' ? record.id : offerIdFromUrl(offerUrl), title: title.trim(), offerUrl,
          imageUrl: normalizeImageUrl(typeof firstImage === 'string' ? firstImage : undefined),
          sellerId: seller.id, sellerLogin: seller.login, sellerShopUrl: seller.shopUrl, sellerSearchUrl: firstSearchPage(searchUrl),
          price: { amount, currency, formatted: new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(amount) },
          isSponsored: typeof record.sponsored === 'boolean' ? record.sponsored : undefined,
          freeDelivery: typeof (record.delivery as Record<string, unknown> | undefined)?.availableForFree === 'boolean' ? Boolean((record.delivery as Record<string, unknown>).availableForFree) : undefined,
          sourceOrder: found.length
        });
      }
    }
    Object.values(record).forEach(walk);
  };
  for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/json"], script[id*="data" i]')) {
    const source = script.textContent?.trim();
    if (!source || source.length > 8_000_000 || !/^[\[{]/.test(source)) continue;
    try { walk(JSON.parse(source)); } catch { /* DOM parsing remains available. */ }
  }
  return deduplicateOffers(found);
}

function findPriceNode(card: HTMLElement): HTMLElement | undefined {
  const stable = card.querySelector<HTMLElement>('[data-testid*="price" i], [aria-label*="cena" i], .price');
  if (stable && parsePolishPrice(stable.textContent)) return stable;
  return Array.from(card.querySelectorAll<HTMLElement>('span, div, p')).filter((element) => {
    const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length <= 32 && /^\d[\d\s.]*([,.]\d{2})?\s*(zł|PLN)$/i.test(text) && !!parsePolishPrice(text);
  }).sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0];
}

function domOffers(document: Document, seller: CartSeller, searchUrl: string): OfferSearchResult[] {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('article, [data-testid*="listing-item" i], [data-role="offer"]'));
  const results: OfferSearchResult[] = [];
  for (const card of cards) {
    const link = card.querySelector<HTMLAnchorElement>('a[href*="/oferta/"], a[href*="/produkt/"][href*="offerId="]');
    const offerUrl = normalizeOfferUrl(link?.href);
    if (!offerUrl) continue;
    const heading = card.querySelector<HTMLElement>('h2, h3, [data-testid*="title" i]');
    const title = (heading?.textContent || link?.getAttribute('title') || link?.textContent || '').trim();
    const priceNode = findPriceNode(card);
    const price = parsePolishPrice(priceNode?.textContent);
    if (!title || !price) continue;
    const fullText = card.textContent?.replace(/\s+/g, ' ') ?? '';
    const oldPriceNode = card.querySelector<HTMLElement>('del, s, [data-testid*="old-price" i]');
    const conditionMatch = fullText.match(/\b(nowy|używany|odnowiony|powystawowy)\b/i);
    results.push({
      id: card.dataset.offerId || offerIdFromUrl(offerUrl), title, offerUrl,
      imageUrl: normalizeImageUrl(card.querySelector<HTMLImageElement>('img')?.currentSrc || card.querySelector<HTMLImageElement>('img')?.src),
      sellerId: seller.id, sellerLogin: seller.login, sellerShopUrl: seller.shopUrl, sellerSearchUrl: firstSearchPage(searchUrl),
      price, originalPrice: parsePolishPrice(oldPriceNode?.textContent),
      isSponsored: /sponsorowan/i.test(fullText) || card.dataset.sponsored === 'true',
      isSmart: /smart!?/i.test(fullText) || !!card.querySelector('[alt*="Smart" i]'),
      freeDelivery: /darmow[aey]\s+dostaw/i.test(fullText),
      condition: conditionMatch?.[1], sourceOrder: results.length
    });
  }
  return results;
}

export function parseOffersHtml(html: string, seller: CartSeller, searchUrl: string): ParsedOffersPage {
  if (!html.trim()) return { offers: [], hasMore: false, probableParserError: false, blocked: false };
  const document = new DOMParser().parseFromString(html, 'text/html');
  const readableBody = document.body?.cloneNode(true) as HTMLElement | undefined;
  readableBody?.querySelectorAll('script, style, noscript, template').forEach((element) => element.remove());
  const text = (readableBody?.textContent || '').replace(/\s+/g, ' ').toLocaleLowerCase('pl');
  const blocked = /captcha|robotem|nietypowy ruch|access denied|odmowa dostępu|please enable js and disable any ad blocker/.test(text);
  if (blocked) return { offers: [], hasMore: false, probableParserError: false, blocked: true };
  const structured = jsonLdOffers(document, seller, searchUrl);
  const embedded = structured.length ? [] : embeddedJsonOffers(document, seller, searchUrl);
  const offers = deduplicateOffers(structured.length ? structured : embedded.length ? embedded : domOffers(document, seller, searchUrl));
  const offerLikeElements = document.querySelectorAll('a[href*="/oferta/"], a[href*="/produkt/"][href*="offerId="], article, [data-testid*="listing-item" i]').length;
  const noResults = /brak ofert|nie znaleźliśmy ofert|0 ofert/.test(text);
  const hasNextLink = !!document.querySelector('a[rel="next"], a[aria-label*="następn" i], a[data-testid*="next" i]');
  return {
    offers,
    hasMore: offers.length > 0 && (hasNextLink || offers.length >= 30),
    probableParserError: !offers.length && offerLikeElements > 0 && !noResults,
    blocked: false
  };
}

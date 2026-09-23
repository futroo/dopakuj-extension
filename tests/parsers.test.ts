import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCartDocument } from '../adapters/allegro-cart.adapter';
import { parseOffersHtml } from '../adapters/allegro-offers.adapter';
import { parsePolishPrice } from '../utils/currency';
import { buildSellerSearchUrl, extractSellerLogin, normalizeOfferUrl, offerIdFromUrl } from '../utils/normalize-url';
import type { CartSeller } from '../types/cart';

const fixture = (name: string) => readFileSync(resolve(process.cwd(), 'tests', 'fixtures', name), 'utf8');
const seller: CartSeller = { id: 'test', login: 'Sklep Test', shopUrl: 'https://allegro.pl/uzytkownik/Sklep%20Test', hasSelectedItems: true, selectedItemsCount: 1, allItemsCount: 1 };

describe('adresy Allegro', () => {
  it('odczytuje login z bezpiecznego URL', () => {
    expect(extractSellerLogin('https://allegro.pl/uzytkownik/Sklep_Testowy?x=1')).toBe('Sklep_Testowy');
    expect(extractSellerLogin('https://evil.example/uzytkownik/test')).toBeUndefined();
  });
  it('buduje URL przez URLSearchParams', () => {
    const url = new URL(buildSellerSearchUrl('Sklep Test', 'kabel & ładowarka', 2));
    expect(url.pathname).toBe('/uzytkownik/Sklep%20Test');
    expect(url.searchParams.get('string')).toBe('kabel & ładowarka');
    expect(url.searchParams.get('p')).toBe('2');
  });
  it('akceptuje aktualny adres /produkt z offerId jako ofertę', () => {
    const url = 'https://allegro.pl/produkt/kfd-creatine-caps-800-225-kapsulek-monohydrat-kreatyny-w-kapsulkach-999b9fa1-abce-436e-8e3a-5405bc21b600?offerId=18659006772';
    expect(normalizeOfferUrl(url)).toBe(url);
    expect(offerIdFromUrl(url)).toBe('18659006772');
  });
});

describe('parser koszyka', () => {
  it('rozpoznaje sprzedawców oraz zaznaczone i odznaczone produkty', () => {
    const document = new DOMParser().parseFromString(fixture('cart.html'), 'text/html');
    const state = parseCartDocument(document, 'https://allegro.pl/koszyk');
    expect(state.status).toBe('ready');
    expect(state.sellers).toHaveLength(2);
    expect(state.sellers[0]).toMatchObject({ id: 'seller-123', selectedItemsCount: 1, allItemsCount: 2, hasSelectedItems: true });
    expect(state.sellers[1]).toMatchObject({ selectedItemsCount: 0, allItemsCount: 1, hasSelectedItems: false });
  });
  it('nie parsuje koszyka poza właściwą trasą', () => {
    const document = new DOMParser().parseFromString(fixture('cart.html'), 'text/html');
    expect(parseCartDocument(document, 'https://allegro.pl/listing').status).toBe('unavailable');
  });
  it('nie uznaje samego tekstu logowania w nagłówku za brak dostępu do koszyka', () => {
    const document = new DOMParser().parseFromString('<body><header>Zaloguj się</header><main><h1>Koszyk</h1></main></body>', 'text/html');
    const state = parseCartDocument(document, 'https://allegro.pl/koszyk');
    expect(state.status).toBe('error');
    expect(state.error).not.toMatch(/zaloguj/i);
  });
  it('rozpoznaje pusty anonimowy koszyk mimo linku logowania w nagłówku', () => {
    const document = new DOMParser().parseFromString('<body><header>Zaloguj się</header><main><h1>Twój koszyk jest pusty</h1></main></body>', 'text/html');
    expect(parseCartDocument(document, 'https://allegro.pl/koszyk').status).toBe('empty');
  });
});

describe('parser ofert', () => {
  it('preferuje JSON-LD i normalizuje oferty', () => {
    const result = parseOffersHtml(fixture('offers.html'), seller, buildSellerSearchUrl(seller.login, 'usb'));
    expect(result.offers).toHaveLength(2);
    expect(result.offers[0]).toMatchObject({ id: '12345678901', title: 'Kabel USB-C 2 m', price: { amount: 29.99, currency: 'PLN' } });
    expect(result.hasMore).toBe(true);
  });
  it('obsługuje pusty HTML i stronę CAPTCHA', () => {
    expect(parseOffersHtml('', seller, seller.shopUrl)).toMatchObject({ offers: [], blocked: false });
    expect(parseOffersHtml(fixture('captcha.html'), seller, seller.shopUrl).blocked).toBe(true);
  });
  it('odczytuje cenę z semantycznej karty bez klas generowanych przez Allegro', () => {
    const html = '<article><h2>Kabel do telefonu</h2><a href="https://allegro.pl/produkt/kabel-do-telefonu-abcd?offerId=12345678999">Kabel do telefonu</a><div><span>19,99 zł</span></div></article>';
    const result = parseOffersHtml(html, seller, buildSellerSearchUrl(seller.login, 'kabel'));
    expect(result.offers[0]).toMatchObject({ id: '12345678999', title: 'Kabel do telefonu', price: { amount: 19.99 } });
  });
  it('nie uznaje samego skryptu DataDome za widoczną CAPTCHA', () => {
    const html = '<body><script>const endpoint = "geo.captcha-delivery.com";</script><article><h2>Produkt</h2><a href="https://allegro.pl/produkt/produkt-x?offerId=12345678998">Produkt</a><span>12,00 zł</span></article></body>';
    expect(parseOffersHtml(html, seller, seller.shopUrl).blocked).toBe(false);
  });
});

describe('polska cena', () => {
  it.each([['1 234,56 zł', 1234.56], ['29,99 PLN', 29.99], ['1.299 zł', 1299]])('parsuje %s', (input, amount) => {
    expect(parsePolishPrice(input)?.amount).toBe(amount);
  });
});

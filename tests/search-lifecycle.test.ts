import { beforeEach, expect, it, vi } from 'vitest';
import { useOfferSearch } from '../composables/useOfferSearch';
import { fetchSellerPage } from '../services/seller-page-client';
import type { CartSeller } from '../types/cart';

vi.mock('../services/seller-page-client', () => ({ fetchSellerPage: vi.fn() }));
const fetchPage = vi.mocked(fetchSellerPage);
const seller = (id: string): CartSeller => ({ id, login: id, shopUrl: 'https://allegro.pl/uzytkownik/' + id, hasSelectedItems: true, selectedItemsCount: 1, allItemsCount: 1 });
const html = (id: string, more = false) => '<article><a href="https://allegro.pl/oferta/test-' + id + '"><h2>Produkt</h2></a><span class="price">29,99 zł</span></article>' + (more ? '<a rel="next" href="?p=2">Dalej</a>' : '');
const deferred = () => {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => { fetchPage.mockReset(); useOfferSearch().clear(); });

it('wyczyszczenie odrzuca spóźnioną odpowiedź i nie uruchamia kolejnego sprzedawcy', async () => {
  const pending = deferred();
  fetchPage.mockReturnValueOnce(pending.promise);
  const search = useOfferSearch();
  const running = search.search('kawa', [seller('A'), seller('B')]);
  search.clear();
  pending.resolve(html('123456'));
  await running;
  expect(search.store.phase).toBe('idle');
  expect(search.store.offers).toEqual([]);
  expect(search.store.query).toBe('');
  expect(fetchPage).toHaveBeenCalledTimes(1);
});

it('odpowiedź starego wyszukiwania nie zastępuje nowszego', async () => {
  const pending = deferred();
  fetchPage.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(html('234567'));
  const search = useOfferSearch();
  const old = search.search('stare', [seller('A')]);
  await search.search('nowe', [seller('B')]);
  pending.resolve(html('123456'));
  await old;
  expect(search.store.query).toBe('nowe');
  expect(search.store.offers.map((offer) => offer.id)).toEqual(['234567']);
  expect(search.store.phase).toBe('results');
});

it('zatrzymanie zachowuje pobrane oferty, a dalsze pobieranie kontynuuje strony', async () => {
  const pending = deferred();
  fetchPage.mockResolvedValueOnce(html('123456', true)).mockReturnValueOnce(pending.promise);
  const search = useOfferSearch();
  await search.search('kawa', [seller('A')]);
  const loading = search.loadMore();
  search.cancel();
  pending.resolve(html('234567'));
  await loading;
  expect(search.store.offers).toHaveLength(1);
  expect(search.store.phase).toBe('cancelled');
  expect(search.store.sellers.A?.nextRemotePage).toBe(2);
});

it('błąd kolejnej strony jest ponawiany na tej samej stronie', async () => {
  fetchPage.mockResolvedValueOnce(html('123456', true)).mockRejectedValueOnce(new Error('Błąd sieci')).mockResolvedValueOnce(html('234567'));
  const search = useOfferSearch();
  await search.search('kawa', [seller('A')]);
  await search.loadMore();
  expect(search.sellerErrors.value).toHaveLength(1);
  await search.retrySeller('A');
  expect(new URL(fetchPage.mock.calls[2]![0]).searchParams.get('p')).toBe('2');
  expect(search.store.offers).toHaveLength(2);
  expect(search.sellerErrors.value).toHaveLength(0);
});

it('blokuje wielokrotne kliknięcie pobierania', async () => {
  const pending = deferred();
  fetchPage.mockResolvedValueOnce(html('123456', true)).mockReturnValueOnce(pending.promise);
  const search = useOfferSearch();
  await search.search('kawa', [seller('A')]);
  const loading = search.loadMore();
  await search.loadMore();
  expect(fetchPage).toHaveBeenCalledTimes(2);
  pending.resolve(html('234567'));
  await loading;
});

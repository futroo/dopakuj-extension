import { describe, expect, it } from 'vitest';
import { deduplicateOffers } from '../utils/result-deduplication';
import { filterAndSortOffers, defaultFilters, useSearchFilters } from '../composables/useSearchFilters';
import { ref } from 'vue';
import { paginate } from '../composables/usePagination';
import type { OfferSearchResult } from '../types/offers';

const offer = (id: string, amount: number, title: string, seller = 'A'): OfferSearchResult => ({
  id, title, offerUrl: `https://allegro.pl/oferta/test-${id.padStart(6, '0')}`, sellerId: seller,
  sellerLogin: seller, sellerShopUrl: `https://allegro.pl/uzytkownik/${seller}`, sellerSearchUrl: `https://allegro.pl/uzytkownik/${seller}?string=x`,
  price: { amount, currency: 'PLN', formatted: `${amount} zł` }, sourceOrder: Number(id)
});

it('deduplikuje oferty po ID', () => {
  expect(deduplicateOffers([offer('1', 10, 'A'), offer('1', 12, 'Duplikat'), offer('2', 20, 'B')]).map((item) => item.id)).toEqual(['1', '2']);
});

describe('filtrowanie i stabilne sortowanie', () => {
  it('odróżnia wszystkich sprzedawców od pustego wyboru', () => {
    const source = [offer('1', 10, 'A'), offer('2', 20, 'B', 'B')];
    expect(filterAndSortOffers(source, defaultFilters(), 'relevance')).toHaveLength(2);
    expect(filterAndSortOffers(source, { ...defaultFilters(), sellerIds: [] }, 'relevance')).toHaveLength(0);
  });
  it('reset usuwa także obie granice ceny i pusty wybór sprzedawców', () => {
    const state = useSearchFilters(ref([offer('1', 10, 'A')]));
    state.filters.minPrice = 20;
    state.filters.maxPrice = 50;
    state.filters.sellerIds = [];
    expect(state.filtered.value).toHaveLength(0);
    state.reset();
    expect(state.filters.minPrice).toBeUndefined();
    expect(state.filters.maxPrice).toBeUndefined();
    expect(state.activeCount.value).toBe(0);
    expect(state.filtered.value).toHaveLength(1);
  });
  it('filtruje bez mutowania kolekcji źródłowej', () => {
    const source = [offer('1', 10, 'Tani'), offer('2', 30, 'Drogi')];
    const filters = { ...defaultFilters(), minPrice: 20 };
    expect(filterAndSortOffers(source, filters, 'relevance').map((item) => item.id)).toEqual(['2']);
    expect(source).toHaveLength(2);
  });
  it('zachowuje kolejność dla identycznych wartości', () => {
    const source = [offer('1', 10, 'To samo'), offer('2', 10, 'To samo'), offer('3', 10, 'To samo')];
    expect(filterAndSortOffers(source, defaultFilters(), 'price-asc').map((item) => item.id)).toEqual(['1', '2', '3']);
  });
});

it('dzieli wyniki na lokalne strony', () => {
  expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
  expect(paginate([1, 2], 3, 2)).toEqual([]);
});

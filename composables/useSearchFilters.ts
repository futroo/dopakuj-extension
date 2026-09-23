import { computed, reactive, ref, type Ref } from 'vue';
import type { OfferSearchResult, SearchFilters, SearchSort } from '../types/offers';

export function defaultFilters(): SearchFilters {
  return { sellerIds: null, minPrice: undefined, maxPrice: undefined, smartOnly: false, freeDeliveryOnly: false, showSponsored: true, conditions: [], perPage: 24 };
}

export function filterAndSortOffers(offers: OfferSearchResult[], filters: SearchFilters, sort: SearchSort): OfferSearchResult[] {
  const filtered = offers.filter((offer) => {
    if (filters.sellerIds !== null && !filters.sellerIds.includes(offer.sellerId)) return false;
    if (filters.minPrice !== undefined && offer.price.amount < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && offer.price.amount > filters.maxPrice) return false;
    if (filters.smartOnly && offer.isSmart !== true) return false;
    if (filters.freeDeliveryOnly && offer.freeDelivery !== true) return false;
    if (!filters.showSponsored && offer.isSponsored === true) return false;
    if (filters.conditions.length && (!offer.condition || !filters.conditions.includes(offer.condition))) return false;
    return true;
  });
  const indexed = filtered.map((offer, index) => ({ offer, index }));
  const compareText = (a: string, b: string) => a.localeCompare(b, 'pl', { sensitivity: 'base' });
  indexed.sort((a, b) => {
    let result = 0;
    if (sort === 'price-asc') result = a.offer.price.amount - b.offer.price.amount;
    if (sort === 'price-desc') result = b.offer.price.amount - a.offer.price.amount;
    if (sort === 'title-asc') result = compareText(a.offer.title, b.offer.title);
    if (sort === 'title-desc') result = compareText(b.offer.title, a.offer.title);
    if (sort === 'seller-asc') result = compareText(a.offer.sellerLogin, b.offer.sellerLogin);
    if (sort === 'seller-desc') result = compareText(b.offer.sellerLogin, a.offer.sellerLogin);
    return result || a.index - b.index;
  });
  return indexed.map(({ offer }) => offer);
}

export function useSearchFilters(offers: Ref<OfferSearchResult[]>) {
  const filters = reactive<SearchFilters>(defaultFilters());
  const sort = ref<SearchSort>('relevance');
  const filtered = computed(() => filterAndSortOffers(offers.value, filters, sort.value));
  const activeCount = computed(() => Number(filters.sellerIds !== null) + Number(filters.minPrice !== undefined) + Number(filters.maxPrice !== undefined) + Number(filters.smartOnly) + Number(filters.freeDeliveryOnly) + Number(!filters.showSponsored) + Number(filters.conditions.length > 0));
  const conditions = computed(() => [...new Set(offers.value.map((offer) => offer.condition).filter((value): value is string => !!value))].sort());
  const reset = (): void => { Object.assign(filters, defaultFilters()); };
  return { filters, sort, filtered, activeCount, conditions, reset };
}

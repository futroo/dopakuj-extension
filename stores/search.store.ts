import { reactive } from 'vue';
import type { OfferSearchResult, SellerSearchState } from '../types/offers';

export type SearchPhase = 'idle' | 'loading' | 'results' | 'empty' | 'cancelled' | 'error';

export const searchStore = reactive({
  query: '',
  phase: 'idle' as SearchPhase,
  offers: [] as OfferSearchResult[],
  sellers: {} as Record<string, SellerSearchState>,
  message: '',
  startedAt: 0
});

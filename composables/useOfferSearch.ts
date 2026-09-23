import { computed, ref } from 'vue';
import { parseOffersHtml } from '../adapters/allegro-offers.adapter';
import { SELLER_PAGE_DELAY_MS } from '../constants/allegro';
import { fetchSellerPage } from '../services/seller-page-client';
import { searchStore } from '../stores/search.store';
import type { CartSeller } from '../types/cart';
import { buildSellerSearchUrl } from '../utils/normalize-url';
import { delay } from '../utils/concurrency';
import { deduplicateOffers } from '../utils/result-deduplication';

export function useOfferSearch() {
  let controller: AbortController | undefined;
  const searchedSellers = ref<CartSeller[]>([]);
  const busy = ref(false);
  const currentSeller = ref('');
  const challenge = ref(false);
  const checkedCount = ref(0);
  const progressTotal = ref(0);

  const fetchPage = async (seller: CartSeller, page: number, signal: AbortSignal): Promise<void> => {
    signal.throwIfAborted();
    const state = searchStore.sellers[seller.id];
    if (!state) return;
    state.loading = true;
    state.error = undefined;
    currentSeller.value = seller.login;
    challenge.value = false;
    const url = buildSellerSearchUrl(seller.login, searchStore.query, page);
    try {
      const html = await fetchSellerPage(url, signal, 'interactive-tab', (blocked) => {
        if (!signal.aborted) challenge.value = blocked;
      });
      // Late responses from a cleared or superseded search must not update the panel.
      signal.throwIfAborted();
      const parsed = parseOffersHtml(html, seller, url);
      if (parsed.blocked) throw new Error('Dokończ weryfikację CAPTCHA w karcie Allegro i ponów wyszukiwanie.');
      if (parsed.probableParserError) throw new Error('Nie udało się rozpoznać ofert na stronie sprzedawcy.');
      const offset = searchStore.offers.length;
      parsed.offers.forEach((offer, index) => { offer.sourceOrder = offset + index; });
      searchStore.offers = deduplicateOffers([...searchStore.offers, ...parsed.offers]);
      state.hasMore = parsed.hasMore;
      state.nextRemotePage = page + 1;
    } catch (error) {
      if (signal.aborted) throw error;
      state.error = error instanceof Error ? error.message : String(error);
      state.hasMore = false;
    } finally {
      if (!signal.aborted) {
        state.loading = false;
        state.checked = true;
        checkedCount.value++;
      }
    }
  };

  const finish = (): void => {
    const states = Object.values(searchStore.sellers);
    const errors = states.filter((state) => state.error);
    searchStore.phase = searchStore.offers.length ? 'results' : errors.length ? 'error' : 'empty';
    searchStore.message = errors.length
      ? 'Nie udało się sprawdzić ' + errors.length + ' z ' + states.length + ' sprzedawców. Ponów pobieranie poniżej.' : '';
  };

  const run = async (work: (signal: AbortSignal) => Promise<void>, total = 1): Promise<void> => {
    const operation = new AbortController();
    controller = operation;
    busy.value = true;
    checkedCount.value = 0;
    progressTotal.value = total;
    searchStore.phase = 'loading';
    searchStore.message = '';
    try {
      await work(operation.signal);
      if (!operation.signal.aborted) finish();
    } catch (error) {
      if (!operation.signal.aborted) {
        searchStore.phase = 'error';
        searchStore.message = error instanceof Error ? error.message : String(error);
      }
    } finally {
      if (controller === operation) {
        busy.value = false;
        currentSeller.value = '';
        challenge.value = false;
      }
    }
  };

  const search = async (query: string, sellers: CartSeller[]): Promise<void> => {
    controller?.abort();
    searchedSellers.value = sellers.map((seller) => ({ ...seller }));
    searchStore.query = query.trim();
    searchStore.offers = [];
    searchStore.startedAt = Date.now();
    searchStore.sellers = Object.fromEntries(sellers.map((seller) => [seller.id, {
      sellerId: seller.id, nextRemotePage: 1, hasMore: true, loading: false, checked: false
    }]));
    await run(async (signal) => {
      for (const seller of sellers) await fetchPage(seller, 1, signal);
    }, sellers.length);
  };

  const loadMore = async (): Promise<void> => {
    if (busy.value) return;
    const sellers = searchedSellers.value.filter((seller) => searchStore.sellers[seller.id]?.hasMore);
    if (!sellers.length) return;
    await run(async (signal) => {
      for (const [index, seller] of sellers.entries()) {
        if (index) await delay(SELLER_PAGE_DELAY_MS, signal);
        await fetchPage(seller, searchStore.sellers[seller.id]!.nextRemotePage, signal);
      }
    }, sellers.length);
  };

  const retrySeller = async (sellerId: string): Promise<void> => {
    if (busy.value) return;
    const seller = searchedSellers.value.find((item) => item.id === sellerId);
    const state = searchStore.sellers[sellerId];
    if (!seller || !state) return;
    await run((signal) => fetchPage(seller, state.nextRemotePage, signal));
  };

  const cancel = (): void => {
    controller?.abort();
    controller = undefined;
    busy.value = false;
    currentSeller.value = '';
    challenge.value = false;
    for (const state of Object.values(searchStore.sellers)) state.loading = false;
    searchStore.phase = 'cancelled';
    searchStore.message = '';
  };

  const clear = (): void => {
    cancel();
    searchedSellers.value = [];
    Object.assign(searchStore, { query: '', phase: 'idle', offers: [], sellers: {}, message: '', startedAt: 0 });
  };

  return {
    store: searchStore, search, loadMore, retrySeller, cancel, clear, busy, searchedSellers, currentSeller, challenge,
    checkedCount, progressTotal,
    hasRemoteMore: computed(() => Object.values(searchStore.sellers).some((state) => state.hasMore)),
    sellerErrors: computed(() => Object.values(searchStore.sellers).filter((state) => state.error))
  };
}


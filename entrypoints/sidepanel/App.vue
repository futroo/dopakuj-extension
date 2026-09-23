<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ChevronDown, Info, LoaderCircle, X, ShoppingBag } from '@lucide/vue';
import CartStatus from '../../components/CartStatus.vue';
import SearchBar from '../../components/SearchBar.vue';
import SellerModeSelector from '../../components/SellerModeSelector.vue';
import SellerSelector from '../../components/SellerSelector.vue';
import FiltersPanel from '../../components/FiltersPanel.vue';
import SortSelector from '../../components/SortSelector.vue';
import ResultsList from '../../components/ResultsList.vue';
import Pagination from '../../components/Pagination.vue';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import { useCartSellers } from '../../composables/useCartSellers';
import { useOfferSearch } from '../../composables/useOfferSearch';
import { usePendingSearch } from '../../composables/usePendingSearch';
import { useSearchFilters } from '../../composables/useSearchFilters';
import { usePagination } from '../../composables/usePagination';
import { useSettingsStore } from '../../stores/settings.store';
import { navigateToCart } from '../../services/cart-navigation';
import { sendMessage } from '../../services/message-bus';
import { CART_WAIT_TIMEOUT_MS } from '../../constants/allegro';
import { delay } from '../../utils/concurrency';
import { plural } from '../../utils/plural';
import type { CartSeller, CartState } from '../../types/cart';
import type { PendingSearch } from '../../types/offers';

const query = ref('');
const excludedSellerIds = ref<string[]>([]);
const validationMessage = ref('');
const waitingForCart = ref(false);
const clearing = ref(false);
const scopeOpen = ref(false);
const searchBar = ref<InstanceType<typeof SearchBar>>();
const settings = useSettingsStore();
const { cartState, context, refresh, refreshContext, targetTab, selectedCount, allCount } = useCartSellers();
const offerSearch = useOfferSearch();
const offersRef = computed(() => offerSearch.store.offers);
const { filters, sort, filtered, activeCount, conditions, reset } = useSearchFilters(offersRef);
const ordered = computed(() => {
  if (!settings.groupedResults) return filtered.value;
  const groups = new Map<string, typeof filtered.value>();
  for (const offer of filtered.value) {
    if (!groups.has(offer.sellerId)) groups.set(offer.sellerId, []);
    groups.get(offer.sellerId)!.push(offer);
  }
  return [...groups.values()].flat();
});
const pagination = usePagination(ordered, computed(() => filters.perPage));
const eligibleSellers = computed(() => cartState.value.sellers.filter((seller) => settings.sellerMode === 'all' || seller.hasSelectedItems));
const activeSellers = computed(() => eligibleSellers.value.filter((seller) => !excludedSellerIds.value.includes(seller.id)));
const isSearching = computed(() => offerSearch.busy.value || waitingForCart.value);
const foundSellerCount = computed(() => new Set(offersRef.value.map((offer) => offer.sellerId)).size);
const filteredSellerCount = computed(() => new Set(filtered.value.map((offer) => offer.sellerId)).size);
const hasSearch = computed(() => offerSearch.store.phase !== 'idle');
const incomplete = computed(() => isSearching.value || offerSearch.hasRemoteMore.value || offerSearch.sellerErrors.value.length > 0 || offerSearch.store.phase === 'cancelled');
const canClear = computed(() => !!query.value || hasSearch.value || isSearching.value || activeCount.value > 0 || excludedSellerIds.value.length > 0 || sort.value !== 'relevance' || settings.sellerMode !== 'selected');
const signature = (sellers: CartSeller[]) => sellers.map((seller) => seller.id).sort().join('|');
const scopeChanged = computed(() => !!offerSearch.store.startedAt && signature(activeSellers.value) !== signature(offerSearch.searchedSellers.value));
const queryChanged = computed(() => !!offerSearch.store.startedAt && query.value.trim() !== offerSearch.store.query);
const resultSellers = computed(() => offerSearch.searchedSellers.value.filter((seller) => offersRef.value.some((offer) => offer.sellerId === seller.id)));
const isDev = import.meta.env.DEV;
let preparation: AbortController | undefined;
let interactionVersion = 0;

const filterChips = computed(() => {
  const chips: { label: string; remove: () => void }[] = [];
  if (filters.sellerIds !== null) chips.push({ label: 'Sprzedawcy: ' + filters.sellerIds.length, remove: () => { filters.sellerIds = null; } });
  if (filters.minPrice !== undefined) chips.push({ label: 'Od ' + filters.minPrice + ' zł', remove: () => { filters.minPrice = undefined; } });
  if (filters.maxPrice !== undefined) chips.push({ label: 'Do ' + filters.maxPrice + ' zł', remove: () => { filters.maxPrice = undefined; } });
  if (filters.smartOnly) chips.push({ label: 'Smart!', remove: () => { filters.smartOnly = false; } });
  if (filters.freeDeliveryOnly) chips.push({ label: 'Darmowa dostawa', remove: () => { filters.freeDeliveryOnly = false; } });
  if (!filters.showSponsored) chips.push({ label: 'Bez sponsorowanych', remove: () => { filters.showSponsored = true; } });
  for (const condition of filters.conditions) chips.push({ label: condition, remove: () => { filters.conditions = filters.conditions.filter((value) => value !== condition); } });
  return chips;
});

async function waitForCart(tabId: number, signal: AbortSignal): Promise<CartState> {
  const deadline = Date.now() + CART_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const response = await sendMessage({ type: 'GET_CART_STATE', tabId });
    signal.throwIfAborted();
    if (response.ok && 'state' in response) {
      if (response.state.status === 'ready') return response.state;
      if (response.state.status === 'empty') throw new Error('Koszyk jest pusty. Dodaj produkt i spróbuj ponownie.');
      if (response.state.status === 'error') throw new Error(response.state.error || 'Nie udało się odczytać koszyka.');
    }
    await delay(350, signal);
  }
  throw new Error('Nie udało się odczytać koszyka. Sprawdź logowanie i odśwież stronę.');
}

async function begin(pending: PendingSearch, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const sellers = cartState.value.sellers.filter((seller) =>
    (pending.sellerMode === 'all' || seller.hasSelectedItems) && !pending.excludedSellerIds.includes(seller.id));
  await usePendingSearch().clear();
  signal.throwIfAborted();
  if (!sellers.length) {
    validationMessage.value = pending.sellerMode === 'selected'
      ? 'Zaznacz produkt w koszyku albo wybierz „Wszyscy z koszyka”.'
      : 'Wybierz co najmniej jednego sprzedawcę.';
    scopeOpen.value = true;
    return;
  }
  filters.sellerIds = null;
  pagination.resetPage();
  scopeOpen.value = false;
  waitingForCart.value = false;
  await offerSearch.search(pending.query, sellers);
}

async function execute(pending: PendingSearch, resume = false): Promise<void> {
  preparation?.abort();
  const operation = new AbortController();
  preparation = operation;
  validationMessage.value = '';
  try {
    if (!context.value.isCart || cartState.value.status !== 'ready') {
      waitingForCart.value = true;
      if (!resume) await usePendingSearch().save(pending);
      operation.signal.throwIfAborted();
      const tabId = await navigateToCart();
      operation.signal.throwIfAborted();
      await targetTab(tabId);
      cartState.value = await waitForCart(tabId, operation.signal);
    }
    await begin(pending, operation.signal);
  } catch (error) {
    if (!operation.signal.aborted) {
      offerSearch.store.phase = 'error';
      offerSearch.store.message = error instanceof Error ? error.message : String(error);
      await usePendingSearch().clear();
    }
  } finally {
    if (preparation === operation) waitingForCart.value = false;
  }
}

async function submitSearch(): Promise<void> {
  if (!query.value.trim() || isSearching.value || clearing.value) return;
  interactionVersion++;
  await execute({
    query: query.value.trim(), sellerMode: settings.sellerMode, excludedSellerIds: [...excludedSellerIds.value],
    filters: { ...filters, sellerIds: filters.sellerIds === null ? null : [...filters.sellerIds], conditions: [...filters.conditions] },
    sort: sort.value, createdAt: Date.now()
  });
}

async function stopSearch(): Promise<void> {
  interactionVersion++;
  preparation?.abort();
  preparation = undefined;
  waitingForCart.value = false;
  offerSearch.cancel();
  clearing.value = true;
  try { await usePendingSearch().clear(); } finally { clearing.value = false; }
}

async function clearSearch(): Promise<void> {
  interactionVersion++;
  preparation?.abort();
  preparation = undefined;
  waitingForCart.value = false;
  offerSearch.clear();
  query.value = '';
  excludedSellerIds.value = [];
  validationMessage.value = '';
  settings.sellerMode = 'selected';
  reset();
  sort.value = 'relevance';
  pagination.resetPage();
  scopeOpen.value = false;
  clearing.value = true;
  try { await usePendingSearch().clear(); } finally {
    clearing.value = false;
    await nextTick();
    searchBar.value?.focus();
  }
}

async function openCart(): Promise<void> {
  try { await targetTab(await navigateToCart()); }
  catch (error) { validationMessage.value = error instanceof Error ? error.message : String(error); }
}

async function changePage(direction: number): Promise<void> {
  pagination.page.value += direction;
  await nextTick();
  document.getElementById('results-heading')?.scrollIntoView({ block: 'start' });
}

watch([filters, sort, () => settings.groupedResults], pagination.resetPage, { deep: true });
onMounted(async () => {
  const version = interactionVersion;
  await refreshContext();
  const pending = await usePendingSearch().load();
  if (version !== interactionVersion || !pending || hasSearch.value || query.value) return;
  query.value = pending.query;
  settings.sellerMode = pending.sellerMode;
  excludedSellerIds.value = [...pending.excludedSellerIds];
  Object.assign(filters, pending.filters);
  sort.value = pending.sort;
  await execute(pending, true);
});
onUnmounted(() => { preparation?.abort(); offerSearch.cancel(); });
</script>

<template>
  <div class="app-shell">
    <header class="app-header"><ShoppingBag :size="19" /><h1>Dobierz z koszyka</h1></header>
    <main>
      <section class="search-console" aria-label="Wyszukiwanie ofert">
        <SearchBar ref="searchBar" v-model="query" :loading="isSearching" :can-clear="canClear" :disabled="clearing" @submit="submitSearch" @cancel="stopSearch" @clear="clearSearch" />
        <CartStatus :state="cartState" :context="context" :busy="isSearching" @refresh="refresh" @open-cart="openCart" />
        <details class="search-scope" :open="scopeOpen" @toggle="scopeOpen = ($event.target as HTMLDetailsElement).open">
          <summary><span v-if="allCount">Szukaj u <strong>{{ activeSellers.length }}</strong> z {{ allCount }} sprzedawców</span><span v-else>Sprzedawcy z koszyka</span><ChevronDown :size="16" /></summary>
          <div class="scope-content">
            <SellerModeSelector v-model="settings.sellerMode" :selected-count="selectedCount" :all-count="allCount" />
            <SellerSelector v-if="eligibleSellers.length" :sellers="eligibleSellers" :excluded="excludedSellerIds" @update:excluded="excludedSellerIds = $event" />
            <p v-else class="helper-text">Lista pojawi się po odczytaniu koszyka i wybraniu produktów.</p>
          </div>
        </details>
        <p v-if="validationMessage" class="inline-warning" role="alert">{{ validationMessage }}</p>
      </section>

      <div v-if="scopeChanged || queryChanged" class="change-notice">
        <Info :size="16" /><span>{{ scopeChanged ? 'Zmieniono wybór sprzedawców.' : 'Zmieniono frazę.' }} Wyszukaj ponownie, aby odświeżyć wyniki.</span>
      </div>

      <div v-if="isSearching" class="search-progress" role="status" aria-live="polite">
        <div><LoaderCircle :size="16" class="spin" /><strong>{{ waitingForCart ? 'Odczytuję koszyk…' : 'Sprawdzono ' + offerSearch.checkedCount.value + ' z ' + offerSearch.progressTotal.value + ' sprzedawców' }}</strong></div>
        <progress v-if="!waitingForCart" :value="offerSearch.checkedCount.value" :max="offerSearch.progressTotal.value || 1" aria-label="Postęp wyszukiwania" />
        <span v-if="offerSearch.currentSeller.value">{{ offerSearch.currentSeller.value }}</span>
        <p v-if="offerSearch.challenge.value" class="inline-warning">Allegro prosi o weryfikację. Rozwiąż CAPTCHA w otwartej karcie — wyszukiwanie będzie kontynuowane.</p>
      </div>

      <section v-if="hasSearch && !waitingForCart" class="results-section" aria-labelledby="results-heading">
        <div class="results-summary" aria-live="polite">
          <p v-if="offerSearch.store.query" class="result-query">Wyniki dla „{{ offerSearch.store.query }}”</p>
          <h2 id="results-heading">{{ incomplete ? 'Znaleziono dotąd' : 'Znaleziono' }} <strong>{{ offersRef.length }} {{ plural(offersRef.length, 'ofertę', 'oferty', 'ofert') }}</strong> od <strong>{{ foundSellerCount }} {{ foundSellerCount === 1 ? 'sprzedawcy' : 'sprzedawców' }}</strong></h2>
          <p v-if="activeCount">Po filtrach: {{ filtered.length }} {{ plural(filtered.length, 'oferta', 'oferty', 'ofert') }} od {{ filteredSellerCount }} {{ filteredSellerCount === 1 ? 'sprzedawcy' : 'sprzedawców' }}</p>
          <p v-if="offerSearch.store.phase === 'cancelled'" class="inline-warning">Wyszukiwanie zatrzymane. Pobrane oferty pozostają dostępne.</p>
          <p v-else-if="!isSearching && offerSearch.hasRemoteMore.value">Dostępne są kolejne wyniki.</p>
        </div>

        <template v-if="offersRef.length">
          <div class="results-controls">
            <FiltersPanel :filters="filters" :sellers="resultSellers" :conditions="conditions" :active-count="activeCount" @reset="reset" @change="pagination.resetPage" />
            <SortSelector v-model="sort" />
          </div>
          <div v-if="filterChips.length" class="filter-chips" aria-label="Aktywne filtry">
            <button v-for="chip in filterChips" :key="chip.label" type="button" :aria-label="'Usuń filtr: ' + chip.label" @click="chip.remove()">{{ chip.label }}<X :size="12" /></button>
          </div>
          <div class="view-options"><label><input v-model="settings.groupedResults" type="checkbox" /> Grupuj po sprzedawcy</label><span title="Filtry i sortowanie obejmują pobrane oferty. Przy grupowaniu sortujemy oferty w obrębie sprzedawcy.">{{ settings.groupedResults ? 'Sortowanie w grupach' : 'W pobranych ofertach' }}</span></div>
        </template>

        <div v-if="offerSearch.store.message" class="search-message" role="status">{{ offerSearch.store.message }}</div>
        <div v-for="error in offerSearch.sellerErrors.value" :key="error.sellerId" class="seller-error">
          <div><strong>{{ offerSearch.searchedSellers.value.find(s => s.id === error.sellerId)?.login }}</strong><p>{{ error.error }}</p></div>
          <button class="text-button" type="button" :disabled="isSearching" @click="offerSearch.retrySeller(error.sellerId)">Ponów</button>
        </div>

        <ResultsList v-if="filtered.length" :offers="pagination.pageItems.value" :grouped="settings.groupedResults" />
        <div v-else-if="offersRef.length" class="filtered-empty">
          <EmptyState title="Żadna oferta nie pasuje do filtrów" message="Zmień warunki lub wyczyść filtry, aby zobaczyć pobrane oferty." />
          <button class="button button-secondary" type="button" @click="reset">Wyczyść filtry</button>
        </div>
        <EmptyState v-else-if="offerSearch.store.phase === 'empty'" title="Nie znaleziono ofert" message="Spróbuj krótszej frazy albo wybierz więcej sprzedawców." />
        <ErrorState v-else-if="offerSearch.store.phase === 'error' && !offerSearch.sellerErrors.value.length" :message="offerSearch.store.message" :retry="!!query" @retry="submitSearch" />

        <Pagination v-if="offersRef.length || (!isSearching && offerSearch.hasRemoteMore.value)" :page="pagination.page.value" :total-pages="pagination.totalPages.value" :count="filtered.length" :per-page="filters.perPage" :has-remote-more="offerSearch.hasRemoteMore.value" :loading-more="isSearching" @previous="changePage(-1)" @next="changePage(1)" @load-more="offerSearch.loadMore" />
      </section>

      <EmptyState v-else-if="!isSearching" title="Dobierz coś do swoich zakupów" message="Wpisz nazwę produktu. Poszukamy go u sprzedawców z Twojego koszyka." />
      <details v-if="isDev && cartState.diagnostics" class="diagnostics"><summary>Diagnostyka</summary><pre>{{ JSON.stringify(cartState.diagnostics, null, 2) }}</pre></details>
    </main>
  </div>
</template>


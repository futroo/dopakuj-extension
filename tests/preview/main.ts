import { createApp, watch } from 'vue';
import App from '../../entrypoints/sidepanel/App.vue';
import '../../entrypoints/sidepanel/style.css';
import { installChromeMock } from './mock';
import { defaultFilters } from '../../composables/useSearchFilters';
import { searchStore } from '../../stores/search.store';

installChromeMock({ pending: { query: 'kawa', sellerMode: 'selected', excludedSellerIds: [], filters: defaultFilters(), sort: 'relevance', createdAt: Date.now() } });
watch(() => searchStore.offers, (offers) => {
  for (const offer of offers) offer.imageUrl = '/tests/preview/coffee.svg';
}, { flush: 'sync' });
createApp(App).mount('#app');


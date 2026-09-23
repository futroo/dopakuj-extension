import { reactive, watch } from 'vue';
import type { SellerMode } from '../types/cart';

interface SettingsState {
  sellerMode: SellerMode;
  groupedResults: boolean;
  filtersOpen: boolean;
  hydrated: boolean;
}

const state = reactive<SettingsState>({ sellerMode: 'selected', groupedResults: false, filtersOpen: false, hydrated: false });

export function useSettingsStore() {
  if (!state.hydrated) {
    state.hydrated = true;
    void chrome.storage.local.get('settings').then((stored) => {
      if (stored.settings && typeof stored.settings === 'object') Object.assign(state, stored.settings);
      watch(() => ({ sellerMode: state.sellerMode, groupedResults: state.groupedResults, filtersOpen: state.filtersOpen }),
        (settings) => void chrome.storage.local.set({ settings }), { deep: true });
    });
  }
  return state;
}

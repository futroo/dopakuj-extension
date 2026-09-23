import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { CartState } from '../types/cart';
import type { ActiveContext, ExtensionMessage } from '../types/messages';
import { sendMessage } from '../services/message-bus';

const initial: CartState = { status: 'unavailable', sellers: [], updatedAt: Date.now() };

export function useCartSellers() {
  const cartState = ref<CartState>(initial);
  const context = ref<ActiveContext>({ isAllegro: false, isCart: false });
  let contextVersion = 0;

  const refreshContext = async (): Promise<void> => {
    const version = ++contextVersion;
    const response = await sendMessage({ type: 'GET_ACTIVE_CONTEXT' });
    if (version !== contextVersion) return;
    if (!response.ok || !('context' in response)) return;
    context.value = response.context;
    // Temporary seller tabs must not erase the cart used by the current search.
    if (!response.context.isCart && cartState.value.status === 'ready') return;
    const stateResponse = await sendMessage({ type: 'GET_CART_STATE', tabId: response.context.tabId });
    if (version !== contextVersion) return;
    if (stateResponse.ok && 'state' in stateResponse) cartState.value = stateResponse.state;
  };

  const targetTab = async (tabId: number): Promise<void> => {
    contextVersion++;
    context.value = { tabId, url: undefined, isAllegro: true, isCart: true };
    cartState.value = { status: 'loading', sellers: [], sourceTabId: tabId, updatedAt: Date.now() };
  };

  const refresh = async (): Promise<void> => {
    cartState.value = { ...cartState.value, status: 'loading', error: undefined };
    const response = await sendMessage({ type: 'REFRESH_CART_STATE', tabId: cartState.value.sourceTabId ?? context.value.tabId });
    if (!response.ok) cartState.value = { ...cartState.value, status: 'error', error: response.error };
  };

  const runtimeListener = (message: ExtensionMessage, sender: chrome.runtime.MessageSender): void => {
    if (message.type !== 'CART_STATE_UPDATED' && message.type !== 'CART_PARSE_ERROR') return;
    const state = message.type === 'CART_STATE_UPDATED' ? message.payload : message.payload.state;
    const sourceTabId = sender.tab?.id ?? state.sourceTabId;
    const cartTabId = cartState.value.sourceTabId ?? context.value.tabId;
    if (cartTabId !== undefined && sourceTabId !== undefined && cartTabId !== sourceTabId) return;
    cartState.value = { ...state, sourceTabId };
  };
  const tabListener = (): void => { void refreshContext(); };

  onMounted(() => {
    chrome.runtime.onMessage.addListener(runtimeListener);
    chrome.tabs.onActivated.addListener(tabListener);
    chrome.tabs.onUpdated.addListener(tabListener);
    void refreshContext();
  });
  onUnmounted(() => {
    chrome.runtime.onMessage.removeListener(runtimeListener);
    chrome.tabs.onActivated.removeListener(tabListener);
    chrome.tabs.onUpdated.removeListener(tabListener);
  });

  return {
    cartState, context, refreshContext, targetTab, refresh,
    selectedCount: computed(() => cartState.value.sellers.filter((seller) => seller.hasSelectedItems).length),
    allCount: computed(() => cartState.value.sellers.length)
  };
}

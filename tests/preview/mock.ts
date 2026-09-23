import type { ExtensionMessage, ExtensionResponse } from '../../types/messages';
import type { PendingSearch } from '../../types/offers';
import type { CartState } from '../../types/cart';

export function installChromeMock(options: { pending?: PendingSearch; latency?: number; waitingCart?: boolean } = {}) {
  const session: Record<string, unknown> = options.pending ? { pendingSearch: options.pending } : {};
  const local: Record<string, unknown> = {};
  const event = () => {
    const listeners = new Set<(...args: any[]) => void>();
    return { addListener: (fn: (...args: any[]) => void) => listeners.add(fn), removeListener: (fn: (...args: any[]) => void) => listeners.delete(fn), emit: (...args: any[]) => listeners.forEach((fn) => fn(...args)) };
  };
  const onMessage = event();
  const state: CartState = {
    status: options.waitingCart ? 'loading' : 'ready', sourceTabId: 1, updatedAt: Date.now(),
    sellers: ['Palarnia_Polnoc', 'Dobry_Smak', 'Kawa_i_Dodatki'].map((login, index) => ({
      id: String(index + 1), login, shopUrl: 'https://allegro.pl/uzytkownik/' + login,
      hasSelectedItems: true, selectedItemsCount: 1, allItemsCount: 2
    }))
  };
  const calls: ExtensionMessage[] = [];
  const sendMessage = async (message: ExtensionMessage): Promise<ExtensionResponse> => {
    calls.push(message);
    if (message.type === 'GET_ACTIVE_CONTEXT') return { ok: true, context: { isAllegro: true, isCart: !options.waitingCart, tabId: 1 } };
    if (message.type === 'GET_CART_STATE') return { ok: true, state };
    if (message.type === 'NAVIGATE_TO_CART') return { ok: true, tabId: 1 };
    if (message.type === 'FETCH_SELLER_PAGE') {
      if (options.latency) await new Promise((resolve) => setTimeout(resolve, options.latency));
      const url = new URL(message.payload.url);
      const index = state.sellers.findIndex((seller) => url.pathname.endsWith(seller.login));
      const page = Number(url.searchParams.get('p') || 1);
      const names = ['Kawa ziarnista Arabica 100% świeżo palona, 1 kg', 'Kawa do espresso — mieszanka brazylijska, 500 g', 'Zestaw kaw ziarnistych: Kolumbia, Etiopia i Brazylia 3 × 250 g', 'Kawa bezkofeinowa ziarnista, delikatnie palona 250 g'];
      const html = Array.from({ length: 10 }, (_, n) => {
        const id = String(123456700 + index * 100 + page * 10 + n);
        return '<article><a href="https://allegro.pl/oferta/kawa-' + id + '"><h2>' + names[n % names.length] + '</h2></a><span class="price">' + (29 + index * 20 + n) + ',90 zł</span>' + (n % 2 === 0 ? '<span>Smart! Darmowa dostawa</span>' : '') + '</article>';
      }).join('') + (page === 1 ? '<a rel="next" href="?p=2">Następna</a>' : '');
      return { ok: true, html, status: 200 };
    }
    return { ok: true };
  };
  const storage = (data: Record<string, unknown>) => ({
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (values: Record<string, unknown>) => { Object.assign(data, values); },
    remove: async (key: string) => { delete data[key]; }
  });
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: {
    runtime: { sendMessage, onMessage },
    tabs: { onActivated: event(), onUpdated: event() },
    storage: { session: storage(session), local: storage(local) }
  } });
  return { session, state, calls, onMessage };
}


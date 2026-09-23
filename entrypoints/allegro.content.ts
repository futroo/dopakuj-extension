import { parseCartDocument } from '../adapters/allegro-cart.adapter';
import { isCartUrl } from '../constants/allegro';
import type { CartState } from '../types/cart';
import type { ExtensionMessage } from '../types/messages';

function comparable(state: CartState): string {
  return JSON.stringify({ status: state.status, sellers: state.sellers, error: state.error, diagnostics: state.diagnostics });
}

export default defineContentScript({
  matches: ['https://allegro.pl/*', 'https://*.allegro.pl/*'],
  runAt: 'document_idle',
  main() {
    let lastState = '';
    let timer: ReturnType<typeof setTimeout> | undefined;

    const analyse = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const state = parseCartDocument(document, location.href);
        const next = comparable(state);
        if (next === lastState) return;
        lastState = next;
        void chrome.runtime.sendMessage({ type: 'CART_STATE_UPDATED', payload: state } satisfies ExtensionMessage);
        if (import.meta.env.DEV && state.diagnostics) console.debug('[Dobierz z koszyka] diagnostyka parsera', state.diagnostics);
      }, 250);
    };

    const announceLoading = (): void => {
      if (!isCartUrl(location.href)) return;
      const state: CartState = { status: 'loading', sellers: [], updatedAt: Date.now() };
      lastState = comparable(state);
      void chrome.runtime.sendMessage({ type: 'CART_STATE_UPDATED', payload: state } satisfies ExtensionMessage);
    };

    let previousUrl = location.href;
    const routeChanged = (): void => {
      if (location.href === previousUrl) return;
      previousUrl = location.href;
      lastState = '';
      announceLoading();
      analyse();
    };

    const originalPushState = history.pushState.bind(history);
    history.pushState = (data: unknown, unused: string, url?: string | URL | null): void => {
      originalPushState(data, unused, url);
      queueMicrotask(routeChanged);
    };
    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = (data: unknown, unused: string, url?: string | URL | null): void => {
      originalReplaceState(data, unused, url);
      queueMicrotask(routeChanged);
    };
    addEventListener('popstate', routeChanged);
    const observer = new MutationObserver(() => {
      routeChanged();
      if (isCartUrl(location.href)) analyse();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['checked', 'aria-checked'] });

    chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      if (message.type === 'REFRESH_CART_STATE') {
        lastState = '';
        announceLoading();
        analyse();
      }
      if (message.type === 'GET_PUBLIC_PAGE_HTML') {
        const visibleText = document.body?.innerText?.replace(/\s+/g, ' ').toLocaleLowerCase('pl') ?? '';
        const blocked = /captcha|nie jesteś robotem|nietypowy ruch|access denied|odmowa dostępu|please enable js and disable any ad blocker/.test(visibleText);
        const empty = /brak ofert|nie znaleźliśmy ofert|0 ofert/.test(visibleText);
        const ready = document.querySelectorAll('a[href*="/oferta/"], a[href*="/produkt/"][href*="offerId="]').length > 0;
        sendResponse({
          ok: true,
          html: document.documentElement.outerHTML,
          status: 200,
          pageState: blocked ? 'blocked' : ready ? 'ready' : empty ? 'empty' : 'loading'
        });
      }
    });
    announceLoading();
    analyse();
  }
});

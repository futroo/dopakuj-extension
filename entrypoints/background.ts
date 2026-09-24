import { ALLEGRO_CART_URL, isAllegroUrl, isCartUrl } from '../constants/allegro';
import type { CartState } from '../types/cart';
import type { ExtensionMessage, ExtensionResponse } from '../types/messages';

const cartStates = new Map<number, CartState>();
const sellerPageTabs = new Map<string, { tabId?: number; cancelled: boolean }>();
const BLOCK_PAGE_PATTERN = /captcha|geo\.captcha-delivery\.com|nie jesteś robotem|nietypowy ruch|please enable js and disable any ad blocker/i;

function unavailable(tabId?: number): CartState {
  return { status: 'unavailable', sellers: [], sourceTabId: tabId, updatedAt: Date.now() };
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function findCartTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ url: ['https://allegro.pl/koszyk*', 'https://*.allegro.pl/koszyk*'] });
  const active = tabs.find((tab) => tab.active);
  return active ?? tabs[0];
}

async function waitForTabComplete(tabId: number, timeoutMs: number): Promise<void> {
  const current = await chrome.tabs.get(tabId);
  if (current.status === 'complete') return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Przekroczono czas ładowania publicznej strony Allegro.'));
    }, timeoutMs);
    const listener = (updatedTabId: number, changeInfo: { status?: string }): void => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function loadPublicPageInTemporaryTab(url: string, options: { active?: boolean; timeoutMs?: number; requestId?: string } = {}): Promise<{ html: string; status: number }> {
  const interactive = options.active === true;
  const task: { tabId?: number; cancelled: boolean } = { cancelled: false };
  if (options.requestId) sellerPageTabs.set(options.requestId, task);
  const tab = await chrome.tabs.create({ url, active: interactive }).catch((error) => {
    if (options.requestId) sellerPageTabs.delete(options.requestId);
    throw error;
  });
  if (tab.id === undefined) {
    if (options.requestId) sellerPageTabs.delete(options.requestId);
    throw new Error('Nie udało się utworzyć tymczasowej karty wyszukiwania.');
  }
  task.tabId = tab.id;
  try {
    if (task.cancelled) throw new Error('Anulowano wyszukiwanie.');
    await waitForTabComplete(tab.id, 15_000);
    const deadline = Date.now() + (options.timeoutMs ?? 8_000);
    let latestHtml = '';
    let challengeDetected = false;
    let cleanSamples = 0;
    let lastReportedChallenge = false;
    while (Date.now() < deadline) {
      const currentTab = await chrome.tabs.get(tab.id).catch(() => undefined);
      if (!currentTab) throw new Error('Karta wyszukiwania została zamknięta przed odczytaniem wyników.');
      if (currentTab.url && !isAllegroUrl(currentTab.url)) challengeDetected = /captcha|challenge|verify/i.test(currentTab.url);
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PUBLIC_PAGE_HTML' } satisfies ExtensionMessage).catch(() => undefined) as ExtensionResponse | undefined;
      if (response?.ok && 'html' in response) {
        latestHtml = response.html;
        challengeDetected = response.pageState === 'blocked';
        if (options.requestId && challengeDetected !== lastReportedChallenge) {
          lastReportedChallenge = challengeDetected;
          void chrome.runtime.sendMessage({ type: 'SELLER_PAGE_STATUS', payload: { requestId: options.requestId, blocked: challengeDetected } } satisfies ExtensionMessage).catch(() => undefined);
        }
        if (challengeDetected) {
          cleanSamples = 0;
          if (!interactive) return { html: latestHtml, status: 200 };
        } else {
          cleanSamples += 1;
          if (response.pageState === 'ready' || response.pageState === 'empty' || (interactive && cleanSamples >= 2)) {
            return { html: latestHtml, status: 200 };
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    if (challengeDetected) throw new Error('Nie ukończono weryfikacji CAPTCHA w wyznaczonym czasie. Uruchom wyszukiwanie ponownie.');
    if (latestHtml && !interactive) return { html: latestHtml, status: 200 };
    throw new Error('Nie udało się odczytać publicznej strony sprzedawcy.');
  } finally {
    if (options.requestId) sellerPageTabs.delete(options.requestId);
    await chrome.tabs.remove(tab.id).catch(() => undefined);
  }
}

async function handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender): Promise<ExtensionResponse> {
  if (message.type === 'CART_STATE_UPDATED' || message.type === 'CART_PARSE_ERROR') {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) cartStates.set(tabId, { ...(message.type === 'CART_STATE_UPDATED' ? message.payload : message.payload.state), sourceTabId: tabId });
    return { ok: true };
  }

  if (message.type === 'GET_ACTIVE_CONTEXT') {
    const tab = await activeTab();
    return { ok: true, context: { tabId: tab?.id, url: tab?.url, isAllegro: isAllegroUrl(tab?.url), isCart: isCartUrl(tab?.url) } };
  }

  if (message.type === 'GET_CART_STATE') {
    const tab = message.tabId !== undefined ? await chrome.tabs.get(message.tabId).catch(() => undefined) : await activeTab();
    if (!tab?.id || !isCartUrl(tab.url)) return { ok: true, state: unavailable(tab?.id) };
    return { ok: true, state: cartStates.get(tab.id) ?? { status: 'loading', sellers: [], sourceTabId: tab.id, updatedAt: Date.now() } };
  }

  if (message.type === 'NAVIGATE_TO_CART') {
    let tab = await findCartTab();
    if (tab?.id !== undefined) {
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
      return { ok: true, tabId: tab.id };
    }
    const current = await activeTab();
    tab = current?.id !== undefined && isAllegroUrl(current.url)
      ? await chrome.tabs.update(current.id, { url: ALLEGRO_CART_URL, active: true })
      : await chrome.tabs.create({ url: ALLEGRO_CART_URL, active: true });
    return tab?.id !== undefined ? { ok: true, tabId: tab.id } : { ok: false, error: 'Nie udało się otworzyć karty koszyka.' };
  }

  if (message.type === 'REFRESH_CART_STATE') {
    const tabId = message.tabId ?? (await findCartTab())?.id;
    if (tabId === undefined) return { ok: false, error: 'Nie znaleziono otwartej karty koszyka.' };
    cartStates.set(tabId, { status: 'loading', sellers: [], sourceTabId: tabId, updatedAt: Date.now() });
    await chrome.tabs.sendMessage(tabId, { type: 'REFRESH_CART_STATE' } satisfies ExtensionMessage).catch(() => undefined);
    return { ok: true };
  }

  if (message.type === 'CANCEL_SELLER_PAGE') {
    const task = sellerPageTabs.get(message.payload.requestId);
    if (task) {
      task.cancelled = true;
      if (task.tabId !== undefined) await chrome.tabs.remove(task.tabId).catch(() => undefined);
    }
    return { ok: true };
  }

  if (message.type === 'FETCH_SELLER_PAGE') {
    let url: URL;
    try {
      url = new URL(message.payload.url);
    } catch {
      return { ok: false, error: 'Nieprawidłowy adres wyszukiwania.' };
    }
    if (url.protocol !== 'https:' || url.hostname !== 'allegro.pl' || !url.pathname.startsWith('/uzytkownik/')) {
      return { ok: false, error: 'Adres wyszukiwania nie należy do publicznej strony sprzedawcy Allegro.' };
    }
    if (message.payload.strategy === 'tab') {
      try {
        const fallback = await loadPublicPageInTemporaryTab(url.toString());
        return { ok: true, ...fallback };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się odczytać strony w tymczasowej karcie.' };
      }
    }
    if (message.payload.strategy === 'interactive-tab') {
      try {
        const page = await loadPublicPageInTemporaryTab(url.toString(), { active: true, timeoutMs: 120_000, requestId: message.payload.requestId });
        return { ok: true, ...page };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się odczytać wyników z karty Allegro.' };
      }
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, { credentials: 'omit', signal: controller.signal, redirect: 'follow' });
      const html = await response.text();
      if (response.ok && !BLOCK_PAGE_PATTERN.test(html)) return { ok: true, html, status: response.status };
      try {
        const fallback = await loadPublicPageInTemporaryTab(url.toString());
        return { ok: true, ...fallback };
      } catch {
        return { ok: true, html, status: response.status };
      }
    } catch (error) {
      return { ok: false, error: error instanceof DOMException && error.name === 'AbortError' ? 'Przekroczono czas pobierania.' : 'Nie udało się pobrać strony Allegro.' };
    } finally {
      clearTimeout(timeout);
    }
  }

  if (message.type === 'OPEN_URL') {
    const url = new URL(message.payload.url);
    if (url.protocol !== 'https:' || !(url.hostname === 'allegro.pl' || url.hostname.endsWith('.allegro.pl'))) return { ok: false, error: 'Zablokowano nieoczekiwany adres.' };
    await chrome.tabs.create({ url: url.toString(), active: true });
    return { ok: true };
  }

  return { ok: false, error: 'Nieobsługiwany komunikat.' };
}

export default defineBackground(() => {
  if (import.meta.env.BROWSER !== 'opera') {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  }
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    void handleMessage(message, sender).then(sendResponse).catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  });
  chrome.tabs.onRemoved.addListener((tabId) => cartStates.delete(tabId));
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && !isCartUrl(tab.url)) cartStates.delete(tabId);
  });
});

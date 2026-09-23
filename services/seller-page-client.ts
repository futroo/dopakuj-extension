import { SELLER_REQUEST_TIMEOUT_MS } from '../constants/allegro';
import { sendMessage } from './message-bus';
import type { ExtensionMessage } from '../types/messages';

const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);

class SellerPageError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

export async function fetchSellerPage(url: string, signal: AbortSignal, strategy: 'direct' | 'tab' | 'interactive-tab' = 'direct', onChallenge?: (blocked: boolean) => void): Promise<string> {
  let lastError: Error | undefined;
  const maxAttempts = strategy === 'direct' ? 2 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal.aborted) throw signal.reason;
    const requestId = crypto.randomUUID();
    const statusListener = (message: ExtensionMessage): void => {
      if (message.type === 'SELLER_PAGE_STATUS' && message.payload.requestId === requestId && !signal.aborted) onChallenge?.(message.payload.blocked);
    };
    chrome.runtime.onMessage.addListener(statusListener);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error('Przekroczono czas pobierania strony sprzedawcy.'));
      void sendMessage({ type: 'CANCEL_SELLER_PAGE', payload: { requestId } });
    }, strategy === 'interactive-tab' ? 140_000 : SELLER_REQUEST_TIMEOUT_MS);
    const abort = () => {
      controller.abort(signal.reason);
      void sendMessage({ type: 'CANCEL_SELLER_PAGE', payload: { requestId } });
    };
    signal.addEventListener('abort', abort, { once: true });
    let rejectOnAbort: (() => void) | undefined;
    try {
      const response = await Promise.race([
        sendMessage({ type: 'FETCH_SELLER_PAGE', payload: { url, strategy, requestId } }),
        new Promise<never>((_, reject) => {
          rejectOnAbort = () => reject(controller.signal.reason);
          controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
        })
      ]);
      signal.throwIfAborted();
      if (!response.ok || !('html' in response)) throw new Error(response.ok ? 'Nieprawidłowa odpowiedź.' : response.error);
      if (response.status >= 200 && response.status < 300) return response.html;
      const error = new SellerPageError(`Allegro zwróciło status ${response.status}.`, TRANSIENT_STATUS.has(response.status));
      if (!error.retryable || attempt === maxAttempts - 1) throw error;
      lastError = error;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts - 1 || signal.aborted || (error instanceof SellerPageError && !error.retryable)) throw lastError;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      if (rejectOnAbort) controller.signal.removeEventListener('abort', rejectOnAbort);
      chrome.runtime.onMessage.removeListener(statusListener);
    }
    await new Promise((resolve) => setTimeout(resolve, 450));
  }
  throw lastError ?? new Error('Nie udało się pobrać strony sprzedawcy.');
}

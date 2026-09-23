import type { CartState } from './cart';

export interface ActiveContext {
  tabId?: number;
  url?: string;
  isAllegro: boolean;
  isCart: boolean;
}

export type ExtensionMessage =
  | { type: 'GET_ACTIVE_CONTEXT' }
  | { type: 'GET_CART_STATE'; tabId?: number }
  | { type: 'CART_STATE_UPDATED'; payload: CartState }
  | { type: 'NAVIGATE_TO_CART' }
  | { type: 'REFRESH_CART_STATE'; tabId?: number }
  | { type: 'CART_PARSE_ERROR'; payload: { message: string; state: CartState } }
  | { type: 'FETCH_SELLER_PAGE'; payload: { url: string; strategy?: 'direct' | 'tab' | 'interactive-tab'; requestId?: string } }
  | { type: 'CANCEL_SELLER_PAGE'; payload: { requestId: string } }
  | { type: 'SELLER_PAGE_STATUS'; payload: { requestId: string; blocked: boolean } }
  | { type: 'GET_PUBLIC_PAGE_HTML' }
  | { type: 'OPEN_URL'; payload: { url: string } };

export type ExtensionResponse =
  | { ok: true; context: ActiveContext }
  | { ok: true; state: CartState }
  | { ok: true; tabId: number }
  | { ok: true; html: string; status: number; pageState?: 'loading' | 'ready' | 'empty' | 'blocked' }
  | { ok: true }
  | { ok: false; error: string };

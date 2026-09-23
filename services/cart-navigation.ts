import { ALLEGRO_CART_URL } from '../constants/allegro';
import { sendMessage } from './message-bus';

export async function navigateToCart(): Promise<number> {
  const response = await sendMessage({ type: 'NAVIGATE_TO_CART' });
  if (!response.ok || !('tabId' in response)) throw new Error(response.ok ? 'Brak identyfikatora karty.' : response.error);
  return response.tabId;
}

export function cartUrl(): string {
  return ALLEGRO_CART_URL;
}

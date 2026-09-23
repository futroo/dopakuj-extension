export const ALLEGRO_ORIGIN = 'https://allegro.pl';
export const ALLEGRO_CART_URL = `${ALLEGRO_ORIGIN}/koszyk`;
export const CART_PATH_PATTERN = /^\/koszyk(?:\/|$)/;
export const CART_WAIT_TIMEOUT_MS = 15_000;
export const SELLER_REQUEST_TIMEOUT_MS = 12_000;
export const SELLER_PAGE_DELAY_MS = 350;
export const PARSER_VERSION = '1.0.0';

export function isAllegroUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'allegro.pl' || url.hostname.endsWith('.allegro.pl'));
  } catch {
    return false;
  }
}

export function isCartUrl(value?: string): boolean {
  if (!isAllegroUrl(value)) return false;
  return CART_PATH_PATTERN.test(new URL(value!).pathname);
}

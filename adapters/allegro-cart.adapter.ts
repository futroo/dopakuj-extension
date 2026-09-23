import { PARSER_VERSION, isCartUrl } from '../constants/allegro';
import type { CartDiagnostics, CartSeller, CartState } from '../types/cart';
import { buildSellerShopUrl, extractSellerLogin } from '../utils/normalize-url';

const GROUP_SELECTORS = [
  '[data-testid*="seller" i][data-testid*="group" i]',
  '[data-role="seller-group"]',
  'section:has(a[href*="/uzytkownik/"])',
  'article:has(a[href*="/uzytkownik/"])'
];
const ITEM_SELECTORS = ['[data-testid*="cart-item" i]', '[data-role="cart-item"]', 'article[data-offer-id]', 'li[data-offer-id]'];

function isChecked(checkbox: Element | null): boolean {
  return checkbox instanceof HTMLInputElement ? checkbox.checked : checkbox?.getAttribute('aria-checked') === 'true';
}

function offerCheckboxes(group: Element): Element[] {
  const found = new Set<Element>();
  for (const link of group.querySelectorAll<HTMLAnchorElement>('a[href*="/oferta/"], a[href*="/produkt/"][href*="offerId="]')) {
    let current: Element | null = link.parentElement;
    for (let depth = 0; current && current !== group && depth < 8; depth += 1, current = current.parentElement) {
      const checkbox = current.querySelector('input[type="checkbox"], [role="checkbox"]');
      if (checkbox) {
        found.add(checkbox);
        break;
      }
    }
  }
  return [...found];
}

function findSellerContainer(link: HTMLAnchorElement): Element | null {
  let current: Element | null = link.parentElement;
  let fallback: Element | null = null;
  for (let depth = 0; current && depth < 10; depth += 1, current = current.parentElement) {
    if (!fallback && current.matches('[data-testid*="seller" i], [data-role*="seller" i], section, article, li')) fallback = current;
    const logins = new Set(Array.from(current.querySelectorAll<HTMLAnchorElement>('a[href*="/uzytkownik/"]')).map((anchor) => extractSellerLogin(anchor.href)).filter(Boolean));
    const hasOffer = !!current.querySelector('a[href*="/oferta/"], a[href*="/produkt/"][href*="offerId="], [data-testid*="cart-item" i], [data-role="cart-item"]');
    const hasCheckbox = !!current.querySelector('input[type="checkbox"], [role="checkbox"]');
    if (logins.size === 1 && hasOffer && hasCheckbox) return current;
  }
  return fallback;
}

function checkedItemCount(group: Element): { selected: number; all: number } {
  const items = Array.from(group.querySelectorAll(ITEM_SELECTORS.join(',')));
  if (items.length) {
    return items.reduce((result, item) => {
      const checkbox = item.querySelector('input[type="checkbox"], [role="checkbox"]');
      const checked = isChecked(checkbox);
      result.all += 1;
      if (checked) result.selected += 1;
      return result;
    }, { selected: 0, all: 0 });
  }

  const linkedOfferCheckboxes = offerCheckboxes(group);
  if (linkedOfferCheckboxes.length) {
    return { all: linkedOfferCheckboxes.length, selected: linkedOfferCheckboxes.filter(isChecked).length };
  }

  const checkboxes = Array.from(group.querySelectorAll('input[type="checkbox"][name*="offer" i], input[type="checkbox"][data-testid*="item" i], [role="checkbox"][data-testid*="item" i]'));
  return {
    all: checkboxes.length,
    selected: checkboxes.filter(isChecked).length
  };
}

function sellerFromGroup(group: Element): CartSeller | undefined {
  const link = group.querySelector<HTMLAnchorElement>('a[href*="/uzytkownik/"]');
  const login = link ? extractSellerLogin(link.href) : undefined;
  if (!login) return undefined;
  const counts = checkedItemCount(group);
  const explicitId = group.getAttribute('data-seller-id') || link?.getAttribute('data-seller-id');
  return {
    id: explicitId || login.toLocaleLowerCase('pl'),
    login,
    shopUrl: buildSellerShopUrl(login),
    hasSelectedItems: counts.selected > 0,
    selectedItemsCount: counts.selected,
    allItemsCount: counts.all
  };
}

function mergeSeller(target: Map<string, CartSeller>, seller: CartSeller): void {
  const previous = target.get(seller.id);
  if (!previous) return void target.set(seller.id, seller);
  previous.selectedItemsCount += seller.selectedItemsCount;
  previous.allItemsCount += seller.allItemsCount;
  previous.hasSelectedItems ||= seller.hasSelectedItems;
}

export function parseCartDocument(document: Document, pageUrl: string): CartState {
  const cartRoute = isCartUrl(pageUrl);
  const baseDiagnostics: CartDiagnostics = {
    parserVersion: PARSER_VERSION,
    groupCount: 0,
    sellerCount: 0,
    selectedItemsCount: 0,
    fallback: 'none',
    isCartRoute: cartRoute
  };
  if (!cartRoute) return { status: 'unavailable', sellers: [], updatedAt: Date.now(), diagnostics: baseDiagnostics };

  const sellers = new Map<string, CartSeller>();
  const groups = Array.from(document.querySelectorAll(GROUP_SELECTORS.join(',')));
  for (const group of groups) {
    const seller = sellerFromGroup(group);
    if (seller) mergeSeller(sellers, seller);
  }

  let fallback: CartDiagnostics['fallback'] = sellers.size ? 'structured-groups' : 'none';
  if (!sellers.size) {
    fallback = 'seller-links';
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/uzytkownik/"]'));
    for (const link of links) {
      const container = findSellerContainer(link);
      if (!container) continue;
      const seller = sellerFromGroup(container);
      if (seller && seller.allItemsCount > 0) mergeSeller(sellers, seller);
    }
  }

  const list = [...sellers.values()];
  const diagnostics: CartDiagnostics = {
    ...baseDiagnostics,
    groupCount: groups.length,
    sellerCount: list.length,
    selectedItemsCount: list.reduce((sum, seller) => sum + seller.selectedItemsCount, 0),
    fallback
  };
  if (list.length) return { status: 'ready', sellers: list, updatedAt: Date.now(), diagnostics };

  const text = document.body?.textContent?.replace(/\s+/g, ' ').toLocaleLowerCase('pl') ?? '';
  if (/twój koszyk jest pusty|koszyk jest pusty|brak produktów w koszyku/.test(text)) {
    return { status: 'empty', sellers: [], updatedAt: Date.now(), diagnostics };
  }
  return {
    status: 'error', sellers: [], updatedAt: Date.now(),
    error: 'Nie udało się rozpoznać produktów w koszyku. Odśwież stronę; jeśli problem pozostanie, Allegro mogło zmienić jej układ.', diagnostics
  };
}

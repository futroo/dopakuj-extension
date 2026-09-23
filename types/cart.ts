export interface CartSeller {
  id: string;
  login: string;
  shopUrl: string;
  hasSelectedItems: boolean;
  selectedItemsCount: number;
  allItemsCount: number;
}

export type CartStatus = 'unavailable' | 'loading' | 'ready' | 'empty' | 'error';

export interface CartDiagnostics {
  parserVersion: string;
  groupCount: number;
  sellerCount: number;
  selectedItemsCount: number;
  fallback: 'structured-groups' | 'seller-links' | 'none';
  isCartRoute: boolean;
}

export interface CartState {
  status: CartStatus;
  sellers: CartSeller[];
  sourceTabId?: number;
  updatedAt: number;
  error?: string;
  diagnostics?: CartDiagnostics;
}

export type SellerMode = 'selected' | 'all';

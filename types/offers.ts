export interface Money {
  amount: number;
  currency: string;
  formatted: string;
}

export interface OfferSearchResult {
  id: string;
  title: string;
  offerUrl: string;
  imageUrl?: string;
  sellerId: string;
  sellerLogin: string;
  sellerShopUrl: string;
  sellerSearchUrl: string;
  price: Money;
  originalPrice?: Money;
  isSponsored?: boolean;
  isSmart?: boolean;
  freeDelivery?: boolean;
  condition?: string;
  sourceOrder: number;
}

export interface SellerSearchState {
  sellerId: string;
  nextRemotePage: number;
  hasMore: boolean;
  loading: boolean;
  checked: boolean;
  error?: string;
}

export type SearchSort = 'relevance' | 'price-asc' | 'price-desc' | 'title-asc' | 'title-desc' | 'seller-asc' | 'seller-desc';

export interface SearchFilters {
  sellerIds: string[] | null;
  minPrice?: number;
  maxPrice?: number;
  smartOnly: boolean;
  freeDeliveryOnly: boolean;
  showSponsored: boolean;
  conditions: string[];
  perPage: 12 | 24 | 48;
}

export interface PendingSearch {
  query: string;
  sellerMode: import('./cart').SellerMode;
  excludedSellerIds: string[];
  filters: SearchFilters;
  sort: SearchSort;
  createdAt: number;
}

export interface ParsedOffersPage {
  offers: OfferSearchResult[];
  hasMore: boolean;
  probableParserError: boolean;
  blocked: boolean;
}

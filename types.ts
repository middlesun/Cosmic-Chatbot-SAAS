export enum Currency {
  INR = 'INR',
  USD = 'USD',
  EUR = 'EUR'
}

export enum Category {
  TOP = 'Top',
  CONSULTATIONS = 'Consultations',
  LOVE = 'Love',
  MARRIAGE = 'Marriage',
  CAREER = 'Career',
  FINANCE = 'Finance',
  HEALTH = 'Health',
  ALL = 'All'
}

export enum SubCategory {
  LOVE = 'Love',
  MARRIAGE = 'Marriage',
  BREAKUP = 'Breakup',
  SECOND_MARRIAGE = 'Second Marriage',
  JOB = 'Job',
  BUSINESS = 'Business',
  WEALTH = 'Wealth',
  HEALTH = 'Health'
}

export interface BirthDetails {
  name?: string;
  day: string;
  month: string;
  year: string;
  tob: string;
  city: string;
  state: string;
  country: string;
  sex?: 'male' | 'female' | 'non-binary';
  relationship?: string;
}

export interface Product {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  priceINR: number;
  category: Category;
  subCategory?: SubCategory;
  bullets?: string[];
  icon: string;
  isPopular?: boolean;
}

export interface Order {
  id: string;
  productId: string;
  birthDetails: BirthDetails;
  isSomeoneElse: boolean;
  question?: string;
  email: string;
  country: string;
  totalPrice: number;
  currency: Currency;
  timestamp: number;
}

/**
 * Calculates and formats price based on INR value and selected currency
 * using the International Pricing Rules (1.3x premium, specific effective rates, 
 * and psychological rounding to 5/9).
 */
export const formatCurrencyPrice = (amountINR: number, currency: Currency): string => {
  if (currency === Currency.INR) return `₹${amountINR.toLocaleString('en-IN')}`;

  // Authoritative map for current pricing as per worked examples
  const map: Record<number, { usd: number; eur: number }> = {
    0: { usd: 0, eur: 0 },
    799: { usd: 18, eur: 18 },
    999: { usd: 19, eur: 19 },
    1299: { usd: 25, eur: 29 },
    1999: { usd: 39, eur: 39 },
    3999: { usd: 69, eur: 64 },
    5999: { usd: 118, eur: 118 },
    19999: { usd: 378, eur: 398 }
  };

  if (map[amountINR]) {
    const val = map[amountINR];
    return currency === Currency.USD ? `$${val.usd}` : `€${val.eur}`;
  }

  // Fallback Logic for future prices
  const premium = amountINR * 1.3;
  const rawValue = currency === Currency.USD ? premium / 70 : premium / 65;
  
  const roundPsychologically = (val: number): number => {
    if (val <= 0) return 0;
    const ceil = Math.ceil(val);
    const last = ceil % 10;
    if (last <= 5) return Math.floor(ceil / 10) * 10 + 5;
    return Math.floor(ceil / 10) * 10 + 9;
  };

  const finalPrice = roundPsychologically(rawValue);
  return currency === Currency.USD ? `$${finalPrice}` : `€${finalPrice}`;
};

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

import type { CustomerInfo } from 'react-native-purchases';

type Listener = (customerInfo: CustomerInfo) => void;

const listeners = new Set<Listener>();

/** A CustomerInfo with or without an active `travelo_pro` entitlement. */
export function customerInfoFixture({ pro }: { pro: boolean }): CustomerInfo {
  const entitlement = {
    identifier: 'travelo_pro',
    isActive: true,
    willRenew: true,
    productIdentifier: 'travelo_pro_monthly',
  };
  return {
    entitlements: { all: pro ? { travelo_pro: entitlement } : {}, active: pro ? { travelo_pro: entitlement } : {}, verification: 'NOT_REQUESTED' },
    activeSubscriptions: pro ? ['travelo_pro_monthly'] : [],
    allPurchasedProductIdentifiers: [],
    latestExpirationDate: null,
    firstSeen: '2026-01-01T00:00:00Z',
    originalAppUserId: 'test-user',
    requestDate: '2026-01-01T00:00:00Z',
    allExpirationDates: {},
    allPurchaseDates: {},
    originalApplicationVersion: null,
    originalPurchaseDate: null,
    managementURL: null,
    nonSubscriptionTransactions: [],
    subscriptionsByProductIdentifier: {},
  } as unknown as CustomerInfo;
}

export const purchasesMock = {
  configure: jest.fn(),
  logIn: jest.fn(),
  logOut: jest.fn(),
  getCustomerInfo: jest.fn(),
  getAppUserID: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  removeCustomerInfoUpdateListener: jest.fn(),
};

// Default behaviour; also re-applied on every reset so once-queues (mockReturnValueOnce) never leak between tests.
function applyPurchasesDefaults() {
  purchasesMock.logIn.mockImplementation(async () => ({ customerInfo: customerInfoFixture({ pro: false }), created: false }));
  purchasesMock.logOut.mockImplementation(async () => customerInfoFixture({ pro: false }));
  purchasesMock.getCustomerInfo.mockImplementation(async () => customerInfoFixture({ pro: false }));
  // An anonymous SDK user: differs from every Supabase user id.
  purchasesMock.getAppUserID.mockImplementation(async () => '$RCAnonymousID:test');
  purchasesMock.addCustomerInfoUpdateListener.mockImplementation((listener: Listener) => {
    listeners.add(listener);
  });
  purchasesMock.removeCustomerInfoUpdateListener.mockImplementation((listener: Listener) => listeners.delete(listener));
}
applyPurchasesDefaults();

export const purchasesUiMock = {
  presentPaywall: jest.fn(),
  presentCustomerCenter: jest.fn(),
};

// Same values as the real PAYWALL_RESULT enum (@revenuecat/purchases-typescript-internal).
export const PAYWALL_RESULT = {
  NOT_PRESENTED: 'NOT_PRESENTED',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED',
  PURCHASED: 'PURCHASED',
  RESTORED: 'RESTORED',
} as const;

/** Delivers a customer-info update to every listener registered through the mock. */
export function emitCustomerInfo(customerInfo: CustomerInfo) {
  listeners.forEach((listener) => listener(customerInfo));
}

export function resetPurchasesMocks() {
  listeners.clear();
  Object.values(purchasesMock).forEach((fn) => fn.mockReset());
  applyPurchasesDefaults();
  Object.values(purchasesUiMock).forEach((fn) => fn.mockClear());
}

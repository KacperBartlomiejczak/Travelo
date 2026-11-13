import type { CustomerInfo } from 'react-native-purchases';

/** The entitlement configured in RevenueCat that the Pro subscription unlocks. */
export const PRO_ENTITLEMENT = 'travelo_pro';

export const hasPro = (customerInfo: CustomerInfo): boolean => customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

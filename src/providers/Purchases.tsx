import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { configurePurchases } from '@/data/purchases';
import { hasPro } from '@/lib/pro';

import { useSession } from './Session';

const PurchasesContext = createContext<boolean | null>(null);

/** Whether the signed-in user has the PRO entitlement. False until known and on any SDK error. */
export function useIsPro(): boolean {
  const value = useContext(PurchasesContext);
  if (value === null) throw new Error('useIsPro must be used inside AppProviders');
  return value;
}

const IdentityConfirmedContext = createContext<boolean | null>(null);

/** True only when the SDK user is confirmed to be the session user, so a purchase cannot be credited to another account. */
export function useIsProIdentityConfirmed(): boolean {
  const value = useContext(IdentityConfirmedContext);
  if (value === null) throw new Error('useIsProIdentityConfirmed must be used inside AppProviders');
  return value;
}

/** Keeps the RevenueCat user in step with the session (`logIn` / `logOut`) and exposes the PRO status. Must sit inside `SessionProvider`. */
export function PurchasesProvider({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const status = state.status;
  const userId = state.status === 'signedIn' ? state.userId : null;

  // Every session change gets a new id, adjusted during render so no render ever pairs the new session with the old status.
  const key = `${status}:${userId}`;
  const [session, setSession] = useState({ key, id: 0 });
  if (session.key !== key) setSession({ key, id: session.id + 1 });
  const [pro, setPro] = useState({ id: 0, value: false });
  const isPro = pro.id === session.id && pro.value;
  const [confirmedState, setConfirmedState] = useState({ id: 0, value: false });
  const isConfirmed = confirmedState.id === session.id && confirmedState.value;

  // What async answers and listener updates are checked against; `confirmed` = PRO status may be taken from the SDK (the SDK user is this session's user, or an offline start showing the cache).
  const live = useRef({ id: 0, signedIn: false, confirmed: false });

  useEffect(() => {
    const onUpdate = (info: CustomerInfo) => {
      const { id, signedIn, confirmed } = live.current;
      if (signedIn && confirmed) setPro({ id, value: hasPro(info) });
    };
    try {
      configurePurchases();
      Purchases.addCustomerInfoUpdateListener(onUpdate);
    } catch {
      return; // Not configured: PRO stays false and the app carries on.
    }
    return () => {
      Purchases.removeCustomerInfoUpdateListener(onUpdate);
    };
  }, []);

  useEffect(() => {
    const id = session.id;
    live.current = { id, signedIn: status === 'signedIn', confirmed: status === 'signedIn' && userId === null };
    const apply = (value: boolean) => {
      if (live.current.id === id) setPro({ id, value });
    };

    if (status === 'signedOut') {
      // The SDK may still remember the previous account, and rejects when its user is already anonymous.
      Purchases.logOut().catch(() => {});
    } else if (status === 'signedIn' && userId === null) {
      // Offline start: identity stays unconfirmed (D7) until a token refresh gives a user id; the PRO badge is whatever the SDK
      // has cached. Any SDK error: not PRO.
      Purchases.getCustomerInfo().then((info) => apply(hasPro(info)), () => apply(false));
    } else if (userId !== null) {
      void (async () => {
        let sameUser = false;
        try {
          sameUser = (await Purchases.getAppUserID()) === userId;
        } catch {}
        if (live.current.id !== id) return;
        let loggedIn = false;
        if (sameUser) {
          live.current.confirmed = true;
          setConfirmedState({ id, value: true });
          // logIn may already have answered with fresher data.
          Purchases.getCustomerInfo().then(
            (info) => loggedIn || apply(hasPro(info)),
            () => loggedIn || apply(false),
          );
        }
        try {
          const { customerInfo } = await Purchases.logIn(userId);
          loggedIn = true;
          if (live.current.id !== id) return;
          live.current.confirmed = true;
          setConfirmedState({ id, value: true });
          apply(hasPro(customerInfo));
        } catch {
          if (!sameUser) apply(false);
        }
      })();
    }
  }, [session.id, status, userId]);

  return (
    <PurchasesContext.Provider value={isPro}>
      <IdentityConfirmedContext.Provider value={isConfirmed}>{children}</IdentityConfirmedContext.Provider>
    </PurchasesContext.Provider>
  );
}

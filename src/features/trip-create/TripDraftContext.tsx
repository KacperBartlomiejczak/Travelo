import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { emptyDraft, withCompanionCount, type TripDraft } from './draft';

type TripDraftContextValue = {
  draft: TripDraft;
  setDraft: (update: (draft: TripDraft) => TripDraft) => void;
  setCompanionCount: (count: number) => void;
  /** True once anything was changed; leaving then asks for confirmation (D19). */
  isDirty: boolean;
  /** Set after the trip was saved; leaving no longer asks (D38). */
  isComplete: boolean;
  complete: () => void;
};

const TripDraftContext = createContext<TripDraftContextValue | null>(null);

export function TripDraftProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(emptyDraft);
  const [draft, setDraftState] = useState(initial);
  const [isComplete, setComplete] = useState(false);
  const value = useMemo<TripDraftContextValue>(
    () => ({
      draft,
      setDraft: setDraftState,
      setCompanionCount: (count) => setDraftState((current) => withCompanionCount(current, count)),
      isDirty: draft !== initial,
      isComplete,
      complete: () => setComplete(true),
    }),
    [draft, initial, isComplete],
  );
  return <TripDraftContext.Provider value={value}>{children}</TripDraftContext.Provider>;
}

export function useTripDraft(): TripDraftContextValue {
  const value = useContext(TripDraftContext);
  if (!value) throw new Error('useTripDraft must be used inside TripDraftProvider');
  return value;
}

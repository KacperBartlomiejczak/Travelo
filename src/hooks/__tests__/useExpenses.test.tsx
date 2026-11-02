import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { NotYourExpenseError, type ExpenseInput } from '@/data/expense-repository';
import { LOCAL_PROFILE_ID } from '@/data/profile-repository';
import { useCanEditExpense, useDeleteExpense, useExpenses, useSaveExpense } from '@/hooks/useExpenses';
import { AppProviders } from '@/providers/AppProviders';
import { repositoryWithProfile, setAppProfileRepository } from '@/test/fake-profile-repository';

const mockRequestSync = jest.fn();
jest.mock('@/providers/BudgetSync', () => ({
  ...jest.requireActual('@/providers/BudgetSync'),
  useRequestBudgetSync: () => mockRequestSync,
}));

const TRIP_ID = '00000000-0000-4000-8000-0000000000a1';
const OWN_MEMBER = '00000000-0000-4000-8000-0000000000b1';
const OTHER_MEMBER = '00000000-0000-4000-8000-0000000000b2';
const member = (id: string, userId: string | null) => ({ id, tripId: TRIP_ID, userId, displayName: 'X', role: 'viewer' as const, interests: [] });
const overviewOf = (ownerId: string, members = [member(OWN_MEMBER, LOCAL_PROFILE_ID), member(OTHER_MEMBER, null)]) => ({
  trip: { id: TRIP_ID, ownerId, baseCurrency: 'THB' },
  members,
});
const asOwner = overviewOf(LOCAL_PROFILE_ID);
const asFriend = overviewOf('00000000-0000-4000-8000-0000000000c1');

const input = (over: Partial<ExpenseInput> = {}): ExpenseInput => ({
  name: 'Pad thai',
  amount: { amountMinor: 12000, currency: 'THB' },
  category: 'food',
  memberId: null,
  spentOn: '2026-11-03',
  ...over,
});

function wrapperFor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <AppProviders queryClient={queryClient}>{children}</AppProviders>;
  return wrapper;
}

beforeEach(() => mockRequestSync.mockClear());

describe('useExpenses', () => {
  it('reads the trip expenses from the device and refreshes after a save and a delete', async () => {
    const { result } = await renderHook(() => ({ list: useExpenses(TRIP_ID), save: useSaveExpense(asOwner), canEdit: useCanEditExpense(asOwner), del: useDeleteExpense(asOwner) }), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.list.data).toEqual([]));

    await waitFor(() => expect(result.current.canEdit({ memberId: null })).toBe(true));
    let saved: { id: string } | undefined;
    await act(async () => void (saved = await result.current.save.mutateAsync({ input: input() })));
    await waitFor(() => expect(result.current.list.data?.map((e) => e.name)).toEqual(['Pad thai']));
    expect(result.current.list.data?.[0].syncStatus).toBe('pending');

    await act(async () => void (await result.current.del.mutateAsync(saved!.id)));
    await waitFor(() => expect(result.current.list.data).toEqual([]));
  });

  it('updates an existing expense when an id is given', async () => {
    const { result } = await renderHook(() => ({ list: useExpenses(TRIP_ID), save: useSaveExpense(asOwner), canEdit: useCanEditExpense(asOwner) }), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.canEdit({ memberId: null })).toBe(true));
    let saved: { id: string } | undefined;
    await act(async () => void (saved = await result.current.save.mutateAsync({ input: input() })));
    await act(async () => void (await result.current.save.mutateAsync({ id: saved!.id, input: input({ name: 'Noodles' }) })));
    await waitFor(() => expect(result.current.list.data?.map((e) => e.name)).toEqual(['Noodles']));
  });

  it('requests a sync once when it mounts for a trip, and after a save and a delete', async () => {
    const { result } = await renderHook(() => ({ list: useExpenses(TRIP_ID), save: useSaveExpense(asOwner), canEdit: useCanEditExpense(asOwner), del: useDeleteExpense(asOwner) }), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(mockRequestSync).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.canEdit({ memberId: null })).toBe(true));
    let saved: { id: string } | undefined;
    await act(async () => void (saved = await result.current.save.mutateAsync({ input: input() })));
    expect(mockRequestSync).toHaveBeenCalledTimes(2);
    await act(async () => void (await result.current.del.mutateAsync(saved!.id)));
    expect(mockRequestSync).toHaveBeenCalledTimes(3);
  });

  it('works offline: reads and saves do not wait for the network', async () => {
    onlineManager.setOnline(false);
    try {
      const { result } = await renderHook(() => ({ list: useExpenses(TRIP_ID), save: useSaveExpense(asOwner), canEdit: useCanEditExpense(asOwner) }), { wrapper: wrapperFor() });
      await waitFor(() => expect(result.current.list.data).toEqual([]));
      await waitFor(() => expect(result.current.canEdit({ memberId: null })).toBe(true));
      await act(async () => void (await result.current.save.mutateAsync({ input: input() })));
      await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    } finally {
      onlineManager.setOnline(true);
    }
  });
});

describe('writer rules (expenses D15)', () => {
  it('the owner may edit any expense', async () => {
    const { result } = await renderHook(() => useCanEditExpense(asOwner), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current({ memberId: OTHER_MEMBER })).toBe(true));
    expect(result.current({ memberId: null })).toBe(true);
  });

  it('a linked friend may edit only expenses with their own member id', async () => {
    const { result } = await renderHook(() => useCanEditExpense(asFriend), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current({ memberId: OWN_MEMBER })).toBe(true));
    expect(result.current({ memberId: OTHER_MEMBER })).toBe(false);
    expect(result.current({ memberId: null })).toBe(false);
  });

  it('a friend cannot save an expense for someone else', async () => {
    const { result } = await renderHook(() => ({ canEdit: useCanEditExpense(asFriend), save: useSaveExpense(asFriend) }), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.canEdit({ memberId: OWN_MEMBER })).toBe(true));
    await act(async () => void (await result.current.save.mutateAsync({ input: input({ memberId: OWN_MEMBER }) })));
    await act(async () => {
      await expect(result.current.save.mutateAsync({ input: input({ memberId: OTHER_MEMBER }) })).rejects.toBeInstanceOf(NotYourExpenseError);
    });
  });

  it('refuses a write by a friend while the profile is still loading', async () => {
    let release: (value: Awaited<ReturnType<typeof repositoryWithProfile>>) => void = () => {};
    setAppProfileRepository(new Promise((resolve) => (release = resolve)));
    const { result } = await renderHook(() => useSaveExpense(asFriend), { wrapper: wrapperFor() });
    await act(async () => {
      await expect(result.current.mutateAsync({ input: input({ memberId: OWN_MEMBER }) })).rejects.toBeInstanceOf(NotYourExpenseError);
    });
    release(await repositoryWithProfile());
  });
});

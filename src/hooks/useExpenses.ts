import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { ExpenseInput, ExpenseWriter } from '@/data/expense-repository';
import { useIsTripOwner, useMyProfileId } from '@/hooks/useProfile';
import { useExpenseRepository } from '@/providers/AppProviders';
import { useRequestBudgetSync } from '@/providers/BudgetSync';
import type { TripMember, TripSummary } from '@/schemas';

/** What the expense hooks need to know about the trip: its currency and owner, and the members (to find the own row). */
export type ExpenseTrip = { trip: Pick<TripSummary, 'id' | 'ownerId' | 'baseCurrency'>; members: Pick<TripMember, 'id' | 'userId'>[] };

const expensesKey = (tripId: string) => ['expenses', tripId] as const;

/** Who is writing (expenses D15, A2): the owner writes anything; a linked friend, their own member row only. */
export function useExpenseWriter({ trip, members }: ExpenseTrip): ExpenseWriter {
  const isOwner = useIsTripOwner(trip.ownerId);
  const myId = useMyProfileId();
  const own = myId ? members.find((member) => member.userId === myId) : undefined;
  return { isOwner, ownMemberId: own?.id ?? null };
}

/** The trip's live expenses, read from the device. Asks for a sync once per trip, so a fresh phone pulls the others' expenses. */
export function useExpenses(tripId: string) {
  const repository = useExpenseRepository();
  const requestSync = useRequestBudgetSync();
  useEffect(() => {
    requestSync();
  }, [tripId, requestSync]);
  // 'always': a local read, it never needs the network.
  return useQuery({ queryKey: expensesKey(tripId), queryFn: () => repository.list(tripId), networkMode: 'always', retry: false });
}

/** Whether the signed-in user may edit or delete this expense (same rule the repository enforces). */
export function useCanEditExpense(overview: ExpenseTrip): (expense: { memberId: string | null }) => boolean {
  const { isOwner, ownMemberId } = useExpenseWriter(overview);
  return ({ memberId }) => isOwner || (memberId !== null && memberId === ownMemberId);
}

type SaveExpense = { id?: string; input: ExpenseInput };

/** Adds an expense, or changes it when `id` is given; written on the device, then sent when possible. */
export function useSaveExpense(overview: ExpenseTrip) {
  const repository = useExpenseRepository();
  const queryClient = useQueryClient();
  const requestSync = useRequestBudgetSync();
  const writer = useExpenseWriter(overview);
  const scope = { tripId: overview.trip.id, baseCurrency: overview.trip.baseCurrency, writer };
  return useMutation({
    mutationFn: ({ id, input }: SaveExpense) => (id ? repository.update(scope, id, input) : repository.add(scope, input)),
    // Saving never waits for the network.
    networkMode: 'always',
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expensesKey(scope.tripId) });
      requestSync();
    },
  });
}

/** Deletes an expense (soft delete on the device), then sends it when possible. */
export function useDeleteExpense(overview: ExpenseTrip) {
  const repository = useExpenseRepository();
  const queryClient = useQueryClient();
  const requestSync = useRequestBudgetSync();
  const writer = useExpenseWriter(overview);
  const scope = { tripId: overview.trip.id, baseCurrency: overview.trip.baseCurrency, writer };
  return useMutation({
    mutationFn: (id: string) => repository.remove(scope, id),
    networkMode: 'always',
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expensesKey(scope.tripId) });
      requestSync();
    },
  });
}

import type { InterestTag } from '../schemas/interests.ts';
import type { PlanPersonId, PlanPersonRef, PlanPreference } from '../schemas/trip-plan.ts';

export type PlanPerson = { personId: PlanPersonId; interests: InterestTag[] };

// P1 = organizer, P2... = members sorted by id. Names are never output (Z5).
export function planPeople(
  owner: { interests: InterestTag[] },
  members: readonly { id: string; interests: InterestTag[] }[],
): { people: PlanPerson[]; refs: Record<string, PlanPersonRef> } {
  const sorted = [...members].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const people: PlanPerson[] = [{ personId: 'P1', interests: owner.interests }];
  const refs: Record<string, PlanPersonRef> = { P1: 'owner' };
  sorted.forEach((m, i) => {
    const personId = `P${i + 2}`;
    people.push({ personId, interests: m.interests });
    refs[personId] = m.id;
  });
  return { people, refs };
}

// Only these constants may reach the prompt.
const PREFERENCE_NOTES: Record<PlanPreference, string> = {
  pace_relaxed: 'The group prefers a relaxed pace: fewer places per day.',
  pace_intense: 'The group prefers an intense pace: as many places per day as is reasonable.',
  more_food: 'The group wants more food places than usual.',
  no_museums: 'The group does not want any museums.',
};

export const preferenceNotes = (preferences: readonly PlanPreference[]): string[] =>
  preferences.map((p) => PREFERENCE_NOTES[p]);

import { planPeople, preferenceNotes } from '../plan-people';

describe('planPeople', () => {
  const owner = { interests: ['museums' as const] };
  // Extra `name` fields simulate real member rows; they must never reach the output.
  const members = [
    { id: 'b-2', name: 'Bob Secret', interests: ['beaches' as const] },
    { id: 'a-1', name: 'Alice Secret', interests: [] },
  ];

  it('P1 is the owner, members follow sorted by id', () => {
    const { people, refs } = planPeople(owner, members);
    expect(people).toEqual([
      { personId: 'P1', interests: ['museums'] },
      { personId: 'P2', interests: [] },
      { personId: 'P3', interests: ['beaches'] },
    ]);
    expect(refs).toEqual({ P1: 'owner', P2: 'a-1', P3: 'b-2' });
  });

  it('is stable regardless of input order and never leaks names', () => {
    const a = planPeople(owner, members);
    expect(planPeople(owner, [...members].reverse())).toEqual(a);
    expect(JSON.stringify(a)).not.toMatch(/Secret/);
  });
});

describe('preferenceNotes', () => {
  it('empty -> []', () => expect(preferenceNotes([])).toEqual([]));

  it.each([
    ['pace_relaxed', 'The group prefers a relaxed pace: fewer places per day.'],
    ['pace_intense', 'The group prefers an intense pace: as many places per day as is reasonable.'],
    ['more_food', 'The group wants more food places than usual.'],
    ['no_museums', 'The group does not want any museums.'],
  ] as const)('%s -> its sentence', (chip, sentence) => {
    expect(preferenceNotes([chip])).toEqual([sentence]);
  });

  it('keeps one sentence per chip in order', () => {
    expect(preferenceNotes(['more_food', 'no_museums'])).toEqual([
      'The group wants more food places than usual.',
      'The group does not want any museums.',
    ]);
  });
});

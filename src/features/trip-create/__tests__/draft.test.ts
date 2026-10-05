import {
  addLayover,
  budgetCurrency,
  budgetCurrencyOptions,
  toCreateTripInput,
  emptyDraft,
  emptySegment,
  withCompanionCount,
  withOutbound,
} from '@/features/trip-create/draft';

describe('emptyDraft', () => {
  it('starts with one empty outbound and one empty return segment, alone, no budget', () => {
    const draft = emptyDraft();
    expect(draft.outbound).toHaveLength(1);
    expect(draft.return).toHaveLength(1);
    expect(draft.outbound[0]).toEqual({
      key: expect.any(String),
      fromIata: '',
      departTz: '',
      toIata: '',
      arriveTz: '',
      departAt: '',
      arriveAt: '',
    });
    expect(draft.outbound[0].key).not.toBe(draft.return[0].key);
    expect(draft.companionCount).toBe(0);
    expect(draft.friends).toEqual([]);
    expect(draft.budget).toEqual({ amountText: '', currency: '' });
  });
});

describe('withCompanionCount', () => {
  it('adds an empty friend per companion', () => {
    const draft = withCompanionCount(emptyDraft(), 3);
    expect(draft.companionCount).toBe(3);
    expect(draft.friends).toEqual([
      { displayName: '', interests: [] },
      { displayName: '', interests: [] },
      { displayName: '', interests: [] },
    ]);
  });

  it('keeps already-filled friends when the count changes (D10)', () => {
    const three = withCompanionCount(emptyDraft(), 3);
    three.friends[0] = { displayName: 'Kasia', interests: ['beaches'] };
    three.friends[1] = { displayName: 'Ola', interests: [] };
    const two = withCompanionCount(three, 2);
    expect(two.friends.map((friend) => friend.displayName)).toEqual(['Kasia', 'Ola']);
    expect(withCompanionCount(two, 4).friends.map((friend) => friend.displayName)).toEqual(['Kasia', 'Ola', '', '']);
  });

  it('does not change the draft it was given', () => {
    const draft = emptyDraft();
    withCompanionCount(draft, 2);
    expect(draft.friends).toEqual([]);
  });
});

describe('addLayover', () => {
  it('adds a segment that departs from where the last one landed', () => {
    const segments = [{ ...emptySegment(), fromIata: 'WAW', departTz: 'Europe/Warsaw', toIata: 'DXB', arriveTz: 'Asia/Dubai' }];
    expect(addLayover(segments)).toEqual([
      segments[0],
      { ...emptySegment(), key: expect.any(String), fromIata: 'DXB', departTz: 'Asia/Dubai' },
    ]);
  });
});

describe('withOutbound (D25: return follows the outbound reversed)', () => {
  const waw = { fromIata: 'WAW', departTz: 'Europe/Warsaw' };
  const bkk = { toIata: 'BKK', arriveTz: 'Asia/Bangkok' };

  it('suggests the reversed route while the return airports are empty', () => {
    const draft = withOutbound(emptyDraft(), [{ ...emptySegment(), ...waw, ...bkk }]);
    expect(draft.return[0]).toEqual({
      ...emptySegment(),
      key: expect.any(String),
      fromIata: 'BKK',
      departTz: 'Asia/Bangkok',
      toIata: 'WAW',
      arriveTz: 'Europe/Warsaw',
    });
  });

  it('uses the first departure and the last arrival of a multi-segment outbound', () => {
    const outbound = [
      { ...emptySegment(), ...waw, toIata: 'DXB', arriveTz: 'Asia/Dubai' },
      { ...emptySegment(), fromIata: 'DXB', departTz: 'Asia/Dubai', ...bkk },
    ];
    const draft = withOutbound(emptyDraft(), outbound);
    expect([draft.return[0].fromIata, draft.return[0].toIata]).toEqual(['BKK', 'WAW']);
  });

  it('keeps following the outbound while the return still equals the previous suggestion', () => {
    const first = withOutbound(emptyDraft(), [{ ...emptySegment(), ...waw, ...bkk }]);
    const changed = withOutbound(first, [{ ...emptySegment(), ...waw, toIata: 'HKT', arriveTz: 'Asia/Bangkok' }]);
    expect([changed.return[0].fromIata, changed.return[0].toIata]).toEqual(['HKT', 'WAW']);
  });

  it('stops following once the user changed the return (open-jaw)', () => {
    const first = withOutbound(emptyDraft(), [{ ...emptySegment(), ...waw, ...bkk }]);
    const openJaw = { ...first, return: [{ ...first.return[0], fromIata: 'HKT' }] };
    const changed = withOutbound(openJaw, [{ ...emptySegment(), ...waw, toIata: 'KBV', arriveTz: 'Asia/Bangkok' }]);
    expect(changed.return[0].fromIata).toBe('HKT');
  });

  it('keeps return dates and leaves a multi-segment return alone', () => {
    const withDates = { ...emptyDraft(), return: [{ ...emptySegment(), departAt: '2026-11-15T09:00' }] };
    expect(withOutbound(withDates, [{ ...emptySegment(), ...waw, ...bkk }]).return[0].departAt).toBe('2026-11-15T09:00');
    const twoBack = { ...emptyDraft(), return: [emptySegment(), emptySegment()] };
    expect(withOutbound(twoBack, [{ ...emptySegment(), ...waw, ...bkk }]).return).toEqual(twoBack.return);
  });
});

describe('budget currency (D8, D34, D36)', () => {
  const to = (iata: string, tz: string) => ({ ...emptyDraft(), outbound: [{ ...emptySegment(), toIata: iata, arriveTz: tz }] });
  const bkk = to('BKK', 'Asia/Bangkok');
  const bcn = to('BCN', 'Europe/Madrid');

  it('offers the destination currency first, then PLN, EUR, USD without duplicates', () => {
    expect(budgetCurrencyOptions(bkk)).toEqual(['THB', 'PLN', 'EUR', 'USD']);
    expect(budgetCurrencyOptions(bcn)).toEqual(['EUR', 'PLN', 'USD']);
  });

  it("uses the destination's currency until the user picks one", () => {
    expect(budgetCurrency(bkk)).toBe('THB');
    expect(budgetCurrency({ ...bkk, budget: { amountText: '', currency: 'PLN' } })).toBe('PLN');
  });

  it('keeps a hand-picked PLN/EUR/USD when the destination changes', () => {
    expect(budgetCurrency({ ...bcn, budget: { amountText: '', currency: 'PLN' } })).toBe('PLN');
  });

  it("falls back to the new destination's currency when the pick is no longer offered", () => {
    expect(budgetCurrency({ ...bcn, budget: { amountText: '', currency: 'THB' } })).toBe('EUR');
  });
});

describe('toCreateTripInput', () => {
  it('turns the draft into the schema input: parsed amount, derived currency', () => {
    const draft = {
      ...withCompanionCount(emptyDraft(), 1),
      outbound: [{ ...emptySegment(), fromIata: 'WAW', departTz: 'Europe/Warsaw', toIata: 'BKK', arriveTz: 'Asia/Bangkok', departAt: '2026-11-02T22:00', arriveAt: '2026-11-03T14:00' }],
      friends: [{ displayName: 'Kasia', interests: ['beaches' as const] }],
      budget: { amountText: '2 500,50', currency: '' },
    };
    const input = toCreateTripInput(draft, 'pl');
    expect(input.budget).toEqual({ budgetPerPerson: { amountMinor: 250050, currency: 'THB' } });
    expect(input.flights.companionCount).toBe(1);
    expect(input.friends).toEqual({ friends: [{ displayName: 'Kasia', interests: ['beaches'] }] });
    expect(input.flights.outbound[0]).toEqual(expect.objectContaining({ fromIata: 'WAW', toIata: 'BKK' }));
  });
});

describe('toCreateTripInput with an amount that does not parse', () => {
  it('uses 0, which the schema rejects', () => {
    const draft = { ...emptyDraft(), budget: { amountText: 'abc', currency: '' } };
    expect(toCreateTripInput(draft, 'pl').budget.budgetPerPerson.amountMinor).toBe(0);
  });
});

import {
  addLayover,
  budgetCurrency,
  budgetCurrencyOptions,
  toCreateTripInput,
  tripName,
  emptyDraft,
  emptyFriend,
  emptySegment,
  hasUnresolvedCode,
  withCodeText,
  withCompanionCount,
  withFoundFriend,
  withOutbound,
} from '@/features/trip-create/draft';
import { DEFAULT_COVER } from '@/schemas';

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

  it('has no name of its own yet, and starts on the default cover (trip-covers D4, D7)', () => {
    const draft = emptyDraft();
    expect(draft.name).toBeNull();
    expect(draft.coverImageUri).toBe(DEFAULT_COVER);
    expect(DEFAULT_COVER).toBe('preset:auckland');
  });
});

describe('tripName (A2)', () => {
  const krkBcn = {
    ...emptyDraft(),
    outbound: [{ ...emptySegment(), fromIata: 'KRK', departTz: 'Europe/Warsaw', toIata: 'BCN', arriveTz: 'Europe/Madrid' }],
  };

  it('is the default name while the organizer has not typed one', () => {
    expect(tripName(krkBcn)).toBe('Kraków → Barcelona');
  });

  it('follows the flights while it is the default', () => {
    const toLisbon = { ...krkBcn, outbound: [{ ...krkBcn.outbound[0], toIata: 'LIS', arriveTz: 'Europe/Lisbon' }] };
    expect(tripName(toLisbon)).toBe('Kraków → Lisbon');
  });

  it('is what the organizer typed, even when the flights change or it is empty', () => {
    expect(tripName({ ...krkBcn, name: 'Majówka' })).toBe('Majówka');
    expect(tripName({ ...krkBcn, name: '' })).toBe('');
  });
});

describe('withCompanionCount', () => {
  it('adds an empty friend per companion', () => {
    const draft = withCompanionCount(emptyDraft(), 3);
    expect(draft.companionCount).toBe(3);
    expect(draft.friends).toEqual([emptyFriend(), emptyFriend(), emptyFriend()]);
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

  it('keeps the code state of a friend when the count changes (friend-invite)', () => {
    const three = withCompanionCount(emptyDraft(), 3);
    three.friends[0] = withFoundFriend(emptyFriend(), '5ZMRX8', { username: 'ola_b', interests: ['museums'] });
    three.friends[1] = withCodeText(emptyFriend(), 'K7PQ');
    const two = withCompanionCount(three, 2);
    expect(two.friends[0]).toEqual({ displayName: 'ola_b', interests: ['museums'], friendCode: '5ZMRX8', codeText: '5ZMRX8' });
    expect(two.friends[1].codeText).toBe('K7PQ');
    expect(withCompanionCount(two, 3).friends[2]).toEqual(emptyFriend());
  });
});

describe('friend code state', () => {
  const OLA = { username: 'ola_b', interests: ['museums' as const, 'beaches' as const] };

  it('an empty friend has no name, no interests and no code', () => {
    expect(emptyFriend()).toEqual({ displayName: '', interests: [], friendCode: null, codeText: '' });
  });

  it('withFoundFriend takes the nick and the interests of the account and remembers the code', () => {
    const typed = { ...withCodeText(emptyFriend(), '5ZMRX8'), displayName: 'Ola z pracy', interests: ['cycling' as const] };
    expect(withFoundFriend(typed, '5ZMRX8', OLA)).toEqual({
      displayName: 'ola_b',
      interests: ['museums', 'beaches'],
      friendCode: '5ZMRX8',
      codeText: '5ZMRX8',
    });
  });

  it('editing the code of a found friend returns an empty manual card (D9)', () => {
    const found = withFoundFriend(emptyFriend(), '5ZMRX8', OLA);
    expect(withCodeText(found, '5ZMRX')).toEqual({ displayName: '', interests: [], friendCode: null, codeText: '5ZMRX' });
    expect(withCodeText(found, '')).toEqual(emptyFriend());
  });

  it('editing the code of a friend that was not found keeps the typed name and interests (D9)', () => {
    const manual = { ...emptyFriend(), displayName: 'Kasia', interests: ['beaches' as const], codeText: 'ABCDEF' };
    expect(withCodeText(manual, 'ABCDE')).toEqual({ displayName: 'Kasia', interests: ['beaches'], friendCode: null, codeText: 'ABCDE' });
  });

  it('a code is unresolved when something is typed in it and no friend was found for it (D13)', () => {
    expect(hasUnresolvedCode(emptyFriend())).toBe(false);
    expect(hasUnresolvedCode(withCodeText(emptyFriend(), '  '))).toBe(false);
    expect(hasUnresolvedCode(withCodeText(emptyFriend(), 'AB'))).toBe(true);
    expect(hasUnresolvedCode(withCodeText(emptyFriend(), 'ABCDEF'))).toBe(true);
    expect(hasUnresolvedCode(withFoundFriend(emptyFriend(), '5ZMRX8', OLA))).toBe(false);
    // A friend written the way older code did (no code fields at all) has nothing unresolved.
    expect(hasUnresolvedCode({ displayName: 'Kasia', interests: [] })).toBe(false);
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
    expect(input.details).toEqual({ name: 'Warsaw → Bangkok', coverImageUri: DEFAULT_COVER });
  });

  it('sends the code of a linked friend and leaves the typed code text out', () => {
    const linked = withFoundFriend(emptyFriend(), '5ZMRX8', { username: 'ola_b', interests: ['museums'] });
    const draft = { ...emptyDraft(), companionCount: 2, friends: [linked, withCodeText(emptyFriend(), 'AB')] };
    expect(toCreateTripInput(draft, 'pl').friends).toEqual({
      friends: [
        { displayName: 'ola_b', interests: ['museums'], friendCode: '5ZMRX8' },
        { displayName: '', interests: [], friendCode: null },
      ],
    });
  });

  it('sends the typed name and the chosen cover', () => {
    const draft = { ...emptyDraft(), name: 'Tajlandia', coverImageUri: 'file:///cache/cover.jpg' as const };
    expect(toCreateTripInput(draft, 'pl').details).toEqual({ name: 'Tajlandia', coverImageUri: 'file:///cache/cover.jpg' });
  });

  it('always sends a cover: the default when none was chosen', () => {
    expect(toCreateTripInput(emptyDraft(), 'pl').details.coverImageUri).toBe(DEFAULT_COVER);
  });
});

describe('toCreateTripInput with an amount that does not parse', () => {
  it('uses 0, which the schema rejects', () => {
    const draft = { ...emptyDraft(), budget: { amountText: 'abc', currency: '' } };
    expect(toCreateTripInput(draft, 'pl').budget.budgetPerPerson.amountMinor).toBe(0);
  });
});

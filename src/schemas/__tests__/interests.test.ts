import { INTEREST_GROUPS, InterestGroupSchema, InterestTagSchema } from '@/schemas';

describe('InterestTag', () => {
  it('has 17 interests', () => {
    expect(InterestTagSchema.options).toHaveLength(17);
  });

  it('rejects an unknown interest', () => {
    expect(InterestTagSchema.safeParse('knitting').success).toBe(false);
  });
});

describe('INTEREST_GROUPS', () => {
  it('has the 6 groups in display order', () => {
    expect(Object.keys(INTEREST_GROUPS)).toEqual(InterestGroupSchema.options);
    expect(InterestGroupSchema.options).toEqual(['fun', 'nature', 'culture', 'food', 'active', 'relax']);
  });

  it('puts every interest in exactly one group', () => {
    const grouped = Object.values(INTEREST_GROUPS).flat();
    expect([...grouped].sort()).toEqual([...InterestTagSchema.options].sort());
  });

  it('keeps the examples Kacper gave in the right groups', () => {
    expect(INTEREST_GROUPS.fun).toEqual(expect.arrayContaining(['nightlife', 'theme_parks']));
    expect(INTEREST_GROUPS.culture).toContain('museums');
  });
});

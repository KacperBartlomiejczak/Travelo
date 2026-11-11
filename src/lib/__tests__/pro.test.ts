import { hasPro, PRO_ENTITLEMENT } from '../pro';
import { customerInfoFixture } from '@/test/mock-purchases';

describe('hasPro', () => {
  it('names the entitlement configured in RevenueCat', () => {
    expect(PRO_ENTITLEMENT).toBe('travelo_pro');
  });

  it('is true when travelo_pro is active', () => {
    expect(hasPro(customerInfoFixture({ pro: true }))).toBe(true);
  });

  it('is false without entitlements', () => {
    expect(hasPro(customerInfoFixture({ pro: false }))).toBe(false);
  });

  it('is false for another active entitlement only', () => {
    const info = customerInfoFixture({ pro: false });
    const other = customerInfoFixture({ pro: true }).entitlements.active[PRO_ENTITLEMENT];
    expect(hasPro({ ...info, entitlements: { ...info.entitlements, active: { other } } })).toBe(false);
  });

  it('is false when travelo_pro is only in entitlements.all (expired)', () => {
    const info = customerInfoFixture({ pro: true });
    expect(hasPro({ ...info, entitlements: { ...info.entitlements, all: info.entitlements.active, active: {} } })).toBe(false);
  });
});

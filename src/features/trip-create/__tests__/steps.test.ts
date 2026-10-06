import { nextStep, stepRoute, wizardSteps } from '@/features/trip-create/steps';

describe('wizardSteps', () => {
  it('has four steps when friends fly along', () => {
    expect(wizardSteps(2)).toEqual(['flights', 'friends', 'budget', 'summary']);
  });

  it('skips the friends step when the organizer travels alone', () => {
    expect(wizardSteps(0)).toEqual(['flights', 'budget', 'summary']);
  });
});

describe('nextStep', () => {
  it('goes from flights to friends, or straight to budget when alone', () => {
    expect(nextStep('flights', 2)).toBe('friends');
    expect(nextStep('flights', 0)).toBe('budget');
  });

  it('ends at the summary', () => {
    expect(nextStep('budget', 0)).toBe('summary');
    expect(nextStep('summary', 3)).toBeNull();
  });
});

describe('stepRoute', () => {
  it('maps steps to routes under /trips/new', () => {
    expect(stepRoute('flights')).toBe('/trips/new');
    expect(stepRoute('friends')).toBe('/trips/new/friends');
    expect(stepRoute('budget')).toBe('/trips/new/budget');
    expect(stepRoute('summary')).toBe('/trips/new/summary');
  });
});

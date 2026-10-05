export type WizardStep = 'flights' | 'friends' | 'budget' | 'summary';

/** Steps in order; friends are skipped when the organizer travels alone. */
export function wizardSteps(companionCount: number): WizardStep[] {
  return companionCount > 0 ? ['flights', 'friends', 'budget', 'summary'] : ['flights', 'budget', 'summary'];
}

export function nextStep(step: WizardStep, companionCount: number): WizardStep | null {
  const steps = wizardSteps(companionCount);
  return steps[steps.indexOf(step) + 1] ?? null;
}

const ROUTES = {
  flights: '/trips/new',
  friends: '/trips/new/friends',
  budget: '/trips/new/budget',
  summary: '/trips/new/summary',
} as const;

export function stepRoute(step: WizardStep): (typeof ROUTES)[WizardStep] {
  return ROUTES[step];
}

import type { GeneratedPlan, PlanPersonRef, StoredPlanDay } from '../schemas/trip-plan.ts';

export type ValidatePlanResult = { ok: true; days: StoredPlanDay[] } | { ok: false; error: string };

// Filters the model output down to real candidates and maps person ids to stored refs.
export function validateGeneratedPlan(input: {
  plan: GeneratedPlan;
  placesByCity: Record<string, ReadonlySet<string>>;
  allowedCities: readonly string[];
  dates: readonly string[];
  refs: Record<string, PlanPersonRef>;
}): ValidatePlanResult {
  const { plan, placesByCity, allowedCities, dates, refs } = input;
  if (plan.days.length !== dates.length || plan.days.some((d, i) => d.date !== dates[i])) {
    return { ok: false, error: 'dates_mismatch' };
  }
  if (plan.days.some((d) => !allowedCities.includes(d.cityId))) return { ok: false, error: 'unknown_city' };

  const seen = new Set<string>();
  const days: StoredPlanDay[] = plan.days.map((day) => {
    // Safe: allowedCities was checked above, so cityId is a known key.
    const allowed = placesByCity[day.cityId];
    const items: StoredPlanDay['items'] = [];
    for (const item of day.items) {
      if (!allowed?.has(item.placeId) || seen.has(item.placeId)) continue;
      const forPeople = item.forPeople.flatMap((id) => (Object.hasOwn(refs, id) ? [refs[id]!] : []));
      if (forPeople.length === 0) continue;
      seen.add(item.placeId);
      items.push({ placeId: item.placeId, slot: item.slot, reason: item.reason, forPeople });
    }
    return { date: day.date, cityIata: day.cityId, items };
  });

  if (days.every((d) => d.items.length === 0)) return { ok: false, error: 'empty_plan' };
  return { ok: true, days };
}

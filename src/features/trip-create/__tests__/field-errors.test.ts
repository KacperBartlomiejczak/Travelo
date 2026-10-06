import { fieldErrors } from '@/features/trip-create/field-errors';
import { FlightsStepInputSchema } from '@/schemas';

describe('fieldErrors', () => {
  it('maps issues to dotted field paths with the first message per field', () => {
    const result = FlightsStepInputSchema.safeParse({
      outbound: [{ fromIata: '', departTz: '', toIata: 'BKK', arriveTz: 'Asia/Bangkok', departAt: '', arriveAt: '2026-11-03T05:00' }],
      return: [{ fromIata: 'BKK', departTz: 'Asia/Bangkok', toIata: 'WAW', arriveTz: 'Europe/Warsaw', departAt: '2026-11-15T09:00', arriveAt: '2026-11-15T17:00' }],
      companionCount: 0,
    });
    expect(fieldErrors(result)).toEqual({
      'outbound.0.fromIata': 'validation.airportRequired',
      'outbound.0.departTz': 'validation.airportRequired',
      'outbound.0.departAt': 'validation.dateTimeRequired',
    });
  });

  it('returns no errors for a valid result', () => {
    expect(fieldErrors({ success: true })).toEqual({});
  });
});

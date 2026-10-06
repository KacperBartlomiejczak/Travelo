import { deriveTripDates } from '@/lib/trip-dates';

const segment = (patch: object) => ({
  fromIata: 'WAW',
  departTz: 'Europe/Warsaw',
  toIata: 'BKK',
  arriveTz: 'Asia/Bangkok',
  departAt: '2026-11-02T10:00',
  arriveAt: '2026-11-03T05:00',
  ...patch,
});

describe('deriveTripDates', () => {
  it('starts on the local arrival date of the last outbound segment and ends on the return departure date', () => {
    const outbound = [segment({ toIata: 'DXB', arriveAt: '2026-11-02T18:30' }), segment({ fromIata: 'DXB', arriveAt: '2026-11-03T12:45' })];
    const back = [segment({ fromIata: 'BKK', departAt: '2026-11-15T23:50', arriveAt: '2026-11-16T06:00' })];
    expect(deriveTripDates({ outbound, return: back })).toEqual({ startDate: '2026-11-03', endDate: '2026-11-15' });
  });

  it('allows a trip that starts and ends on the same day', () => {
    const outbound = [segment({ arriveAt: '2026-11-03T05:00' })];
    const back = [segment({ departAt: '2026-11-03T22:00', arriveAt: '2026-11-04T06:00' })];
    expect(deriveTripDates({ outbound, return: back })).toEqual({ startDate: '2026-11-03', endDate: '2026-11-03' });
  });
});

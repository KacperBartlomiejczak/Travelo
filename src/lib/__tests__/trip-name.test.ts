import { AIRPORTS } from '@/data/airports';
import { defaultTripName } from '@/lib/trip-name';

const city = (iata: string) => AIRPORTS.find((airport) => airport.iata === iata)?.city;

describe('defaultTripName', () => {
  it('joins the departure city and the destination city with an arrow (D3)', () => {
    expect(city('KRK')).toBe('Kraków');
    expect(defaultTripName([{ fromIata: 'KRK', toIata: 'BCN' }])).toBe(`Kraków → ${city('BCN')}`);
  });

  it('uses the first departure and the last arrival when there are layovers', () => {
    const outbound = [
      { fromIata: 'WAW', toIata: 'DXB' },
      { fromIata: 'DXB', toIata: 'BKK' },
    ];
    expect(defaultTripName(outbound)).toBe(`${city('WAW')} → ${city('BKK')}`);
  });

  it('falls back to the IATA code for an airport that is not in the list', () => {
    expect(defaultTripName([{ fromIata: 'KRK', toIata: 'ZZZ' }])).toBe('Kraków → ZZZ');
  });

  it('is empty while either end has no airport yet', () => {
    expect(defaultTripName([{ fromIata: '', toIata: '' }])).toBe('');
    expect(defaultTripName([{ fromIata: 'KRK', toIata: '' }])).toBe('');
    expect(defaultTripName([{ fromIata: '', toIata: 'BCN' }])).toBe('');
  });
});

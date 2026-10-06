import { AIRPORTS } from '@/data/airports';
import { AirportSchema } from '@/schemas';

describe('AIRPORTS', () => {
  it('contains a few thousand airports with scheduled service', () => {
    expect(AIRPORTS.length).toBeGreaterThan(1500);
  });

  it('every row parses with AirportSchema', () => {
    const invalid = AIRPORTS.filter((airport) => !AirportSchema.safeParse(airport).success);
    expect(invalid).toEqual([]);
  });

  it('has unique IATA codes', () => {
    const codes = AIRPORTS.map((airport) => airport.iata);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('marks large airports (D20)', () => {
    const large = (iata: string) => AIRPORTS.find((airport) => airport.iata === iata)?.large;
    expect(large('LHR')).toBe(true);
    expect(large('BCN')).toBe(true);
    expect(large('SZY')).toBe(false); // Olsztyn-Mazury
  });

  it.each([
    ['WAW', 'Warsaw', 'PL', 'Europe/Warsaw', 'PLN'],
    ['KRK', 'Kraków', 'PL', 'Europe/Warsaw', 'PLN'],
    ['BCN', 'Barcelona', 'ES', 'Europe/Madrid', 'EUR'],
    ['DXB', 'Dubai', 'AE', 'Asia/Dubai', 'AED'],
    ['JFK', 'New York', 'US', 'America/New_York', 'USD'],
    ['BKK', 'Bangkok', 'TH', 'Asia/Bangkok', 'THB'],
    ['LCJ', 'Łódź', 'PL', 'Europe/Warsaw', 'PLN'],
    ['WRO', 'Wrocław', 'PL', 'Europe/Warsaw', 'PLN'],
    // Wrong in a source (reused IATA code or a zone across a border) — must be the airport's own country.
    ['AVR', 'Amravati', 'IN', 'Asia/Kolkata', 'INR'],
    ['MLN', 'Melilla', 'ES', 'Africa/Ceuta', 'EUR'],
    ['ARI', 'Arica', 'CL', 'America/Santiago', 'CLP'],
    ['ETM', 'Eilat', 'IL', 'Asia/Jerusalem', 'ILS'],
    ['GVA', 'Geneva', 'CH', 'Europe/Zurich', 'CHF'],
    // First listed currency is not the one people pay with.
    ['SAL', 'San Salvador', 'SV', 'America/El_Salvador', 'USD'],
    ['PTY', 'Panama City', 'PA', 'America/Panama', 'USD'],
  ])('knows %s', (iata, city, countryCode, timezone, currency) => {
    expect(AIRPORTS.find((airport) => airport.iata === iata)).toEqual(
      expect.objectContaining({ city: expect.stringContaining(city), countryCode, timezone, currency }),
    );
  });
});

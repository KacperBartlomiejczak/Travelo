import { defaultCurrency, destinationName, findAirport, searchAirports } from '@/lib/airport-search';
import type { Airport } from '@/schemas';

const airport = (iata: string, city: string, name: string, countryCode = 'XX', large = false): Airport => ({
  iata,
  city,
  name,
  countryCode,
  timezone: 'UTC',
  currency: 'EUR',
  large,
});

const AIRPORTS: Airport[] = [
  airport('BCN', 'Barcelona', 'Josep Tarradellas Barcelona-El Prat Airport', 'ES'),
  airport('BLA', 'Barcelona', 'General José Antonio Anzoátegui International Airport', 'VE'),
  airport('KRK', 'Kraków', 'Kraków John Paul II International Airport', 'PL'),
  airport('LCJ', 'Łódź', 'Łódź Władysław Reymont Airport', 'PL'),
  airport('BAR', 'Qionghai', 'Qionghai Bo’ao Airport', 'CN'),
  airport('WAW', 'Warsaw', 'Warsaw Chopin Airport', 'PL'),
  airport('WMI', 'Warsaw', 'Warsaw Modlin Airport', 'PL'),
];

const codes = (query: string, limit?: number) => searchAirports(query, AIRPORTS, limit).map((a) => a.iata);

describe('searchAirports', () => {
  it('puts an exact IATA match first', () => {
    expect(codes('bar')[0]).toBe('BAR');
    expect(codes('BCN')).toEqual(['BCN']);
  });

  it('finds airports by the start of the city', () => {
    expect(codes('barc')).toEqual(['BCN', 'BLA']);
  });

  it('ignores diacritics and Polish letters', () => {
    expect(codes('krakow')).toEqual(['KRK']);
    expect(codes('lodz')).toEqual(['LCJ']);
  });

  it('finds airports by a word in the name', () => {
    expect(codes('modlin')).toEqual(['WMI']);
    expect(codes('chopin')).toEqual(['WAW']);
  });

  it('ranks city matches before name matches', () => {
    expect(codes('warsaw')).toEqual(['WAW', 'WMI']);
  });

  it('puts large airports first within the same match (D20)', () => {
    const list = [
      airport('GGG', 'Longview', 'East Texas Regional Airport', 'US'),
      airport('LHR', 'London', 'London Heathrow Airport', 'GB', true),
      airport('LCY', 'London', 'London City Airport', 'GB'),
    ];
    expect(searchAirports('lon', list).map((a) => a.iata)).toEqual(['LHR', 'GGG', 'LCY']);
  });

  it('still puts an exact code match before a large airport', () => {
    const list = [airport('BCN', 'Barcelona', 'El Prat', 'ES', true), airport('BAR', 'Qionghai', 'Bo’ao', 'CN')];
    expect(searchAirports('bar', list).map((a) => a.iata)).toEqual(['BAR', 'BCN']);
  });

  it('ranks well-known airports high in the real list', () => {
    // Before D20, "lon" listed Heathrow 7th and "bar" listed Barcelona 7th.
    expect(searchAirports('lon').slice(0, 5).map((a) => a.iata)).toEqual(expect.arrayContaining(['LGW', 'LHR']));
    expect(searchAirports('bar').slice(0, 4).map((a) => a.iata)).toContain('BCN');
    expect(searchAirports('par')[0].city).toBe('Paris');
  });

  it('returns nothing for an empty query', () => {
    expect(codes('')).toEqual([]);
    expect(codes('   ')).toEqual([]);
  });

  it('returns at most `limit` results (8 by default)', () => {
    const many = Array.from({ length: 12 }, (_, i) => airport(`A${String.fromCharCode(65 + i)}A`, 'Springfield', 'Airport'));
    expect(searchAirports('spring', many)).toHaveLength(8);
    expect(codes('a', 2)).toHaveLength(2);
  });
});

describe('findAirport', () => {
  it('finds an airport by IATA code in the bundled list', () => {
    expect(findAirport('BCN')?.city).toBe('Barcelona');
    expect(findAirport('XXX')).toBeUndefined();
  });
});

describe('defaultCurrency', () => {
  it("returns the destination country's currency (D8)", () => {
    expect(defaultCurrency('BCN')).toBe('EUR');
    expect(defaultCurrency('BKK')).toBe('THB');
  });

  it('returns undefined for an unknown airport', () => {
    expect(defaultCurrency('XXX')).toBeUndefined();
  });
});

describe('destinationName', () => {
  it('names a trip after the destination city, or its code when unknown (D13)', () => {
    expect(destinationName('BKK')).toBe('Bangkok');
    expect(destinationName('ZZZ')).toBe('ZZZ');
  });
});

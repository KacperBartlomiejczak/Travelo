// Generates src/data/airports.json — dev-time only, the app never downloads anything.
// Run: node scripts/build-airports.mjs
//
// Sources (see prompts/trip-create-wizard/plan.md, Q12):
// - OurAirports airports.csv (public domain): type, scheduled service, IATA, name, city, country
// - mwgg/Airports airports.json (MIT): IANA time zone per airport
// - datasets/country-codes country-codes.csv (PDDL): country → ISO 4217 currency
// - the system tz database's zone.tab (public domain): which zones belong to which country
import { readFile, writeFile } from 'node:fs/promises';

const SOURCES = {
  airports: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
  timezones: 'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json',
  countries: 'https://raw.githubusercontent.com/datasets/country-codes/main/data/country-codes.csv',
};
const OUTPUT = new URL('../src/data/airports.json', import.meta.url);
const KEPT_TYPES = new Set(['large_airport', 'medium_airport']);
// Gaps in the sources: country-codes has no currency for Türkiye; Kosovo is not in ISO 3166 (uses EUR).
// First listed currency is not the one in everyday use: SV and PA use USD, BT uses BTN.
const CURRENCY_OVERRIDES = { TR: 'TRY', XK: 'EUR', SV: 'USD', PA: 'USD', BT: 'BTN' };
// Served city where neither source names it well (the trip is named after the city, D13).
const CITY_OVERRIDES = {
  // Suburb or village names in OurAirports that mwgg does not fix.
  KRK: 'Kraków',
  IST: 'Istanbul',
  SAW: 'Istanbul',
  WMI: 'Warsaw',
  BGY: 'Bergamo',
  MXP: 'Milan',
  // Large airports where mwgg's city is odd, outdated or misspelled (reviewed 2026-10-04).
  AAE: 'Annaba',
  AKX: 'Aktobe',
  ATZ: 'Asyut',
  AWA: 'Hawassa',
  BEG: 'Belgrade',
  BFN: 'Bloemfontein',
  BKO: 'Bamako',
  BLR: 'Bengaluru',
  BWA: 'Bhairahawa',
  CIA: 'Rome',
  CNN: 'Kannur',
  COK: 'Kochi',
  CTS: 'Sapporo',
  CVG: 'Cincinnati',
  CXI: 'Kiritimati',
  DRP: 'Legazpi',
  DSS: 'Dakar',
  DVO: 'Davao',
  DWC: 'Dubai',
  DYG: 'Zhangjiajie',
  EZE: 'Buenos Aires',
  FRA: 'Frankfurt',
  FSC: 'Figari',
  GCM: 'George Town',
  GOI: 'Goa',
  GXF: 'Seiyun',
  ILO: 'Iloilo',
  ISK: 'Nashik',
  IXE: 'Mangaluru',
  JHB: 'Johor Bahru',
  KHH: 'Kaohsiung',
  KOS: 'Sihanoukville',
  KQT: 'Bokhtar',
  KRS: 'Kristiansand',
  KZO: 'Kyzylorda',
  LAE: 'Lae',
  LBD: 'Khujand',
  LCA: 'Larnaca',
  MDE: 'Medellín',
  MFM: 'Macau',
  MLA: 'Valletta',
  MQP: 'Mbombela',
  MUH: 'Marsa Matruh',
  MZG: 'Magong',
  NAG: 'Nagpur',
  NAT: 'Natal',
  NLU: 'Mexico City',
  NOC: 'Knock',
  NYT: 'Naypyidaw',
  OKJ: 'Okayama',
  PBM: 'Paramaribo',
  PDG: 'Padang',
  PEV: 'Pécs',
  PIE: 'St. Petersburg',
  PLZ: 'Gqeberha',
  PPK: 'Petropavl',
  PPS: 'Puerto Princesa',
  PQC: 'Phu Quoc',
  PTG: 'Polokwane',
  PTY: 'Panama City',
  PTP: 'Pointe-à-Pitre',
  PZO: 'Ciudad Guayana',
  RHO: 'Rhodes',
  RIY: 'Mukalla',
  RMQ: 'Taichung',
  RTB: 'Roatán',
  RUN: 'Saint-Denis',
  RZE: 'Rzeszów',
  SAL: 'San Salvador',
  SAP: 'San Pedro Sula',
  SEZ: 'Victoria',
  SOC: 'Surakarta',
  SVD: 'Kingstown',
  SVQ: 'Seville',
  SXM: 'Sint Maarten',
  SZZ: 'Szczecin',
  TAZ: 'Daşoguz',
  TJU: 'Kulob',
  TNN: 'Tainan',
  TRF: 'Sandefjord',
  TRN: 'Turin',
  TRV: 'Thiruvananthapuram',
  TRZ: 'Tiruchirappalli',
  TSA: 'Taipei',
  UPG: 'Makassar',
  WTB: 'Toowoomba',
  XIY: "Xi'an",
  ZAM: 'Zamboanga',
  ZIA: 'Moscow',
  ZNZ: 'Zanzibar',
  ZSE: 'Saint-Pierre',
};

// NFD does not decompose these letters, so they are mapped by hand (Łódź → lodz).
const LETTERS = { ł: 'l', ø: 'o', ı: 'i', ð: 'd', đ: 'd', æ: 'ae', œ: 'oe', ß: 'ss', þ: 'th' };
const fold = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łøıðđæœßþ]/g, (letter) => LETTERS[letter]);
// "Paris (Roissy-en-France, Val-d'Oise)" → "Paris", "London, Essex" → "London", "Bordeaux/Merignac" → "Bordeaux",
// "Denpasar-Bali Island" → "Denpasar", "Lanzarote Island" → "Lanzarote".
const cleanCity = (text) =>
  text
    .split(/[,(/]/)[0]
    .replace(/(-[^-]*)? Island$/, '')
    .trim();

// OurAirports gives the municipality (with diacritics, but sometimes the village: KRK → Balice);
// mwgg gives the served city (KRK → Krakow) without diacritics. Use mwgg's city, spelled like
// OurAirports when both agree.
function pickCity(iata, municipality, mwggCity) {
  if (CITY_OVERRIDES[iata]) return CITY_OVERRIDES[iata];
  const cleaned = cleanCity(municipality);
  if (!mwggCity || fold(cleanCity(mwggCity)) === fold(cleaned)) return cleaned;
  return cleanCity(mwggCity);
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

// Minimal RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) rows.push([...row, field]);
  const [header, ...body] = rows;
  return body.filter((cells) => cells.length === header.length).map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i]])));
}

const [airportsCsv, timezonesJson, countriesCsv, zoneTab] = await Promise.all([
  download(SOURCES.airports),
  download(SOURCES.timezones),
  download(SOURCES.countries),
  readFile('/usr/share/zoneinfo/zone.tab', 'utf8'),
]);

// mwgg rows by ICAO, and by IATA as a fallback. IATA codes get reused, so a fallback row is
// only trusted when it is in the same country.
const mwggByIcao = new Map();
const mwggByIata = new Map();
for (const airport of Object.values(JSON.parse(timezonesJson))) {
  if (airport.icao) mwggByIcao.set(airport.icao, airport);
  if (airport.iata) mwggByIata.set(airport.iata, airport);
}
function findMwgg(row) {
  const byIcao = mwggByIcao.get(row.icao_code) ?? mwggByIcao.get(row.ident) ?? mwggByIcao.get(row.gps_code);
  const candidate = byIcao ?? mwggByIata.get(row.iata_code);
  return candidate?.country === row.iso_country ? candidate : undefined;
}

const zonesByCountry = new Map();
const countryByZone = new Map();
for (const line of zoneTab.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [country, , zone] = line.split('\t');
  countryByZone.set(zone, country);
  zonesByCountry.set(country, [...(zonesByCountry.get(country) ?? []), zone]);
}

// mwgg sometimes puts an airport in a neighbouring country's zone (GVA → Europe/Paris, MLN →
// Africa/Casablanca). Keep its zone only if it belongs to the airport's country; otherwise use the
// country's only zone, or a hand-checked override for countries with several zones.
const TIMEZONE_OVERRIDES = {
  ARI: 'America/Santiago', // Arica
  GOM: 'Africa/Lubumbashi', // Goma
  IGU: 'America/Sao_Paulo', // Foz do Iguaçu
  LMN: 'Asia/Kuching', // Limbang, Sarawak
  MLN: 'Africa/Ceuta', // Melilla
  NRN: 'Europe/Berlin', // Weeze
  PMG: 'America/Campo_Grande', // Ponta Porã
  PRN: 'Europe/Belgrade', // Pristina (Kosovo is not in zone.tab)
  TBT: 'America/Manaus', // Tabatinga
  TIJ: 'America/Tijuana', // Tijuana
  YAM: 'America/Toronto', // Sault Ste. Marie
  YXX: 'America/Vancouver', // Abbotsford
};
const needsTimezoneOverride = [];
function pickTimezone(iata, country, candidate) {
  if (TIMEZONE_OVERRIDES[iata]) return TIMEZONE_OVERRIDES[iata];
  if (candidate && countryByZone.get(candidate) === country) return candidate;
  const zones = zonesByCountry.get(country) ?? [];
  if (zones.length === 1) return zones[0];
  if (candidate) needsTimezoneOverride.push(`${iata}(${country}, mwgg: ${candidate}, options: ${zones.join(' ')})`);
  return undefined;
}

const currencyByCountry = new Map(Object.entries(CURRENCY_OVERRIDES));
for (const country of parseCsv(countriesCsv)) {
  const code = country['ISO3166-1-Alpha-2'];
  const currency = country['ISO4217-currency_alphabetic_code']?.split(',')[0];
  if (code && /^[A-Z]{3}$/.test(currency ?? '') && !currencyByCountry.has(code)) currencyByCountry.set(code, currency);
}

const byIata = new Map();
const skipped = { noTimezone: [], noCurrency: [], noCity: [] };
for (const row of parseCsv(airportsCsv)) {
  const iata = row.iata_code;
  if (!KEPT_TYPES.has(row.type) || row.scheduled_service !== 'yes' || !/^[A-Z]{3}$/.test(iata)) continue;
  if (!row.municipality) {
    skipped.noCity.push(iata);
    continue;
  }
  const mwgg = findMwgg(row);
  const timezone = pickTimezone(iata, row.iso_country, mwgg?.tz || undefined);
  const currency = currencyByCountry.get(row.iso_country);
  if (!timezone) {
    skipped.noTimezone.push(iata);
    continue;
  }
  if (!currency) {
    skipped.noCurrency.push(`${iata}(${row.iso_country})`);
    continue;
  }
  const existing = byIata.get(iata);
  // Two rows with the same IATA code: prefer the large airport.
  if (existing && !(row.type === 'large_airport' && existing.type !== 'large_airport')) continue;
  byIata.set(iata, {
    type: row.type,
    airport: {
      iata,
      name: row.name,
      city: pickCity(iata, row.municipality, mwgg?.city || undefined),
      countryCode: row.iso_country,
      timezone,
      currency,
      large: row.type === 'large_airport',
    },
  });
}

const airports = [...byIata.values()].map((entry) => entry.airport).sort((a, b) => a.iata.localeCompare(b.iata));
// One airport per line keeps git diffs readable.
await writeFile(OUTPUT, `[\n${airports.map((airport) => JSON.stringify(airport)).join(',\n')}\n]\n`);

console.log(`Wrote ${airports.length} airports to src/data/airports.json`);
console.log(`Skipped without time zone (${skipped.noTimezone.length}): ${skipped.noTimezone.join(' ')}`);
const large = [...byIata.values()].filter((entry) => entry.type === 'large_airport');
console.log(`Large airports (${large.length}) — check city names:`);
console.log(large.map(({ airport }) => `${airport.iata}=${airport.city}`).join(' '));
console.log(`Skipped without city (${skipped.noCity.length}): ${skipped.noCity.join(' ')}`);
if (needsTimezoneOverride.length > 0) {
  console.log(`Need a TIMEZONE_OVERRIDES entry (${needsTimezoneOverride.length}):\n${needsTimezoneOverride.join('\n')}`);
}
console.log(`Skipped without currency (${skipped.noCurrency.length}): ${skipped.noCurrency.join(' ')}`);

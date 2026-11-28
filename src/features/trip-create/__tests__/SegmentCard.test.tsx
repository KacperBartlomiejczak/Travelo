import { render } from '@testing-library/react-native';

import { SegmentCard } from '../SegmentCard';
import type { SegmentDraft } from '../draft';

const mockDateTimeField = jest.fn((_props: { label: string; suggested?: string }) => null);
jest.mock('@/components/DateTimeField', () => ({
  DateTimeField: (props: { label: string; suggested?: string }) => mockDateTimeField(props),
}));
jest.mock('@/components/AirportField', () => ({ AirportField: () => null }));

const base: SegmentDraft = { key: 'a', fromIata: '', toIata: '', departTz: '', arriveTz: '', departAt: '', arriveAt: '' };

async function suggestions(segment: SegmentDraft, suggestedDeparture?: string) {
  mockDateTimeField.mockClear();
  await render(<SegmentCard title="Lot" segment={segment} onChange={jest.fn()} errors={{}} suggestedDeparture={suggestedDeparture} />);
  const byLabel = (label: string) => mockDateTimeField.mock.calls.find(([props]) => props.label === label)?.[0].suggested;
  return { departure: byLabel('newTrip.flights.departAt'), arrival: byLabel('newTrip.flights.arriveAt') };
}

describe('SegmentCard time suggestions', () => {
  it('opens both pickers on the ticket date when the ticket gave a date but no times', async () => {
    const result = await suggestions({ ...base, suggestedDate: '2026-12-05' }, '2026-12-01T09:00');
    expect(result).toEqual({ departure: '2026-12-05T12:00', arrival: '2026-12-05T12:00' });
  });

  it('suggests the arrival from the departure once it is set', async () => {
    const result = await suggestions({ ...base, suggestedDate: '2026-12-05', departAt: '2026-12-05T08:30' });
    expect(result.arrival).toBe('2026-12-05T08:30');
  });

  it('keeps the previous segment arrival as the departure suggestion without a ticket date', async () => {
    const result = await suggestions(base, '2026-12-01T09:00');
    expect(result).toEqual({ departure: '2026-12-01T09:00', arrival: undefined });
  });
});

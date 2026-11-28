import type { ParsedTicket } from '../../schemas/ticket';
import { buildTicketUserContent, TICKET_SYSTEM_INSTRUCTION } from '../ticket-prompt';

describe('TICKET_SYSTEM_INSTRUCTION', () => {
  it('treats the document as untrusted and tells the model to ignore instructions in it', () => {
    expect(TICKET_SYSTEM_INSTRUCTION).toMatch(/untrusted/i);
    expect(TICKET_SYSTEM_INSTRUCTION).toMatch(/ignore any instructions/i);
  });
  it('forbids names and booking codes and allows isTicket false', () => {
    expect(TICKET_SYSTEM_INSTRUCTION).toMatch(/never output .*names/i);
    expect(TICKET_SYSTEM_INSTRUCTION).toMatch(/isTicket/);
  });
  it('contains no user data', () => {
    expect(TICKET_SYSTEM_INSTRUCTION).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(TICKET_SYSTEM_INSTRUCTION).not.toMatch(/\{/);
  });
});

describe('buildTicketUserContent', () => {
  it('carries only the known fields', () => {
    const parsed: ParsedTicket = {
      segments: [
        {
          direction: 'outbound',
          fromIata: 'WAW',
          toIata: 'BCN',
          flightNumber: null,
          flightDate: '2026-12-05',
          departAt: null,
          arriveAt: null,
        },
      ],
    };
    const content = buildTicketUserContent(parsed);
    expect(content).toContain('"fromIata":"WAW"');
    expect(content).toContain('"flightDate":"2026-12-05"');
    expect(content).not.toContain('flightNumber');
    expect(content).not.toContain('departAt');
  });
  it('has no data for an empty result', () => {
    expect(buildTicketUserContent({ segments: [] })).not.toContain('{');
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { extractTicket, NotATicketError, TicketImportError, TicketLimitError, UnsupportedTicketFileError } from '@/data/ticket-import';
import { useExtractTicket } from '@/hooks/useExtractTicket';
import type { ExtractTicketRequest, ExtractTicketResponse } from '@/schemas';

jest.mock('@/data/supabase', () => ({ supabase: {} }));
jest.mock('@/data/ticket-import', () => ({
  ...jest.requireActual('@/data/ticket-import'),
  extractTicket: jest.fn(),
}));

const request: ExtractTicketRequest = { mimeType: 'application/pdf', dataBase64: 'JVBERi0=' };
const mocked = jest.mocked(extractTicket);

function setup() {
  // A client with retries on proves the hook opts out itself.
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 0 } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeEach(() => mocked.mockReset());

describe('useExtractTicket', () => {
  it('calls extractTicket and exposes the result', async () => {
    const response = { segments: [] } as unknown as ExtractTicketResponse;
    mocked.mockResolvedValue(response);
    const { result } = await renderHook(() => useExtractTicket(), { wrapper: setup() });
    await act(async () => {
      await result.current.mutateAsync(request);
    });
    expect(mocked).toHaveBeenCalledWith(request, expect.anything());
    await waitFor(() => expect(result.current.data).toBe(response));
  });

  it('exposes the error', async () => {
    mocked.mockRejectedValue(new NotATicketError('x'));
    const { result } = await renderHook(() => useExtractTicket(), { wrapper: setup() });
    await act(async () => {
      result.current.mutate(request);
    });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(NotATicketError));
  });

  it.each([
    ['NotATicketError', () => new NotATicketError('x')],
    ['TicketLimitError', () => new TicketLimitError('x')],
    ['UnsupportedTicketFileError', () => new UnsupportedTicketFileError('unsupported_file', 'x')],
    ['TicketImportError', () => new TicketImportError('failed', 'x')],
  ])('does not retry %s', async (_, make) => {
    mocked.mockRejectedValue(make());
    const { result } = await renderHook(() => useExtractTicket(), { wrapper: setup() });
    await act(async () => {
      result.current.mutate(request);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocked).toHaveBeenCalledTimes(1);
  });
});

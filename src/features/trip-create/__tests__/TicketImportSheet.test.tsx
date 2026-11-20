import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ServerUnreachableError } from '@/data/errors';
import { extractTicket, NotATicketError, TicketImportError, TicketLimitError, UnsupportedTicketFileError } from '@/data/ticket-import';
import { pickTicketPdf, pickTicketPhoto } from '@/features/trip-create/ticket-pick';
import i18n from '@/i18n';
import { useIsOffline } from '@/providers/BudgetSync';
import type { ExtractTicketResponse } from '@/schemas';

import { TicketImportSheet } from '../TicketImportSheet';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/data/supabase', () => ({ supabase: {} }));
jest.mock('@/data/ticket-import', () => ({
  ...jest.requireActual('@/data/ticket-import'),
  extractTicket: jest.fn(),
}));
jest.mock('@/features/trip-create/ticket-pick', () => ({
  pickTicketPdf: jest.fn(),
  pickTicketPhoto: jest.fn(),
}));
jest.mock('@/providers/BudgetSync', () => ({
  ...jest.requireActual('@/providers/BudgetSync'),
  useIsOffline: jest.fn(),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const request = {
  mimeType: 'application/pdf' as const,
  dataBase64: 'JVBERi0=',
};
const response: ExtractTicketResponse = {
  segments: [
    {
      direction: 'outbound',
      fromIata: 'WAW',
      toIata: 'BKK',
      flightNumber: 'LO123',
      flightDate: '2026-12-01',
      departAt: '2026-12-01T10:00',
      arriveAt: '2026-12-02T05:00',
    },
  ],
  source: 'parser',
  complete: true,
  remainingToday: 5,
};

const onClose = jest.fn();
const onScan = jest.fn();
const onImported = jest.fn();

async function renderSheet() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={client}>
        <TicketImportSheet visible onClose={onClose} onScan={onScan} onImported={onImported} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

async function toConsent() {
  await fireEvent.press(screen.getByRole('button', { name: 'Wczytaj z pliku' }));
}
async function accept() {
  await fireEvent.press(screen.getByRole('checkbox', { name: /Rozumiem i akceptuję/ }));
}
async function send() {
  await fireEvent.press(screen.getByRole('button', { name: 'Wyślij' }));
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(useIsOffline).mockReturnValue(false);
  jest.mocked(pickTicketPdf).mockResolvedValue(request);
  jest.mocked(pickTicketPhoto).mockResolvedValue({ mimeType: 'image/jpeg', dataBase64: '/9j/' });
  await i18n.changeLanguage('pl');
});

describe('TicketImportSheet', () => {
  it('offers the file and the scan choices; the scan opens the scanner', async () => {
    await renderSheet();
    expect(screen.getByRole('button', { name: 'Wczytaj z pliku' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Zeskanuj kartę pokładową' }));
    expect(onScan).toHaveBeenCalled();
  });

  it('offline: the file choice is disabled with a hint, the scan still works (Z6)', async () => {
    jest.mocked(useIsOffline).mockReturnValue(true);
    await renderSheet();
    expect(screen.getByRole('button', { name: 'Wczytaj z pliku' })).toBeDisabled();
    expect(screen.getByText(/wymaga internetu/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zeskanuj kartę pokładową' })).toBeEnabled();
  });

  it('shows the consent with a privacy link; "Wyślij" is disabled until the checkbox is checked (D2)', async () => {
    await renderSheet();
    await toConsent();
    expect(screen.getByText(/Plik zostanie odczytany na naszym serwerze/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled();
    await accept();
    expect(screen.getByRole('checkbox', { name: /Rozumiem i akceptuję/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Polityka prywatności' }));
    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/legal/privacy');
  });

  it('sends the picked PDF, shows loading, and hands the response over', async () => {
    let resolve: (r: ExtractTicketResponse) => void = () => {};
    jest.mocked(extractTicket).mockReturnValue(new Promise((r) => (resolve = r)));
    await renderSheet();
    await toConsent();
    await accept();
    await send();
    await waitFor(() => expect(screen.getByText('Odczytujemy bilet…')).toBeTruthy());
    expect(extractTicket).toHaveBeenCalledWith(request, expect.anything());
    await act(async () => resolve(response));
    expect(onImported).toHaveBeenCalledWith(response);
  });

  it('sends a gallery photo when "Zdjęcie" is chosen', async () => {
    jest.mocked(extractTicket).mockResolvedValue(response);
    await renderSheet();
    await toConsent();
    await fireEvent.press(screen.getByRole('radio', { name: 'Zdjęcie' }));
    await accept();
    await send();
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(pickTicketPhoto).toHaveBeenCalled();
    expect(pickTicketPdf).not.toHaveBeenCalled();
  });

  it('a closed picker sends nothing and stays on the consent', async () => {
    jest.mocked(pickTicketPdf).mockResolvedValue(null);
    await renderSheet();
    await toConsent();
    await accept();
    await send();
    expect(extractTicket).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled();
  });

  it('not a ticket: a centred message and "Wybierz inny plik" returns to the consent', async () => {
    jest.mocked(extractTicket).mockRejectedValue(new NotATicketError('x'));
    await renderSheet();
    await toConsent();
    await accept();
    await send();
    const box = await screen.findByTestId('ticket-not-a-ticket');
    expect(box.props.style).toMatchObject({ alignItems: 'center' });
    expect(screen.getByText('To nie wygląda na bilet lotniczy')).toBeTruthy();
    expect(screen.getByText(/Ta próba nie wlicza się do dziennego limitu/)).toBeTruthy();
    expect(onImported).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Wybierz inny plik' }));
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeTruthy();
  });

  it.each([
    ['the limit', new TicketLimitError('x'), /dzienny limit/],
    ['an unsupported file', new UnsupportedTicketFileError('unsupported_file', 'x'), /nie jest obsługiwany/],
    ['a too large file', new UnsupportedTicketFileError('file_too_large', 'x'), /za duży/],
    ['an unreachable server', new ServerUnreachableError('x'), /połączyć się z serwerem/],
    ['another error', new TicketImportError('failed', 'x'), /Nie udało się odczytać biletu/],
  ])('shows a clear message with a retry for %s', async (_name, error, text) => {
    jest.mocked(extractTicket).mockRejectedValue(error);
    await renderSheet();
    await toConsent();
    await accept();
    await send();
    expect(await screen.findByText(text)).toBeTruthy();
    expect(onImported).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeTruthy();
  });

  it.each([
    ['Wybierz inny plik', new NotATicketError('x')],
    ['Spróbuj ponownie', new TicketImportError('failed', 'x')],
  ])('"%s" asks for the consent again (D2)', async (button, error) => {
    jest.mocked(extractTicket).mockRejectedValue(error);
    await renderSheet();
    await toConsent();
    await accept();
    await send();
    await fireEvent.press(await screen.findByRole('button', { name: button }));
    expect(screen.getByRole('checkbox', { name: /Rozumiem i akceptuję/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled();
  });

  it('cannot be dismissed while the upload is in flight', async () => {
    jest.mocked(extractTicket).mockReturnValue(new Promise(() => {}));
    await renderSheet();
    await toConsent();
    await accept();
    await send();
    await screen.findByText('Odczytujemy bilet…');
    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('an unsupported file thrown by the picker shows the same message', async () => {
    jest.mocked(pickTicketPdf).mockRejectedValue(new UnsupportedTicketFileError('file_too_large', 'x'));
    await renderSheet();
    await toConsent();
    await accept();
    await send();
    expect(await screen.findByText(/za duży/)).toBeTruthy();
  });

  it('remembers nothing: the consent is empty again after the sheet is reopened (D2)', async () => {
    const view = await renderSheet();
    await toConsent();
    await accept();
    await view.unmount();
    await renderSheet();
    await toConsent();
    expect(screen.getByRole('checkbox', { name: /Rozumiem i akceptuję/ })).not.toBeChecked();
  });
});

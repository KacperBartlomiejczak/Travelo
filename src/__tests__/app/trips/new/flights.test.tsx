import { useFonts } from 'expo-font';
import { act, waitFor } from '@testing-library/react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo, ScrollView } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import HomeScreen from '@/app/(drawer)/(tabs)/index';
import RootLayout from '@/app/_layout';
import BudgetStep from '@/app/trips/new/budget';
import FriendsStep from '@/app/trips/new/friends';
import FlightsStep from '@/app/trips/new/index';
import NewTripLayout from '@/app/trips/new/_layout';
import SummaryStep from '@/app/trips/new/summary';
import i18n from '@/i18n';
import { extractTicket } from '@/data/ticket-import';
import { pickTicketPdf } from '@/features/trip-create/ticket-pick';
import { toPickerDate } from '@/lib/date-time';
import { tokens } from '@/theme/tokens';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);
jest.mock('@/data/supabase', () => ({ supabase: {} }));
jest.mock('@/data/ticket-import', () => ({ ...jest.requireActual('@/data/ticket-import'), extractTicket: jest.fn() }));
jest.mock('@/features/trip-create/ticket-pick', () => ({ pickTicketPdf: jest.fn(), pickTicketPhoto: jest.fn() }));
jest.mock('expo-camera', () => {
  const { View } = jest.requireActual('react-native');
  return { CameraView: jest.fn((props: object) => <View testID="camera" {...props} />), useCameraPermissions: jest.fn() };
});

// Native picker stand-in: pressing it picks `mockPicked`.
let mockPicked = new Date();
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    DateTimePicker: (props: { onValueChange: (e: object, d: Date) => void }) => (
      <Pressable testID="picker" onPress={() => props.onValueChange({}, mockPicked)}>
        <Text>picker</Text>
      </Pressable>
    ),
  };
});

async function openFlights() {
  const rendered = await renderRouter(
    {
      _layout: RootLayout,
      '(drawer)/_layout': DrawerLayout,
      '(drawer)/(tabs)/_layout': TabsLayout,
      '(drawer)/(tabs)/index': HomeScreen,
      'trips/new/_layout': NewTripLayout,
      'trips/new/index': FlightsStep,
      'trips/new/friends': FriendsStep,
      'trips/new/budget': BudgetStep,
      'trips/new/summary': SummaryStep,
    },
    { initialUrl: '/' },
  );
  await fireEvent.press(await screen.findByText('Utwórz podróż'));
  return { getPathname: () => rendered.getPathname() };
}

function card(title: string, section: 'Lot tam' | 'Powrót') {
  return within(screen.getByTestId(`${section}-${title}`));
}

async function showDirection(name: 'Lot tam' | 'Powrót') {
  await fireEvent.press(screen.getByRole('radio', { name }));
}

async function chooseAirport(scope: ReturnType<typeof card>, label: 'Skąd' | 'Dokąd', query: string, option: RegExp) {
  await fireEvent.changeText(scope.getByLabelText(label), query);
  await fireEvent.press(scope.getByRole('button', { name: option }));
}

async function pickDateTime(scope: ReturnType<typeof card>, label: 'Wylot' | 'Przylot', local: string) {
  mockPicked = toPickerDate(local);
  await fireEvent.press(scope.getByRole('button', { name: label })); // open
  await fireEvent.press(scope.getByTestId('picker'));
  await fireEvent.press(scope.getByRole('button', { name: label })); // close
}

async function fillValidTrip() {
  const out = card('Odcinek 1', 'Lot tam');
  await chooseAirport(out, 'Skąd', 'WAW', /Warsaw · WAW/);
  await chooseAirport(out, 'Dokąd', 'BKK', /Bangkok · BKK/);
  await pickDateTime(out, 'Wylot', '2026-11-02T10:00');
  await pickDateTime(out, 'Przylot', '2026-11-03T05:00');
  await showDirection('Powrót');
  const back = card('Odcinek 1', 'Powrót');
  await pickDateTime(back, 'Wylot', '2026-11-15T09:00');
  await pickDateTime(back, 'Przylot', '2026-11-15T17:00');
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-04T12:00:00+02:00'), advanceTimers: true });
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Flights step', () => {
  it('shows the heading, the enabled ticket button and the outbound first (D2, D24)', async () => {
    await openFlights();
    expect(screen.getByRole('header', { name: 'Kiedy i dokąd lecisz?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wczytaj bilet' })).toBeEnabled();
    expect(screen.getByLabelText('Kierunek lotu').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'Lot tam' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Powrót' })).not.toBeChecked();
    expect(screen.getByTestId('Lot tam-Odcinek 1')).toBeTruthy();
    expect(screen.queryByTestId('Powrót-Odcinek 1')).toBeNull();
  });

  it('shows only the return after switching to it, and the outbound again after switching back', async () => {
    await openFlights();
    await showDirection('Powrót');
    expect(screen.getByRole('radio', { name: 'Powrót' })).toBeChecked();
    expect(screen.getByTestId('Powrót-Odcinek 1')).toBeTruthy();
    expect(screen.queryByTestId('Lot tam-Odcinek 1')).toBeNull();
    await showDirection('Lot tam');
    expect(screen.getByTestId('Lot tam-Odcinek 1')).toBeTruthy();
    expect(screen.queryByTestId('Powrót-Odcinek 1')).toBeNull();
  });

  it('keeps what was entered in a direction while the other one is shown', async () => {
    await openFlights();
    const out = card('Odcinek 1', 'Lot tam');
    await chooseAirport(out, 'Dokąd', 'DXB', /Dubai · DXB/);
    await pickDateTime(out, 'Wylot', '2026-11-02T10:00');
    await showDirection('Powrót');
    await pickDateTime(card('Odcinek 1', 'Powrót'), 'Przylot', '2026-11-15T17:00');
    await showDirection('Lot tam');
    expect(card('Odcinek 1', 'Lot tam').getByLabelText('Dokąd').props.value).toBe('Dubai · DXB');
    // One of the two date fields is still empty (placeholder) in each direction.
    expect(card('Odcinek 1', 'Lot tam').getAllByText('Wybierz datę i godzinę')).toHaveLength(1);
    await showDirection('Powrót');
    expect(card('Odcinek 1', 'Powrót').getAllByText('Wybierz datę i godzinę')).toHaveLength(1);
  });

  it('shows the companions stepper on both tabs', async () => {
    await openFlights();
    expect(screen.getByRole('button', { name: 'Zwiększ' })).toBeTruthy();
    await showDirection('Powrót');
    expect(screen.getByRole('button', { name: 'Zwiększ' })).toBeTruthy();
  });

  it('finds an airport by typing and fills the field', async () => {
    await openFlights();
    const out = card('Odcinek 1', 'Lot tam');
    await chooseAirport(out, 'Dokąd', 'barc', /Barcelona · BCN/);
    expect(out.getByLabelText('Dokąd').props.value).toBe('Barcelona · BCN');
  });

  it('suggests the return as the outbound reversed (D25)', async () => {
    await openFlights();
    const out = card('Odcinek 1', 'Lot tam');
    await chooseAirport(out, 'Skąd', 'WAW', /Warsaw · WAW/);
    await chooseAirport(out, 'Dokąd', 'BKK', /Bangkok · BKK/);
    await showDirection('Powrót');
    const back = card('Odcinek 1', 'Powrót');
    expect(back.getByLabelText('Skąd').props.value).toBe('Bangkok · BKK');
    expect(back.getByLabelText('Dokąd').props.value).toBe('Warsaw · WAW');
  });

  it('adds a layover segment that starts where the previous one landed, and removes it', async () => {
    await openFlights();
    await chooseAirport(card('Odcinek 1', 'Lot tam'), 'Dokąd', 'DXB', /Dubai · DXB/);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Dodaj przesiadkę' })[0]);
    const second = card('Odcinek 2', 'Lot tam');
    expect(second.getByLabelText('Skąd').props.value).toBe('Dubai · DXB');
    await fireEvent.press(second.getByRole('button', { name: 'Usuń' }));
    expect(screen.queryByTestId('Lot tam-Odcinek 2')).toBeNull();
  });

  it('keeps half-typed text with its own card when a middle segment is removed', async () => {
    await openFlights();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Dodaj przesiadkę' })[0]);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Dodaj przesiadkę' })[0]);
    await fireEvent.changeText(card('Odcinek 3', 'Lot tam').getByLabelText('Dokąd'), 'kra');
    await fireEvent.press(card('Odcinek 2', 'Lot tam').getByRole('button', { name: 'Usuń' }));
    expect(card('Odcinek 2', 'Lot tam').getByLabelText('Dokąd').props.value).toBe('kra');
  });

  it('only later segments can be removed', async () => {
    await openFlights();
    expect(card('Odcinek 1', 'Lot tam').queryByRole('button', { name: 'Usuń' })).toBeNull();
  });

  it('shows the layover between segments once both times are known (D3)', async () => {
    await openFlights();
    const first = card('Odcinek 1', 'Lot tam');
    await chooseAirport(first, 'Dokąd', 'DXB', /Dubai · DXB/);
    await pickDateTime(first, 'Przylot', '2026-11-02T18:30');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Dodaj przesiadkę' })[0]);
    await pickDateTime(card('Odcinek 2', 'Lot tam'), 'Wylot', '2026-11-03T03:30');
    expect(screen.getByText('9 godz. przesiadki w DXB')).toBeTruthy();
  });

  it('keeps the 16 dp inset on the layover label between segment cards (D27)', async () => {
    await openFlights();
    const first = card('Odcinek 1', 'Lot tam');
    await chooseAirport(first, 'Dokąd', 'DXB', /Dubai · DXB/);
    await pickDateTime(first, 'Przylot', '2026-11-02T18:30');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Dodaj przesiadkę' })[0]);
    await pickDateTime(card('Odcinek 2', 'Lot tam'), 'Wylot', '2026-11-03T03:30');
    expect(screen.getByText('9 godz. przesiadki w DXB').parent).toHaveStyle({ paddingLeft: tokens.spacing[4] });
  });

  it('counts companions with the stepper (0…19)', async () => {
    await openFlights();
    expect(screen.getByRole('button', { name: 'Zmniejsz' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Zwiększ' }));
    expect(screen.getByRole('progressbar', { name: 'Krok 1 z 4' })).toBeTruthy();
  });

  it('shows what is missing instead of moving on', async () => {
    const app = await openFlights();
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new');
    const out = card('Odcinek 1', 'Lot tam');
    expect(out.getAllByText('Wybierz lotnisko')).toHaveLength(2);
    expect(out.getAllByText('Wybierz datę i godzinę')).toHaveLength(4); // 2 placeholders + 2 errors
  });

  it('shows the outbound when both directions have errors (D5)', async () => {
    await openFlights();
    await showDirection('Powrót');
    await fireEvent.press(screen.getByText('Dalej'));
    expect(screen.getByRole('radio', { name: 'Lot tam' })).toBeChecked();
    expect(card('Odcinek 1', 'Lot tam').getAllByText('Wybierz lotnisko')).toHaveLength(2);
  });

  it('switches to the return, announces and scrolls to it when only the return has an error (D5)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const scrollTo = jest.mocked(ScrollView.prototype.scrollTo);
    const app = await openFlights();
    await fillValidTrip();
    await pickDateTime(card('Odcinek 1', 'Powrót'), 'Wylot', '2026-11-03T04:00');
    await pickDateTime(card('Odcinek 1', 'Powrót'), 'Przylot', '2026-11-03T12:00');
    await showDirection('Lot tam');
    const layout = (y: number) => ({ nativeEvent: { layout: { x: 0, y, width: 335, height: 600 } } });
    await fireEvent(screen.getByTestId('Lot tam-section'), 'layout', layout(300));
    scrollTo.mockClear();

    await fireEvent.press(screen.getByText('Dalej'));

    expect(app.getPathname()).toBe('/trips/new');
    expect(screen.getByRole('radio', { name: 'Powrót' })).toBeChecked();
    expect(card('Odcinek 1', 'Powrót').getByText('Powrót musi wylatywać po przylocie na miejsce')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Popraw zaznaczone pola');
    // The return card is measured only once it is shown; then the screen scrolls to it.
    await fireEvent(screen.getByTestId('Powrót-Odcinek 1'), 'layout', layout(40));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 300 + 40 - 16, animated: true });
    announce.mockRestore();
  });

  it('explains a time that does not add up', async () => {
    await openFlights();
    await fillValidTrip();
    await pickDateTime(card('Odcinek 1', 'Powrót'), 'Wylot', '2026-11-03T04:00');
    await pickDateTime(card('Odcinek 1', 'Powrót'), 'Przylot', '2026-11-03T12:00');
    await fireEvent.press(screen.getByText('Dalej'));
    expect(card('Odcinek 1', 'Powrót').getByText('Powrót musi wylatywać po przylocie na miejsce')).toBeTruthy();
    expect(card('Odcinek 1', 'Powrót').getByRole('button', { name: 'Wylot' }).props.accessibilityHint).toBe(
      'Powrót musi wylatywać po przylocie na miejsce',
    );
  });

  it('explains a time skipped when clocks go forward', async () => {
    const app = await openFlights();
    await fillValidTrip();
    const back = card('Odcinek 1', 'Powrót'); // BKK → WAW (D25)
    await pickDateTime(back, 'Wylot', '2027-03-27T20:00');
    await pickDateTime(back, 'Przylot', '2027-03-28T02:30');
    await fireEvent.press(screen.getByText('Dalej'));
    const message = 'Tej godziny nie ma — tej nocy zegarki przestawiono o godzinę do przodu. Sprawdź bilet.';
    expect(card('Odcinek 1', 'Powrót').getByRole('button', { name: 'Przylot' }).props.accessibilityHint).toBe(message);
    expect(card('Odcinek 1', 'Powrót').getByText(message)).toBeTruthy();
    expect(app.getPathname()).toBe('/trips/new');
  });

  it('announces and scrolls to the first card with an error (D29)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const scrollTo = jest.mocked(ScrollView.prototype.scrollTo);
    scrollTo.mockClear();
    await openFlights();
    await fillValidTrip();
    await pickDateTime(card('Odcinek 1', 'Powrót'), 'Wylot', '2026-11-03T04:00');
    await pickDateTime(card('Odcinek 1', 'Powrót'), 'Przylot', '2026-11-03T12:00');
    // Where the return section and its first card sit in the scroll content.
    const layout = (y: number) => ({ nativeEvent: { layout: { x: 0, y, width: 335, height: 600 } } });
    await fireEvent(screen.getByTestId('Powrót-section'), 'layout', layout(900));
    await fireEvent(screen.getByTestId('Powrót-Odcinek 1'), 'layout', layout(40));

    await fireEvent.press(screen.getByText('Dalej'));

    expect(announce).toHaveBeenCalledWith('Popraw zaznaczone pola');
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 900 + 40 - 16, animated: true });
    announce.mockRestore();
  });

  it('goes to the budget when travelling alone', async () => {
    const app = await openFlights();
    await fillValidTrip();
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/budget');
  });

  it('goes to friends when friends fly along', async () => {
    const app = await openFlights();
    await fillValidTrip();
    await fireEvent.press(screen.getByRole('button', { name: 'Zwiększ' }));
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/friends');
  });
});

describe('Flights step: ticket import', () => {
  const complete = {
    segments: [
      {
        direction: 'outbound' as const,
        fromIata: 'WAW',
        toIata: 'BKK',
        flightNumber: 'LO123',
        flightDate: '2026-11-02',
        departAt: '2026-11-02T10:00',
        arriveAt: '2026-11-03T05:00',
      },
      {
        direction: 'return' as const,
        fromIata: 'BKK',
        toIata: 'WAW',
        flightNumber: 'LO124',
        flightDate: '2026-11-15',
        departAt: '2026-11-15T09:00',
        arriveAt: '2026-11-15T17:00',
      },
    ],
    source: 'parser' as const,
    complete: true,
    remainingToday: 5,
  };
  const partial = {
    ...complete,
    segments: complete.segments.map((s) => ({
      ...s,
      departAt: null,
      arriveAt: null,
    })),
    complete: false,
  };

  async function importFile(response: typeof complete | typeof partial) {
    jest.mocked(pickTicketPdf).mockResolvedValue({
      mimeType: 'application/pdf',
      dataBase64: 'JVBERi0=',
    });
    jest.mocked(extractTicket).mockResolvedValue(response);
    await fireEvent.press(screen.getByRole('button', { name: 'Wczytaj bilet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Wczytaj z pliku' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /Rozumiem i akceptuję/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Wyślij' }));
  }

  it('fills an empty form from the ticket and says to check it', async () => {
    await openFlights();
    await importFile(complete);
    expect(await screen.findByText('Wpisaliśmy loty z biletu. Sprawdź je przed dalszym krokiem.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Zastąpić wpisane loty?')).toBeNull()); // the dialog fades out
    expect(within(screen.getByTestId('Lot tam-Odcinek 1')).getByDisplayValue('LO123')).toBeTruthy();
  });

  it('a partial ticket says to fill in the times', async () => {
    await openFlights();
    await importFile(partial);
    expect(await screen.findByText('Wpisaliśmy lotniska i numery lotów. Uzupełnij godziny.')).toBeTruthy();
  });

  it('asks before replacing flights that were typed (D3); cancel keeps them, confirm replaces them', async () => {
    await openFlights();
    await chooseAirport(card('Odcinek 1', 'Lot tam'), 'Dokąd', 'DXB', /Dubai · DXB/);
    await importFile(complete);
    expect(await screen.findByText('Zastąpić wpisane loty?')).toBeTruthy();
    expect(screen.queryByText(/Wpisaliśmy/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Zostaw moje' }));
    await waitFor(() => expect(screen.queryByText('Zastąpić wpisane loty?')).toBeNull()); // the dialog fades out
    expect(within(screen.getByTestId('Lot tam-Odcinek 1')).queryByDisplayValue('LO123')).toBeNull();

    await importFile(complete);
    await fireEvent.press(await screen.findByRole('button', { name: 'Zastąp' }));
    expect(await screen.findByText('Wpisaliśmy loty z biletu. Sprawdź je przed dalszym krokiem.')).toBeTruthy();
    expect(within(screen.getByTestId('Lot tam-Odcinek 1')).getByDisplayValue('LO123')).toBeTruthy();
  });

  it('asks before replacing flights typed while the import was still running', async () => {
    await openFlights();
    let resolve!: (value: typeof complete) => void;
    jest.mocked(pickTicketPdf).mockResolvedValue({ mimeType: 'application/pdf', dataBase64: 'JVBERi0=' });
    jest.mocked(extractTicket).mockReturnValue(new Promise((r) => (resolve = r)));
    await fireEvent.press(screen.getByRole('button', { name: 'Wczytaj bilet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Wczytaj z pliku' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /Rozumiem i akceptuję/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Wyślij' }));
    await chooseAirport(card('Odcinek 1', 'Lot tam'), 'Dokąd', 'DXB', /Dubai · DXB/);
    await act(async () => resolve(complete));
    expect(await screen.findByText('Zastąpić wpisane loty?')).toBeTruthy();
    expect(screen.queryByText(/Wpisaliśmy/)).toBeNull();
  });

  it('a scanned boarding pass is added to the chosen direction without times (Z2, Z3)', async () => {
    jest.mocked(useCameraPermissions).mockReturnValue([{ granted: true, canAskAgain: true } as never, jest.fn(), jest.fn()]);
    await openFlights();
    await fireEvent.press(screen.getByRole('button', { name: 'Wczytaj bilet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Zeskanuj kartę pokładową' }));
    const pad = (v: string, n: number) => v.padEnd(n, ' ').slice(0, n);
    const bcbp = `M1${pad('DOE/JOHN', 20)}E${pad('ZXQ4TK', 7)}WAWBKKFR ${pad('0123', 5)}340Y012A000011` + '00';
    await act(async () =>
      jest
        .mocked(CameraView)
        .mock.calls.at(-1)![0]
        .onBarcodeScanned?.({ data: bcbp, type: 'pdf417' } as never),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj do lotów' }));
    const first = within(screen.getByTestId('Lot tam-Odcinek 1'));
    expect(first.getByDisplayValue('FR123')).toBeTruthy();
    expect(await screen.findByText('Dodaliśmy lot z karty pokładowej. Uzupełnij godziny.')).toBeTruthy();
  });
});

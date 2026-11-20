import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/i18n';

import { BoardingPassScanner } from '../BoardingPassScanner';

jest.mock('expo-camera', () => {
  const { View } = jest.requireActual('react-native');
  return {
    CameraView: jest.fn((props: object) => <View testID="camera" {...props} />),
    useCameraPermissions: jest.fn(),
  };
});

// IATA 792 sample: WAW -> MAD, FR 0123, day 340 (name and PNR are filler that must never come out).
const pad = (value: string, length: number) => value.padEnd(length, ' ').slice(0, length);
const BCBP = `M1${pad('DOE/JOHN', 20)}E${pad('ZXQ4TK', 7)}WAWMADFR ${pad('0123', 5)}340Y012A000011` + '00';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const onClose = jest.fn();
const onAdd = jest.fn();
const request = jest.fn();

const tree = () => (
  <SafeAreaProvider initialMetrics={metrics}>
    <BoardingPassScanner visible onClose={onClose} onAdd={onAdd} />
  </SafeAreaProvider>
);
const permission = (granted: boolean, canAskAgain: boolean) =>
  jest.mocked(useCameraPermissions).mockReturnValue([{ granted, canAskAgain } as never, request, jest.fn()]);
const scan = (data: string) =>
  act(async () =>
    jest
      .mocked(CameraView)
      .mock.calls.at(-1)![0]
      .onBarcodeScanned?.({ data, type: 'pdf417' } as never),
  );

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers({
    now: new Date('2026-10-04T12:00:00Z'),
    advanceTimers: true,
  });
  permission(true, true);
  await i18n.changeLanguage('pl');
});
afterEach(() => jest.useRealTimers());

describe('BoardingPassScanner', () => {
  it('asks for the camera permission, then scans pdf417, aztec and qr', async () => {
    permission(false, true);
    const view = await render(tree());
    await fireEvent.press(screen.getByRole('button', { name: 'Zezwól na aparat' }));
    expect(request).toHaveBeenCalled();
    permission(true, true);
    await view.rerender(tree());
    expect(jest.mocked(CameraView).mock.calls.at(-1)![0].barcodeScannerSettings).toEqual({ barcodeTypes: ['pdf417', 'aztec', 'qr'] });
  });

  it('denied for good: explains and opens the settings', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    permission(false, false);
    await render(tree());
    expect(screen.getByText(/nie ma dostępu do aparatu/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Otwórz ustawienia' }));
    expect(openSettings).toHaveBeenCalled();
    expect(screen.queryByTestId('camera')).toBeNull();
  });

  it('an unrecognised code shows a message and keeps scanning', async () => {
    await render(tree());
    await scan('https://example.com');
    expect(screen.getByText(/Nie rozpoznajemy tego kodu/)).toBeTruthy();
    expect(screen.getByTestId('camera')).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('a boarding pass asks for the direction, then hands the pass over (Z2)', async () => {
    await render(tree());
    await scan(BCBP);
    expect(screen.getByRole('radio', { name: 'Lot tam' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Powrót' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj do lotów' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const [pass, direction] = onAdd.mock.calls[0];
    expect(direction).toBe('return');
    expect(pass.legs[0]).toMatchObject({
      fromIata: 'WAW',
      toIata: 'MAD',
      flightNumber: 'FR123',
      flightDate: '2026-12-06',
    });
    expect(JSON.stringify(pass)).not.toMatch(/DOE|ZXQ4TK/);
  });

  it('dates the pass from the local day of the phone, not the UTC day', async () => {
    const original = process.env.TZ;
    process.env.TZ = 'Europe/Warsaw';
    try {
      jest.setSystemTime(new Date('2026-10-04T23:30:00Z')); // 5 Oct in Warsaw
      await render(tree());
      await scan(BCBP.replace('340', '277')); // day 277 = 4 Oct: already past locally, so next year
      await fireEvent.press(screen.getByRole('button', { name: 'Dodaj do lotów' }));
      expect(onAdd.mock.calls[0][0].legs[0].flightDate).toBe('2027-10-04');
    } finally {
      process.env.TZ = original;
    }
  });

  it('labels the camera and the loading state for screen readers', async () => {
    await render(tree());
    expect(jest.mocked(CameraView).mock.calls.at(-1)![0].accessibilityLabel).toBe('Skieruj aparat na kod kreskowy lub QR na karcie pokładowej.');
    permission(true, true);
    jest.mocked(useCameraPermissions).mockReturnValue([null, request, jest.fn()]);
    await render(tree());
    expect(screen.getByLabelText('Ładowanie aparatu')).toBeTruthy();
  });

  it('"Skanuj ponownie" goes back to the camera without adding anything', async () => {
    await render(tree());
    await scan(BCBP);
    await fireEvent.press(screen.getByRole('button', { name: 'Skanuj ponownie' }));
    expect(screen.getByTestId('camera')).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });
});

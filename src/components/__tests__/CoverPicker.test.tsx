import { fireEvent, render, screen } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { CoverPicker } from '@/components/CoverPicker';
import i18n from '@/i18n';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const launch = jest.mocked(launchImageLibraryAsync);

const picked = (uri: string) => ({ canceled: false as const, assets: [{ uri, width: 1600, height: 900 }] });

beforeEach(async () => {
  launch.mockReset();
  await i18n.changeLanguage('pl');
});

describe('CoverPicker (D1)', () => {
  it('is an optional field with a button that opens the gallery for images, cropped to 16:9', async () => {
    launch.mockResolvedValue(picked('file:///cache/cover.jpg'));
    const onChange = jest.fn();
    await render(<CoverPicker value={undefined} onChange={onChange} />);
    expect(screen.getByText('Zdjęcie okładki (opcjonalnie)')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Wybierz z galerii' }));
    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9] }));
    expect(onChange).toHaveBeenCalledWith('file:///cache/cover.jpg');
  });

  it('shows the chosen photo with change and remove', async () => {
    launch.mockResolvedValue(picked('file:///cache/other.jpg'));
    const onChange = jest.fn();
    await render(<CoverPicker value="file:///cache/cover.jpg" onChange={onChange} />);
    // expo-image is not an accessibility element by default; the preview must be read out.
    expect(screen.getByLabelText('Wybrane zdjęcie okładki').props.accessible).toBe(true);
    expect(screen.queryByRole('button', { name: 'Wybierz z galerii' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Zmień zdjęcie' }));
    expect(onChange).toHaveBeenLastCalledWith('file:///cache/other.jpg');
    await fireEvent.press(screen.getByRole('button', { name: 'Usuń zdjęcie' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('changes nothing when the gallery is closed without a photo', async () => {
    launch.mockResolvedValue({ canceled: true, assets: null });
    const onChange = jest.fn();
    await render(<CoverPicker value="file:///cache/cover.jpg" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Zmień zdjęcie' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('explains when the gallery cannot be opened and keeps the photo', async () => {
    launch.mockRejectedValue(new Error('no access'));
    const onChange = jest.fn();
    await render(<CoverPicker value="file:///cache/cover.jpg" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Zmień zdjęcie' }));
    expect(await screen.findByText('Nie udało się otworzyć galerii. Spróbuj ponownie.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Wybrane zdjęcie okładki')).toBeTruthy();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await render(<CoverPicker value={undefined} onChange={() => {}} />);
    expect(screen.getByText('Cover photo (optional)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose from gallery' })).toBeTruthy();
  });
});

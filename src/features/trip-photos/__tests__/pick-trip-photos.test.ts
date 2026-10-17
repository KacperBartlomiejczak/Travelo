import { launchImageLibraryAsync, type ImagePickerAsset } from 'expo-image-picker';

import { pickTripPhotos } from '@/features/trip-photos/pick-trip-photos';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const launch = jest.mocked(launchImageLibraryAsync);

const asset = (uri: string, exif?: Record<string, unknown> | null): ImagePickerAsset => ({ uri, width: 4000, height: 3000, exif });
const picked = (...assets: ImagePickerAsset[]) => ({ canceled: false as const, assets });

beforeEach(() => {
  launch.mockReset();
});

describe('pickTripPhotos (trip-photos D7)', () => {
  it('opens the gallery for images, several at once (up to 20), with EXIF, and without cropping', async () => {
    launch.mockResolvedValue(picked(asset('file:///gallery/1.jpg')));
    await pickTripPhotos();
    // Exactly these options: no `allowsEditing`, no `quality` (the file is downscaled and re-encoded before upload).
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 20, exif: true });
  });

  it('gives no photos when the gallery is closed without a choice', async () => {
    launch.mockResolvedValue({ canceled: true, assets: null });
    await expect(pickTripPhotos()).resolves.toEqual([]);
  });

  it('gives each photo its uri and the date taken from its EXIF, in the order picked', async () => {
    launch.mockResolvedValue(
      picked(
        asset('file:///gallery/1.jpg', { DateTimeOriginal: '2026:10:14 18:03:22' }),
        asset('file:///gallery/2.jpg', { DateTime: '2026:10:13 09:30:00' }),
      ),
    );
    await expect(pickTripPhotos()).resolves.toEqual([
      { uri: 'file:///gallery/1.jpg', takenAt: '2026-10-14T18:03' },
      { uri: 'file:///gallery/2.jpg', takenAt: '2026-10-13T09:30' },
    ]);
  });

  it.each([
    ['no EXIF at all', undefined],
    ['EXIF that is null', null],
    ['EXIF without a date', { Make: 'Apple' }],
    ['a date that is not a real one', { DateTimeOriginal: '0000:00:00 00:00:00' }],
  ])('leaves the date taken out for %s', async (_, exif) => {
    launch.mockResolvedValue(picked(asset('file:///gallery/screenshot.png', exif)));
    const result = await pickTripPhotos();
    expect(result).toEqual([{ uri: 'file:///gallery/screenshot.png' }]);
    expect(Object.keys(result[0])).toEqual(['uri']);
  });

  it('never passes anything else from the EXIF on (GPS stays on the phone, trip-photos D2)', async () => {
    launch.mockResolvedValue(picked(asset('file:///gallery/1.jpg', { DateTimeOriginal: '2026:10:14 18:03:22', GPSLatitude: 52.2, GPSLongitude: 21 })));
    const result = await pickTripPhotos();
    expect(Object.keys(result[0]).sort()).toEqual(['takenAt', 'uri']);
  });

  it('rejects when the gallery cannot be opened', async () => {
    launch.mockRejectedValue(new Error('no access'));
    await expect(pickTripPhotos()).rejects.toThrow('no access');
  });

  it('rejects an asset the picker reported without a usable uri (its result is a boundary)', async () => {
    launch.mockResolvedValue(picked(asset('')));
    await expect(pickTripPhotos()).rejects.toThrow();
  });
});

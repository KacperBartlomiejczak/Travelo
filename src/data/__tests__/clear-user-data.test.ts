import { Paths } from 'expo-file-system';
import { Image } from 'expo-image';

import { clearUserDataOnPhone } from '@/data/clear-user-data';

jest.mock('expo-image', () => ({
  Image: { clearMemoryCache: jest.fn(async () => true), clearDiskCache: jest.fn(async () => true) },
}));

jest.mock('expo-file-system', () => ({ Paths: { cache: { list: jest.fn() } } }));

const entry = () => ({ delete: jest.fn() });
const list = Paths.cache.list as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  list.mockReturnValue([]);
});

describe('clearUserDataOnPhone', () => {
  it('clears SQLite, both image caches and every entry of the cache directory', async () => {
    const files = [entry(), entry()];
    list.mockReturnValue(files);
    const clearStore = jest.fn(async () => {});

    await clearUserDataOnPhone(clearStore);

    expect(clearStore).toHaveBeenCalledTimes(1);
    expect(Image.clearMemoryCache).toHaveBeenCalledTimes(1);
    expect(Image.clearDiskCache).toHaveBeenCalledTimes(1);
    files.forEach((file) => expect(file.delete).toHaveBeenCalledTimes(1));
  });

  it('does not reject when the files cannot be cleared, and still clears SQLite', async () => {
    const bad = { delete: jest.fn(() => { throw new Error('locked'); }) };
    const good = entry();
    list.mockReturnValue([bad, good]);
    jest.mocked(Image.clearDiskCache).mockRejectedValueOnce(new Error('disk'));
    jest.mocked(Image.clearMemoryCache).mockRejectedValueOnce(new Error('memory'));
    const clearStore = jest.fn(async () => {});

    await expect(clearUserDataOnPhone(clearStore)).resolves.toBeUndefined();

    expect(clearStore).toHaveBeenCalledTimes(1);
    expect(good.delete).toHaveBeenCalledTimes(1);
  });

  it('does not reject when listing the cache directory fails', async () => {
    list.mockImplementation(() => { throw new Error('gone'); });
    await expect(clearUserDataOnPhone(jest.fn(async () => {}))).resolves.toBeUndefined();
  });

  it('rejects when SQLite cannot be cleared', async () => {
    await expect(clearUserDataOnPhone(jest.fn(async () => { throw new Error('sqlite'); }))).rejects.toThrow('sqlite');
  });
});

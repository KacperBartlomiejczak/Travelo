import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';

import { downloadAvatar } from '@/data/avatar-download';

// expo-crypto has no native side in Jest.
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

// The native file system has no side in Jest: a stand-in of the API the download uses, `File.downloadFileAsync(url, destination, options)`,
// `new File(directory, name)` and `Paths.cache`. The download writes to the destination and resolves with that file, like the real one.
jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(uri: string) {
      this.uri = uri.endsWith('/') ? uri : `${uri}/`;
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('');
    }
    static downloadFileAsync = jest.fn(async (_url: string, destination: { uri: string }, _options?: { signal?: AbortSignal }) => destination);
  }
  return { File, Directory, Paths: { cache: new Directory('file:///data/cache/') } };
});

const download = jest.mocked(File.downloadFileAsync);

const GOOGLE_URL = 'https://lh3.googleusercontent.com/a/ACg8ocAnnaNowakPhoto=s512-c';
const DISCORD_URL = 'https://cdn.discordapp.com/avatars/123456789012345678/abcdef0123456789.png?size=512';

let counter = 0;
const newId = () => `id-${++counter}`;

beforeEach(() => {
  counter = 0;
  download.mockClear();
});

describe('downloadAvatar', () => {
  it('downloads a Google photo into the cache directory and returns the local file', async () => {
    const uri = await downloadAvatar(GOOGLE_URL, { newId });
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toBe(GOOGLE_URL);
    expect(uri).toBe('file:///data/cache/avatar-id-1');
    expect(uri.startsWith(Paths.cache.uri)).toBe(true);
    expect(download.mock.calls[0][1].uri).toBe(uri);
  });

  it('downloads a Discord photo', async () => {
    await expect(downloadAvatar(DISCORD_URL, { newId })).resolves.toMatch(/^file:\/\/\/data\/cache\//);
    expect(download.mock.calls[0][0]).toBe(DISCORD_URL);
  });

  it('gives every download its own file name', async () => {
    const first = await downloadAvatar(GOOGLE_URL, { newId });
    const second = await downloadAvatar(GOOGLE_URL, { newId });
    expect(first).not.toBe(second);
  });

  it('takes the unique part of the name from expo-crypto by default', async () => {
    jest.mocked(randomUUID).mockReturnValueOnce('0b9e7c1e-7f3a-4c53-9a53-6d1e2b3c4d5e');
    await expect(downloadAvatar(GOOGLE_URL)).resolves.toBe('file:///data/cache/avatar-0b9e7c1e-7f3a-4c53-9a53-6d1e2b3c4d5e');
  });

  it.each([
    ['not a url', 'avatar'],
    ['plain http', 'http://lh3.googleusercontent.com/a/photo=s512-c'],
    ['another host', 'https://evil.example/photo.png'],
    ['a look-alike host', 'https://lh3.googleusercontent.com.evil.example/photo'],
    ['credentials', 'https://user:pass@cdn.discordapp.com/avatars/1/a.png'],
    ['a file url', 'file:///data/secret.db'],
    ['a data url', 'data:image/png;base64,AAAA'],
    ['an empty string', ''],
  ])('refuses %s without downloading anything', async (_name, url) => {
    await expect(downloadAvatar(url, { newId })).rejects.toThrow();
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects when the download fails (an HTTP error, no connection)', async () => {
    download.mockRejectedValueOnce(new Error('response has status 404'));
    await expect(downloadAvatar(GOOGLE_URL, { newId })).rejects.toThrow('response has status 404');
  });

  it('rejects when the downloaded file is not a local file', async () => {
    download.mockResolvedValueOnce(new File('https://elsewhere.example/x'));
    await expect(downloadAvatar(GOOGLE_URL, { newId })).rejects.toThrow();
  });

  describe('timeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('aborts a download that takes longer than the limit', async () => {
      download.mockImplementationOnce(
        (_url, _destination, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      const result = downloadAvatar(GOOGLE_URL, { newId, timeoutMs: 5_000 });
      const rejected = expect(result).rejects.toThrow('aborted');
      await jest.advanceTimersByTimeAsync(4_999);
      expect(download.mock.calls[0][2]?.signal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(download.mock.calls[0][2]?.signal?.aborted).toBe(true);
      await rejected;
    });

    it('leaves no timer behind after a download that finished in time', async () => {
      await downloadAvatar(GOOGLE_URL, { newId, timeoutMs: 5_000 });
      expect(jest.getTimerCount()).toBe(0);
    });

    it('leaves no timer behind after a download that failed', async () => {
      download.mockRejectedValueOnce(new Error('offline'));
      await expect(downloadAvatar(GOOGLE_URL, { newId, timeoutMs: 5_000 })).rejects.toThrow('offline');
      expect(jest.getTimerCount()).toBe(0);
    });

    it('passes an abort signal to the download', async () => {
      await downloadAvatar(GOOGLE_URL, { newId });
      expect(download.mock.calls[0][2]?.signal).toBeInstanceOf(AbortSignal);
    });
  });
});

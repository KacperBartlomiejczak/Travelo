import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { prepareAvatar, preparePhoto } from '@/data/photo-files';

const PICKED_URI = 'file:///picked/IMG_0001.heic';

/** What the picked image looks like to the manipulator: its size, and what was done to it before it was saved. */
type FakeImage = {
  width: number;
  height: number;
  release: jest.Mock<void, []>;
  saveAsync: jest.Mock<Promise<{ uri: string; width: number; height: number }>, [{ format: string; compress: number }]>;
};

type Context = ReturnType<typeof ImageManipulator.manipulate>;

type FakeContext = {
  release: jest.Mock<void, []>;
  resize: jest.Mock<FakeContext, [{ width?: number; height?: number }]>;
  renderAsync: jest.Mock<Promise<FakeImage>, []>;
};

/**
 * Stands in for the native manipulator: `manipulate(uri | ref)` -> `resize(size)` -> `renderAsync()` -> ref -> `saveAsync(options)`.
 * A resize scales the image like the real one does. Every ref saves to its own numbered uri (`file:///saved/1.jpg`, ...).
 * `failures` makes the render, or the n-th save, reject.
 * Like the native objects, a released context or ref is gone: using it afterwards throws.
 */
function fakeManipulator(
  picked: { width: number; height: number },
  failures: { render?: boolean; saveNumber?: number } = {},
) {
  const manipulateCalls: unknown[] = [];
  const resizeCalls: unknown[] = [];
  const saves: { options: { format: string; compress: number }; uri: string }[] = [];
  const refs: FakeImage[] = [];
  const contexts: FakeContext[] = [];

  const usable = (object: { release: jest.Mock<void, []> }) => {
    if (object.release.mock.calls.length > 0) throw new Error('used after release');
  };

  const makeRef = (width: number, height: number): FakeImage => {
    const ref: FakeImage = {
      width,
      height,
      release: jest.fn(),
      saveAsync: jest.fn(async (options) => {
        usable(ref);
        if (failures.saveNumber === saves.length + 1) throw new Error('disk full');
        const uri = `file:///saved/${saves.length + 1}.jpg`;
        saves.push({ options, uri });
        return { uri, width, height };
      }),
    };
    refs.push(ref);
    return ref;
  };

  const manipulate = jest.fn((source: unknown) => {
    manipulateCalls.push(source);
    const base = typeof source === 'string' ? picked : (source as FakeImage);
    let size = { width: base.width, height: base.height };
    const context: FakeContext = {
      release: jest.fn(),
      resize: jest.fn((target: { width?: number; height?: number }) => {
        usable(context);
        resizeCalls.push(target);
        const scale = target.width ? target.width / base.width : (target.height as number) / base.height;
        size = { width: Math.round(base.width * scale), height: Math.round(base.height * scale) };
        return context;
      }),
      renderAsync: jest.fn(async () => {
        usable(context);
        if (typeof source !== 'string') usable(source as FakeImage);
        if (failures.render) throw new Error('decode failed');
        return makeRef(size.width, size.height);
      }),
    };
    contexts.push(context);
    return context as unknown as Context;
  });

  jest.mocked(ImageManipulator.manipulate).mockImplementation(manipulate);
  return { manipulateCalls, resizeCalls, saves, refs, contexts };
}

/** `File.bytes()` answers with a byte array that tells which uri it was read from. */
function fakeFiles() {
  const readUris: string[] = [];
  const bytes = jest.spyOn(File.prototype, 'bytes').mockImplementation(async function (this: File) {
    readUris.push(this.uri);
    return new Uint8Array([...this.uri].map((char) => char.charCodeAt(0)));
  });
  return { readUris, bytes };
}

const bytesOf = (uri: string) => new Uint8Array([...uri].map((char) => char.charCodeAt(0)));
const JPEG = { format: SaveFormat.JPEG, compress: 0.8 };

describe('preparePhoto', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shrinks a landscape photo to 2048 px wide and its thumbnail to 480 px wide', async () => {
    const manipulator = fakeManipulator({ width: 4032, height: 3024 });
    fakeFiles();

    await preparePhoto(PICKED_URI);

    expect(manipulator.resizeCalls).toEqual([{ width: 2048 }, { width: 480 }]);
  });

  it('shrinks a portrait photo to 2048 px tall and its thumbnail to 480 px tall', async () => {
    const manipulator = fakeManipulator({ width: 3024, height: 4032 });
    fakeFiles();

    await preparePhoto(PICKED_URI);

    expect(manipulator.resizeCalls).toEqual([{ height: 2048 }, { height: 480 }]);
  });

  it('learns the real size by rendering the picked file once, then works from that rendered image', async () => {
    const manipulator = fakeManipulator({ width: 4032, height: 3024 });
    fakeFiles();

    await preparePhoto(PICKED_URI);

    const [first, ...rest] = manipulator.manipulateCalls;
    expect(first).toBe(PICKED_URI);
    // The file and the thumbnail are both made from the first rendered image, so the original is decoded only once.
    expect(rest).toHaveLength(2);
    expect(rest[0]).toBe(manipulator.refs[0]);
    expect(rest[1]).toBe(manipulator.refs[0]);
  });

  it('does not enlarge a small photo, but still re-encodes both as JPEG (that is what drops EXIF and GPS)', async () => {
    const manipulator = fakeManipulator({ width: 400, height: 300 });
    fakeFiles();

    await preparePhoto(PICKED_URI);

    expect(manipulator.resizeCalls).toEqual([]);
    expect(manipulator.saves).toHaveLength(2);
    expect(manipulator.saves.map((save) => save.options)).toEqual([JPEG, JPEG]);
  });

  it('shrinks only the thumbnail of a photo that is between 480 and 2048 px', async () => {
    const manipulator = fakeManipulator({ width: 1600, height: 1200 });
    fakeFiles();

    await preparePhoto(PICKED_URI);

    expect(manipulator.resizeCalls).toEqual([{ width: 480 }]);
    expect(manipulator.saves).toHaveLength(2);
  });

  it('saves every output as JPEG at quality 0.8', async () => {
    const manipulator = fakeManipulator({ width: 4032, height: 3024 });
    fakeFiles();

    await preparePhoto(PICKED_URI);

    expect(manipulator.saves.map((save) => save.options)).toEqual([JPEG, JPEG]);
  });

  it('saves the file from the full-size image and the thumbnail from a 480 px one', async () => {
    const manipulator = fakeManipulator({ width: 4032, height: 3024 });
    fakeFiles();

    await preparePhoto(PICKED_URI);

    const sizes = manipulator.refs.slice(1).map((ref) => [ref.width, ref.height]);
    expect(sizes).toEqual([
      [2048, 1536],
      [480, 360],
    ]);
  });

  it('returns the bytes of the saved file and of the saved thumbnail, and the thumbnail uri', async () => {
    const manipulator = fakeManipulator({ width: 4032, height: 3024 });
    const files = fakeFiles();

    const prepared = await preparePhoto(PICKED_URI);

    const [fileSave, thumbnailSave] = manipulator.saves;
    expect(files.readUris.sort()).toEqual([fileSave.uri, thumbnailSave.uri].sort());
    expect(prepared.file).toEqual(bytesOf(fileSave.uri));
    expect(prepared.thumbnail).toEqual(bytesOf(thumbnailSave.uri));
    expect(prepared.thumbnailUri).toBe(thumbnailSave.uri);
    expect(prepared.file).not.toEqual(prepared.thumbnail);
  });

  it('never reads the picked file itself, so the original (with its EXIF) is never uploaded', async () => {
    fakeManipulator({ width: 400, height: 300 });
    const files = fakeFiles();

    await preparePhoto(PICKED_URI);

    expect(files.readUris).not.toContain(PICKED_URI);
    expect(files.readUris).toHaveLength(2);
  });

  describe('native memory', () => {
    // Up to 20 photos of 12 MP go through one after another: the decoded images must not wait for the garbage collector.
    const releasedOnce = (objects: { release: jest.Mock<void, []> }[]) =>
      objects.map((object) => object.release.mock.calls.length);

    it('releases every context and every rendered image exactly once', async () => {
      const manipulator = fakeManipulator({ width: 4032, height: 3024 });
      fakeFiles();

      await preparePhoto(PICKED_URI);

      // The picked file's render, and the shrunk file and thumbnail: three contexts, three images.
      expect(releasedOnce(manipulator.contexts)).toEqual([1, 1, 1]);
      expect(releasedOnce(manipulator.refs)).toEqual([1, 1, 1]);
    });

    it('releases the single rendered image of a small photo exactly once, after both saves', async () => {
      const manipulator = fakeManipulator({ width: 400, height: 300 });
      fakeFiles();

      await preparePhoto(PICKED_URI);

      // Saving a released image throws, so both saves (file and thumbnail) happened before the release.
      expect(manipulator.saves).toHaveLength(2);
      expect(releasedOnce(manipulator.contexts)).toEqual([1]);
      expect(releasedOnce(manipulator.refs)).toEqual([1]);
    });

    it('releases the context when the picked file cannot be rendered', async () => {
      const manipulator = fakeManipulator({ width: 4032, height: 3024 }, { render: true });
      fakeFiles();

      await expect(preparePhoto(PICKED_URI)).rejects.toThrow('decode failed');

      expect(releasedOnce(manipulator.contexts)).toEqual([1]);
      expect(manipulator.refs).toEqual([]);
    });

    it('releases everything made so far when saving the file fails', async () => {
      const manipulator = fakeManipulator({ width: 4032, height: 3024 }, { saveNumber: 1 });
      fakeFiles();

      await expect(preparePhoto(PICKED_URI)).rejects.toThrow('disk full');

      // The picked file's render and the shrunk file; the thumbnail was never started.
      expect(releasedOnce(manipulator.contexts)).toEqual([1, 1]);
      expect(releasedOnce(manipulator.refs)).toEqual([1, 1]);
    });

    it('releases everything made so far when saving the thumbnail fails', async () => {
      const manipulator = fakeManipulator({ width: 4032, height: 3024 }, { saveNumber: 2 });
      fakeFiles();

      await expect(preparePhoto(PICKED_URI)).rejects.toThrow('disk full');

      expect(releasedOnce(manipulator.contexts)).toEqual([1, 1, 1]);
      expect(releasedOnce(manipulator.refs)).toEqual([1, 1, 1]);
    });

    it('has released everything when a saved file cannot be read', async () => {
      const manipulator = fakeManipulator({ width: 4032, height: 3024 });
      jest.spyOn(File.prototype, 'bytes').mockRejectedValue(new Error('read failed'));

      await expect(preparePhoto(PICKED_URI)).rejects.toThrow('read failed');

      expect(releasedOnce(manipulator.contexts)).toEqual([1, 1, 1]);
      expect(releasedOnce(manipulator.refs)).toEqual([1, 1, 1]);
    });
  });

  it('rejects when the picked file cannot be rendered', async () => {
    fakeManipulator({ width: 4032, height: 3024 }, { render: true });
    const files = fakeFiles();

    await expect(preparePhoto(PICKED_URI)).rejects.toThrow('decode failed');
    expect(files.readUris).toEqual([]);
  });

  it('rejects when saving the file fails', async () => {
    fakeManipulator({ width: 4032, height: 3024 }, { saveNumber: 1 });
    const files = fakeFiles();

    await expect(preparePhoto(PICKED_URI)).rejects.toThrow('disk full');
    expect(files.readUris).toEqual([]);
  });

  it('rejects when saving the thumbnail fails, after the file was saved', async () => {
    fakeManipulator({ width: 4032, height: 3024 }, { saveNumber: 2 });
    fakeFiles();

    await expect(preparePhoto(PICKED_URI)).rejects.toThrow('disk full');
  });

  it('rejects when a saved file cannot be read', async () => {
    fakeManipulator({ width: 4032, height: 3024 });
    jest.spyOn(File.prototype, 'bytes').mockRejectedValue(new Error('read failed'));

    await expect(preparePhoto(PICKED_URI)).rejects.toThrow('read failed');
  });
});

describe('prepareAvatar (auth-onboarding P2)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shrinks a landscape photo to 512 px wide', async () => {
    const manipulator = fakeManipulator({ width: 2000, height: 1500 });
    fakeFiles();

    await prepareAvatar(PICKED_URI);

    expect(manipulator.resizeCalls).toEqual([{ width: 512 }]);
    expect(manipulator.refs.slice(1).map((ref) => [ref.width, ref.height])).toEqual([[512, 384]]);
  });

  it('shrinks a portrait photo to 512 px tall', async () => {
    const manipulator = fakeManipulator({ width: 1500, height: 2000 });
    fakeFiles();

    await prepareAvatar(PICKED_URI);

    expect(manipulator.resizeCalls).toEqual([{ height: 512 }]);
  });

  it('does not enlarge a small photo, but still re-encodes it as JPEG (that is what drops EXIF and GPS)', async () => {
    const manipulator = fakeManipulator({ width: 300, height: 300 });
    fakeFiles();

    await prepareAvatar(PICKED_URI);

    expect(manipulator.resizeCalls).toEqual([]);
    expect(manipulator.saves.map((save) => save.options)).toEqual([JPEG]);
  });

  it('always saves one JPEG at quality 0.8, also after a resize', async () => {
    const manipulator = fakeManipulator({ width: 2000, height: 1500 });
    fakeFiles();

    await prepareAvatar(PICKED_URI);

    expect(manipulator.saves.map((save) => save.options)).toEqual([JPEG]);
  });

  it('returns the bytes and the uri of the saved file, and never reads the picked file itself', async () => {
    const manipulator = fakeManipulator({ width: 2000, height: 1500 });
    const files = fakeFiles();

    const prepared = await prepareAvatar(PICKED_URI);

    expect(prepared.uri).toBe(manipulator.saves[0].uri);
    expect(prepared.file).toEqual(bytesOf(manipulator.saves[0].uri));
    expect(files.readUris).toEqual([manipulator.saves[0].uri]);
  });

  it('renders the picked file once to learn its real size, then works from that image', async () => {
    const manipulator = fakeManipulator({ width: 2000, height: 1500 });
    fakeFiles();

    await prepareAvatar(PICKED_URI);

    expect(manipulator.manipulateCalls).toEqual([PICKED_URI, manipulator.refs[0]]);
  });

  describe('native memory', () => {
    const releasedOnce = (objects: { release: jest.Mock<void, []> }[]) =>
      objects.map((object) => object.release.mock.calls.length);

    it('releases every context and every rendered image exactly once after a resize', async () => {
      const manipulator = fakeManipulator({ width: 2000, height: 1500 });
      fakeFiles();

      await prepareAvatar(PICKED_URI);

      expect(releasedOnce(manipulator.contexts)).toEqual([1, 1]);
      expect(releasedOnce(manipulator.refs)).toEqual([1, 1]);
    });

    it('releases the single rendered image of a small photo exactly once', async () => {
      const manipulator = fakeManipulator({ width: 300, height: 300 });
      fakeFiles();

      await prepareAvatar(PICKED_URI);

      expect(manipulator.saves).toHaveLength(1);
      expect(releasedOnce(manipulator.contexts)).toEqual([1]);
      expect(releasedOnce(manipulator.refs)).toEqual([1]);
    });

    it('releases the context when the picked file cannot be rendered', async () => {
      const manipulator = fakeManipulator({ width: 2000, height: 1500 }, { render: true });
      fakeFiles();

      await expect(prepareAvatar(PICKED_URI)).rejects.toThrow('decode failed');

      expect(releasedOnce(manipulator.contexts)).toEqual([1]);
    });

    it('releases everything made so far when saving fails', async () => {
      const manipulator = fakeManipulator({ width: 2000, height: 1500 }, { saveNumber: 1 });
      fakeFiles();

      await expect(prepareAvatar(PICKED_URI)).rejects.toThrow('disk full');

      expect(releasedOnce(manipulator.contexts)).toEqual([1, 1]);
      expect(releasedOnce(manipulator.refs)).toEqual([1, 1]);
    });

    it('has released everything when the saved file cannot be read', async () => {
      const manipulator = fakeManipulator({ width: 2000, height: 1500 });
      jest.spyOn(File.prototype, 'bytes').mockRejectedValue(new Error('read failed'));

      await expect(prepareAvatar(PICKED_URI)).rejects.toThrow('read failed');

      expect(releasedOnce(manipulator.contexts)).toEqual([1, 1]);
      expect(releasedOnce(manipulator.refs)).toEqual([1, 1]);
    });
  });
});

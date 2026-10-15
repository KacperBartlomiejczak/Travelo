import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Guards the global stand-ins in jest.setup.ts: they must accept the calls the photo code makes, written against the
// real packages' types (so a change in the real API breaks the typecheck here first).
describe('native module mocks', () => {
  it('lets a photo be resized, rendered and saved as a JPEG', async () => {
    const image = await ImageManipulator.manipulate('file:///photo.heic').resize({ width: 2048 }).renderAsync();
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    expect(saved).toEqual({ uri: expect.stringMatching(/^file:\/\//), width: image.width, height: image.height });
    expect(SaveFormat).toMatchObject({ JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' });
  });

  // Up to 20 photos of 12 MP go through one after another, so their decoded images are released by hand.
  it('lets a context and a rendered image be released', async () => {
    const context = ImageManipulator.manipulate('file:///photo.heic');
    const image = await context.renderAsync();
    const shrunk = await ImageManipulator.manipulate(image).resize({ width: 480 }).renderAsync();
    expect(() => {
      context.release();
      image.release();
      shrunk.release();
    }).not.toThrow();
  });

  it('lets the bytes of a file be read', async () => {
    const bytes = await new File('file:///photo.jpg').bytes();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });
});

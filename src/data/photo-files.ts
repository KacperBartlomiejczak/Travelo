import { File } from 'expo-file-system';
import { ImageManipulator, type ImageRef, SaveFormat } from 'expo-image-manipulator';

import { AVATAR_MAX_SIDE } from '@/lib/avatar';
import { fitWithin, PHOTO_MAX_SIDE, THUMBNAIL_MAX_SIDE } from '@/lib/trip-photos';

/** JPEG quality of the file and of the thumbnail (trip-photos D7, D14). */
const JPEG_QUALITY = 0.8;

/** Saves `image` as JPEG and returns where the new file is. */
async function saveJpeg(image: ImageRef): Promise<string> {
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return saved.uri;
}

/**
 * One output made from the rendered picked image: shrunk when its longer side is over `maxSide`, then saved as JPEG.
 * The rendered image is passed on as it is, so the picked file is decoded only once. `rendered` stays the caller's.
 */
async function makeOutput(rendered: ImageRef, maxSide: number): Promise<string> {
  const size = fitWithin(rendered.width, rendered.height, maxSide);
  if (!size) return saveJpeg(rendered);
  const context = ImageManipulator.manipulate(rendered);
  try {
    const shrunk = await context.resize(size).renderAsync();
    try {
      return await saveJpeg(shrunk);
    } finally {
      shrunk.release();
    }
  } finally {
    context.release();
  }
}

/**
 * A picked photo made ready to send (trip-photos D2, D7, D14): the file (longer side at most 2048 px) and its thumbnail
 * (at most 480 px), both never enlarged. Both are always re-encoded as JPEG, even when no resize is needed: the new file
 * carries none of the original's EXIF, so no GPS leaves the phone. The picked file itself is never read.
 * Also returns the thumbnail's local uri, so the image cache can be seeded with it.
 * Rejects when rendering, saving or reading fails.
 *
 * Every native context and image made here is released as soon as it is not needed (also when something fails): up to
 * 20 photos of 12 MP are prepared one after another, and their decoded images must not wait for the garbage collector.
 */
export async function preparePhoto(uri: string): Promise<{ file: Uint8Array; thumbnail: Uint8Array; thumbnailUri: string }> {
  let fileUri: string;
  let thumbnailUri: string;
  // The picker's width and height can be 0, so the real size comes from rendering the file once.
  const context = ImageManipulator.manipulate(uri);
  try {
    const rendered = await context.renderAsync();
    try {
      fileUri = await makeOutput(rendered, PHOTO_MAX_SIDE);
      thumbnailUri = await makeOutput(rendered, THUMBNAIL_MAX_SIDE);
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
  return {
    file: await new File(fileUri).bytes(),
    thumbnail: await new File(thumbnailUri).bytes(),
    thumbnailUri,
  };
}

/**
 * A picked profile photo made ready to send (auth-onboarding P2): longer side at most 512 px, never enlarged, always
 * re-encoded as JPEG, so the new file carries none of the original's EXIF and no GPS leaves the phone. The picked file
 * itself is never read. Also returns the saved file's uri, so the image cache can be seeded with it.
 * Rejects when rendering, saving or reading fails; every native context and image made here is released (also on failure).
 */
export async function prepareAvatar(uri: string): Promise<{ file: Uint8Array; uri: string }> {
  // The picker's width and height can be 0, so the real size comes from rendering the file once.
  const context = ImageManipulator.manipulate(uri);
  try {
    const rendered = await context.renderAsync();
    try {
      const savedUri = await makeOutput(rendered, AVATAR_MAX_SIDE);
      return { file: await new File(savedUri).bytes(), uri: savedUri };
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
}

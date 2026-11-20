import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { UnsupportedTicketFileError } from '@/data/ticket-import';
import { sniffTicketFile } from '@/lib/ticket-parse/sniff';
import { fitWithin } from '@/lib/trip-photos';
import { TICKET_MAX_BYTES, type ExtractTicketRequest } from '@/schemas';

/** Longer side of a ticket photo sent to the server (ticket-import D8). */
const TICKET_PHOTO_MAX_SIDE = 2000;
const JPEG_QUALITY = 0.8;

/** Throws the typed error when the file fails the same checks the server runs; the file contents are never logged. */
function checked(request: ExtractTicketRequest): ExtractTicketRequest {
  const sniffed = sniffTicketFile(request);
  if (!sniffed.ok) throw new UnsupportedTicketFileError(sniffed.error, sniffed.error);
  return request;
}

/** Deletes a copy the app created (picker cache, saved JPEG); D5: the ticket file is never kept. A failed delete is ignored, the OS clears the cache. */
function discard(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // Nothing to recover: the file is only a cache copy.
  }
}

/** Opens the system file picker for one PDF; `null` when closed without a choice. Rejects with `UnsupportedTicketFileError` for a wrong or too large file. */
export async function pickTicketPdf(): Promise<ExtractTicketRequest | null> {
  const result = await getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const { uri, size } = result.assets[0];
  try {
    // The reported size goes first, so a huge file is never read.
    if (size !== undefined && size > TICKET_MAX_BYTES) throw new UnsupportedTicketFileError('file_too_large', 'file_too_large');
    return checked({ mimeType: 'application/pdf', dataBase64: await new File(uri).base64() });
  } finally {
    discard(uri);
  }
}

/** Opens the gallery (no camera, Z1) for one photo, shrinks it to a JPEG and returns its base64; `null` when closed without a choice. */
export async function pickTicketPhoto(): Promise<ExtractTicketRequest | null> {
  const result = await launchImageLibraryAsync({ mediaTypes: ['images'] });
  if (result.canceled) return null;
  const context = ImageManipulator.manipulate(result.assets[0].uri);
  try {
    // The picker's width and height can be 0, so the real size comes from rendering once.
    const rendered = await context.renderAsync();
    try {
      const size = fitWithin(rendered.width, rendered.height, TICKET_PHOTO_MAX_SIDE);
      const options = { format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true };
      let saved;
      if (!size) saved = await rendered.saveAsync(options);
      else {
        const resizer = ImageManipulator.manipulate(rendered);
        try {
          const shrunk = await resizer.resize(size).renderAsync();
          try {
            saved = await shrunk.saveAsync(options);
          } finally {
            shrunk.release();
          }
        } finally {
          resizer.release();
        }
      }
      try {
        return checked({ mimeType: 'image/jpeg', dataBase64: saved.base64 ?? '' });
      } finally {
        discard(saved.uri);
      }
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
}

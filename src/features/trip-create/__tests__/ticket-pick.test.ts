import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { UnsupportedTicketFileError } from '@/data/ticket-import';
import { pickTicketPdf, pickTicketPhoto } from '@/features/trip-create/ticket-pick';
import { TICKET_MAX_BYTES } from '@/schemas';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

const getDoc = jest.mocked(getDocumentAsync);
const launch = jest.mocked(launchImageLibraryAsync);
const base64 = jest.fn();
const remove = jest.fn();
const fileUris: string[] = [];
const PDF_B64 = btoa('%PDF-1.4 hello');
const JPEG_B64 = btoa('\xff\xd8\xff\xe0 jpeg');

beforeEach(() => {
  getDoc.mockReset();
  launch.mockReset();
  base64.mockReset();
  remove.mockReset();
  fileUris.length = 0;
  jest.mocked(File).mockImplementation((uri: unknown) => {
    fileUris.push(String(uri));
    return { base64, delete: remove } as unknown as File;
  });
});

const picked = (size?: number) => ({ canceled: false as const, assets: [{ uri: 'file:///cache/t.pdf', name: 't.pdf', size, lastModified: 0 }] });

describe('pickTicketPdf', () => {
  it('asks for one PDF copied to the cache', async () => {
    getDoc.mockResolvedValue({ canceled: true, assets: null });
    await pickTicketPdf();
    expect(getDoc).toHaveBeenCalledWith({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  });

  it('gives null when cancelled', async () => {
    getDoc.mockResolvedValue({ canceled: true, assets: null });
    await expect(pickTicketPdf()).resolves.toBeNull();
  });

  it('returns the base64 and mime type of a real PDF', async () => {
    getDoc.mockResolvedValue(picked(100));
    base64.mockResolvedValue(PDF_B64);
    await expect(pickTicketPdf()).resolves.toEqual({ mimeType: 'application/pdf', dataBase64: PDF_B64 });
  });

  it('throws unsupported_file when the file is not a PDF', async () => {
    getDoc.mockResolvedValue(picked(100));
    base64.mockResolvedValue(btoa('not a pdf at all'));
    await expect(pickTicketPdf()).rejects.toMatchObject({ code: 'unsupported_file' });
    await expect(pickTicketPdf()).rejects.toBeInstanceOf(UnsupportedTicketFileError);
  });

  it('throws file_too_large from the reported size without reading the file', async () => {
    getDoc.mockResolvedValue(picked(TICKET_MAX_BYTES + 1));
    await expect(pickTicketPdf()).rejects.toMatchObject({ code: 'file_too_large' });
    expect(base64).not.toHaveBeenCalled();
  });

  it('reads a file whose size is not reported', async () => {
    getDoc.mockResolvedValue(picked(undefined));
    base64.mockResolvedValue(PDF_B64);
    await expect(pickTicketPdf()).resolves.toEqual({ mimeType: 'application/pdf', dataBase64: PDF_B64 });
  });

  it('deletes the cached copy after a successful read', async () => {
    getDoc.mockResolvedValue(picked(100));
    base64.mockResolvedValue(PDF_B64);
    await pickTicketPdf();
    expect(fileUris).toContain('file:///cache/t.pdf');
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('deletes the cached copy after a failed sniff', async () => {
    getDoc.mockResolvedValue(picked(100));
    base64.mockResolvedValue(btoa('not a pdf at all'));
    await expect(pickTicketPdf()).rejects.toMatchObject({ code: 'unsupported_file' });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('deletes the cached copy when the file is too large', async () => {
    getDoc.mockResolvedValue(picked(TICKET_MAX_BYTES + 1));
    await expect(pickTicketPdf()).rejects.toMatchObject({ code: 'file_too_large' });
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('pickTicketPhoto', () => {
  const asset = { uri: 'file:///gallery/p.jpg', width: 4000, height: 3000 };

  function mockManipulator(saved: { base64?: string; uri?: string }, side = { width: 4000, height: 3000 }) {
    const saveAsync = jest.fn(async () => ({ uri: 'file:///cache/out.jpg', ...saved }));
    const resize = jest.fn();
    const shrunk = { release: jest.fn(), saveAsync };
    const rendered = { ...side, release: jest.fn(), saveAsync };
    const context = { release: jest.fn(), resize, renderAsync: jest.fn(async () => rendered) };
    const resized = { release: jest.fn(), renderAsync: jest.fn(async () => shrunk) };
    resize.mockReturnValue(resized);
    jest.mocked(ImageManipulator.manipulate).mockReturnValue(context as never);
    return { resize, saveAsync };
  }

  it('opens the gallery for images only', async () => {
    launch.mockResolvedValue({ canceled: true, assets: null });
    await pickTicketPhoto();
    expect(launch).toHaveBeenCalledWith({ mediaTypes: ['images'] });
  });

  it('gives null when cancelled', async () => {
    launch.mockResolvedValue({ canceled: true, assets: null });
    await expect(pickTicketPhoto()).resolves.toBeNull();
  });

  it('shrinks the longer side to 2000 px, saves a JPEG and returns its base64', async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset] } as never);
    const { resize, saveAsync } = mockManipulator({ base64: JPEG_B64 });
    await expect(pickTicketPhoto()).resolves.toEqual({ mimeType: 'image/jpeg', dataBase64: JPEG_B64 });
    expect(resize).toHaveBeenCalledWith({ width: 2000 });
    expect(saveAsync).toHaveBeenCalledWith(expect.objectContaining({ format: 'jpeg', base64: true }));
  });

  it('saves without resizing when the image is already within 2000 px', async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset] } as never);
    const { resize, saveAsync } = mockManipulator({ base64: JPEG_B64 }, { width: 1500, height: 1000 });
    await expect(pickTicketPhoto()).resolves.toEqual({ mimeType: 'image/jpeg', dataBase64: JPEG_B64 });
    expect(resize).not.toHaveBeenCalled();
    expect(saveAsync).toHaveBeenCalledTimes(1);
  });

  it('deletes the saved copy but never the gallery original', async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset] } as never);
    mockManipulator({ base64: JPEG_B64 });
    await pickTicketPhoto();
    expect(fileUris).toEqual(['file:///cache/out.jpg']);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('deletes the saved copy after a failed sniff', async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset] } as never);
    mockManipulator({ base64: PDF_B64 });
    await expect(pickTicketPhoto()).rejects.toMatchObject({ code: 'unsupported_file' });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('throws unsupported_file when the result is not a JPEG', async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset] } as never);
    mockManipulator({ base64: PDF_B64 });
    await expect(pickTicketPhoto()).rejects.toMatchObject({ code: 'unsupported_file' });
  });
});

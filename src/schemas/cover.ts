import { z } from 'zod';

import { HttpUrlSchema } from './common';

/** Lowercase on purpose: a gallery cover's id becomes a Storage path, and the Storage rules accept only lowercase UUIDs. */
const LOWERCASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const COVER_PRESET_IDS = ['auckland', 'bali', 'beijing', 'jakarta', 'majorka'] as const;
export const CoverPresetIdSchema = z.enum(COVER_PRESET_IDS);
export type CoverPresetId = z.infer<typeof CoverPresetIdSchema>;

/** A stored cover: a bundled preset or a gallery cover in Storage (trip-covers D1, D5). */
export const CoverSchema = z.union([
  z.templateLiteral(['preset:', CoverPresetIdSchema]),
  z.templateLiteral(['photo:', z.string().regex(LOWERCASE_UUID)]),
]);
export type Cover = z.infer<typeof CoverSchema>;

/** The cover every trip starts with (trip-covers D7). */
export const DEFAULT_COVER = 'preset:auckland' satisfies Cover;

/** Starts and ends with a non-whitespace character, no line breaks; inner spaces are allowed (the picker's `uri` is not documented as URL-encoded). */
const PICKED_PATH = /^\S(?:[^\r\n]*\S)?$/;

/** What the picker hands over: a stored cover, or a gallery photo picked but not yet sent. */
export const CoverChoiceSchema = z.union([CoverSchema, z.templateLiteral(['file://', z.string().regex(PICKED_PATH)])]);
export type CoverChoice = z.infer<typeof CoverChoiceSchema>;

/** Signed URLs of a gallery cover, present only for `photo:` covers (the server is a boundary). */
export const CoverUrlsSchema = z.object({ url: HttpUrlSchema, thumbnailUrl: HttpUrlSchema });
export type CoverUrls = z.infer<typeof CoverUrlsSchema>;

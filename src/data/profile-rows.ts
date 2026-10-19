import { ProfileSchema, type Profile } from '@/schemas';

import type { Database } from './database.types';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

/** The signed-in user's profile from a Supabase row (auth-onboarding). Parsed with Zod: the server is a boundary. */
export function profileFromRow(row: ProfileRow): Profile {
  return ProfileSchema.parse({
    id: row.id,
    username: row.username,
    friendCode: row.friend_code,
    interests: row.interests,
    avatarId: row.avatar_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

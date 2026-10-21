import { z } from 'zod';

import { InterestTagSchema } from './interests';
import { FriendCodeSchema } from './profile';

export const DISPLAY_NAME_MAX_LENGTH = 40;

export const TripMemberSchema = z.object({
  id: z.uuid(),
  tripId: z.uuid(),
  /** null = friend without an account. */
  userId: z.string().nullable(),
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  role: z.enum(['owner', 'viewer']),
  interests: z.array(InterestTagSchema),
  // Optional until member editing exists (plan A4 in prompts/trip-create-wizard).
  budgetLevel: z.enum(['low', 'mid', 'high']).optional(),
  pace: z.enum(['relaxed', 'normal', 'intense']).optional(),
  dietaryNotes: z.string().max(200).optional(),
});
export type TripMember = z.infer<typeof TripMemberSchema>;

/**
 * A member as `create_trip` receives it (snake_case, like the database row). An account is linked only by
 * `friend_code`, which the server resolves itself; there is no `user_id` here and one sent anyway is ignored
 * (friend-invite D12).
 */
export const CreateTripMemberPayloadSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  display_name: TripMemberSchema.shape.displayName,
  role: TripMemberSchema.shape.role,
  interests: TripMemberSchema.shape.interests,
  budget_level: TripMemberSchema.shape.budgetLevel.nullish(),
  pace: TripMemberSchema.shape.pace.nullish(),
  dietary_notes: TripMemberSchema.shape.dietaryNotes.nullish(),
  /** null or absent = friend without an account. */
  friend_code: FriendCodeSchema.nullish(),
});
export type CreateTripMemberPayload = z.infer<typeof CreateTripMemberPayloadSchema>;

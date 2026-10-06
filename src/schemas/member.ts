import { z } from 'zod';

import { InterestTagSchema } from './interests';

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

import type { CreatedTrip } from '@/data/trip-repository';
import {
  FlightSegmentSchema,
  TripListItemSchema,
  TripMemberSchema,
  TripOverviewSchema,
  TripSummarySchema,
  type FlightDirection,
  type FlightSegment,
  type TripListItem,
  type TripMember,
  type TripOverview,
} from '@/schemas';

import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
export type TripRow = Tables['trips']['Row'];
export type MemberRow = Tables['trip_members']['Row'];
export type SegmentRow = Tables['flight_segments']['Row'];
export type CreateTripArgs = Database['public']['Functions']['create_trip']['Args'];
/** The columns the side panel's query selects (trips-drawer D4). */
export type TripListRow = Pick<TripRow, 'id' | 'name' | 'cover_image_uri' | 'start_date' | 'end_date'>;

/** The owner is always the caller (`create_trip` sets it), so it is not sent. */
type TripPayload = Omit<Tables['trips']['Insert'], 'owner_id'>;
type MemberPayload = Tables['trip_members']['Insert'];
type SegmentPayload = Tables['flight_segments']['Insert'];

/** The arguments of `public.create_trip` for a trip built from the wizard. */
export function toCreateTripArgs({ trip, members, segments }: CreatedTrip): CreateTripArgs {
  const tripPayload: TripPayload = {
    id: trip.id,
    name: trip.name,
    cover_image_uri: trip.coverImageUri ?? null,
    destination: trip.destination,
    start_date: trip.startDate,
    end_date: trip.endDate,
    base_currency: trip.baseCurrency,
    budget_per_person_minor: trip.budgetPerPerson.amountMinor,
    budget_updated_at: trip.budgetUpdatedAt,
    created_at: trip.createdAt,
  };
  const memberPayloads = members.map(
    (member): MemberPayload => ({
      id: member.id,
      trip_id: member.tripId,
      user_id: member.userId,
      display_name: member.displayName,
      role: member.role,
      interests: member.interests,
      budget_level: member.budgetLevel ?? null,
      pace: member.pace ?? null,
      dietary_notes: member.dietaryNotes ?? null,
    }),
  );
  const segmentPayloads = segments.map(
    (segment): SegmentPayload => ({
      id: segment.id,
      trip_id: segment.tripId,
      direction: segment.direction,
      position: segment.order,
      flight_number: segment.flightNumber ?? null,
      from_iata: segment.fromIata,
      to_iata: segment.toIata,
      depart_at: segment.departAt,
      depart_tz: segment.departTz,
      arrive_at: segment.arriveAt,
      arrive_tz: segment.arriveTz,
    }),
  );
  return { trip: tripPayload, members: memberPayloads, segments: segmentPayloads };
}

const DIRECTION_ORDER: Record<FlightDirection, number> = { outbound: 0, return: 1, internal: 2 };

function memberFromRow(row: MemberRow): TripMember {
  return TripMemberSchema.parse({
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    interests: row.interests,
    ...(row.budget_level !== null ? { budgetLevel: row.budget_level } : {}),
    ...(row.pace !== null ? { pace: row.pace } : {}),
    ...(row.dietary_notes !== null ? { dietaryNotes: row.dietary_notes } : {}),
  });
}

function segmentFromRow(row: SegmentRow): FlightSegment {
  return FlightSegmentSchema.parse({
    id: row.id,
    tripId: row.trip_id,
    direction: row.direction,
    order: row.position,
    ...(row.flight_number !== null ? { flightNumber: row.flight_number } : {}),
    fromIata: row.from_iata,
    toIata: row.to_iata,
    departAt: row.depart_at,
    departTz: row.depart_tz,
    arriveAt: row.arrive_at,
    arriveTz: row.arrive_tz,
  });
}

/** One trip as the home screen shows it, from Supabase rows. Every row is parsed with its Zod schema. */
export function overviewFromRows(tripRow: TripRow, memberRows: MemberRow[], segmentRows: SegmentRow[]): TripOverview {
  const members = memberRows.map(memberFromRow).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const segments = segmentRows
    .map(segmentFromRow)
    .sort((a, b) => DIRECTION_ORDER[a.direction] - DIRECTION_ORDER[b.direction] || a.order - b.order);
  const trip = TripSummarySchema.parse({
    id: tripRow.id,
    ownerId: tripRow.owner_id,
    name: tripRow.name,
    ...(tripRow.cover_image_uri !== null ? { coverImageUri: tripRow.cover_image_uri } : {}),
    destination: tripRow.destination,
    startDate: tripRow.start_date,
    endDate: tripRow.end_date,
    baseCurrency: tripRow.base_currency,
    budgetPerPerson: { amountMinor: tripRow.budget_per_person_minor, currency: tripRow.base_currency },
    createdAt: tripRow.created_at,
    budgetUpdatedAt: tripRow.budget_updated_at,
    // The organizer is not a member row (trips-supabase A4).
    travellerCount: members.length + 1,
  });
  return TripOverviewSchema.parse({ trip, members, segments });
}

/** One trip for the side panel, from the columns `list()` selects (trips-drawer D4). Parsed with Zod. */
export function listItemFromRow(row: TripListRow): TripListItem {
  return TripListItemSchema.parse({
    id: row.id,
    name: row.name,
    ...(row.cover_image_uri !== null ? { coverImageUri: row.cover_image_uri } : {}),
    startDate: row.start_date,
    endDate: row.end_date,
  });
}

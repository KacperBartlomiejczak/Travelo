# Travelo

A trip planner for the one person who organizes a trip for a group of friends.

## People

**Organizer**:
The person who uses the app, creates the trip and owns it.
_Avoid_: Owner (in conversation), admin, host

**Friend**:
A person travelling with the organizer, entered by name and interests; has no account.
_Avoid_: Guest (in UI copy), participant

**Companion count**:
How many friends fly with the organizer; zero means the organizer travels alone.
_Avoid_: Group size, people count

**Traveller**:
Anyone on the trip: the organizer or a friend. Traveller count = companion count + 1.
_Avoid_: Passenger, person

**Member**:
A traveller recorded on a trip, either a friend without an account or a linked user who follows the plan read-only.
_Avoid_: Participant, user (for friends)

**Interest**:
One thing a traveller likes doing on a trip (e.g. nightlife, museums), from a fixed list grouped into interest groups.
_Avoid_: Hobby, preference, tag (in UI copy)

## Trip

**Trip**:
One journey of the group to one destination, with dates, a budget and flights.
_Avoid_: Journey, travel, vacation

**Trip name**:
The organizer's name for a trip; by default the city the outbound starts from and the destination city ("Kraków → Barcelona").
_Avoid_: Title, label

**Cover photo**:
An optional picture the organizer chooses to represent a trip.
_Avoid_: Thumbnail, background, banner

**Nearest trip**:
The trip with the soonest start date; the one the home screen is about.
_Avoid_: Next trip, current trip, upcoming trip

**Destination**:
The airport where the outbound flight finally lands; its country sets the default currency.
_Avoid_: Target, location

**Budget per person**:
How much each traveller intends to spend on the whole trip, in the trip's base currency.
_Avoid_: Daily budget (that is derived from it), allowance

**Base currency**:
The currency the trip's budget is kept in; defaults to the destination country's currency.
_Avoid_: Home currency, main currency

## Flights

**Flight segment**:
One take-off and one landing, between two airports.
_Avoid_: Leg, hop

**Outbound** / **Return**:
The chain of segments from home to the destination / from the destination back home.
_Avoid_: Departure flight, way back

**Layover**:
The time on the ground between two consecutive segments of the same direction; always derived, never entered.
_Avoid_: Stopover, connection, transfer

## Offline

**Budget change**:
A new budget per person the organizer sets on an existing trip; it can be made without internet and reaches the server later. The newest change wins.
_Avoid_: Budget edit, limit update

**Sync status**:
Whether a change made on the phone has reached the server: synced, pending (waiting) or failed (will be retried).
_Avoid_: Upload state, saved/unsaved

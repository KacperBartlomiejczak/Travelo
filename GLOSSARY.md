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

**Destination**:
The airport where the outbound flight finally lands; its city names the trip and its country sets the default currency.
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

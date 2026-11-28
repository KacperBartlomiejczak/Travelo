import type { PlanPersonRef, TripMember } from '@/schemas';

export type PlanPersonView = { key: string; name: string; photoUri?: string };

/** Resolves plan `forPeople` refs to display people; only the signed-in user's own photo is shown. */
export function planPeopleView(
  forPeople: readonly PlanPersonRef[],
  ctx: {
    ownerId: string;
    organizerName: string;
    members: readonly Pick<TripMember, 'id' | 'userId' | 'displayName'>[];
    myUserId: string | null;
    myPhotoUri?: string;
  },
): PlanPersonView[] {
  const out: PlanPersonView[] = [];
  const seen = new Set<string>();
  const withPhoto = (view: PlanPersonView, isMe: boolean): PlanPersonView =>
    isMe && ctx.myPhotoUri ? { ...view, photoUri: ctx.myPhotoUri } : view;

  for (const ref of forPeople) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    if (ref === 'owner') {
      out.push(
        withPhoto(
          { key: 'owner', name: ctx.organizerName },
          ctx.myUserId !== null && ctx.myUserId === ctx.ownerId,
        ),
      );
      continue;
    }
    const m = ctx.members.find((x) => x.id === ref);
    if (!m) continue;
    out.push(
      withPhoto(
        { key: m.id, name: m.displayName },
        m.userId !== null && m.userId === ctx.myUserId,
      ),
    );
  }
  return out;
}

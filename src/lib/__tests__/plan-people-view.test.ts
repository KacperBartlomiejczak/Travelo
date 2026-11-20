import { planPeopleView } from '../plan-people-view';

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const GUEST = '33333333-3333-4333-8333-333333333333';

const ctx = {
  ownerId: 'user-owner',
  organizerName: 'Kacper',
  members: [
    { id: M1, userId: 'user-linked', displayName: 'Ola' },
    { id: M2, userId: null, displayName: 'Bob' },
  ],
  myUserId: 'user-owner' as string | null,
  myPhotoUri: 'file://me.jpg' as string | undefined,
};

describe('planPeopleView', () => {
  it('owner gets the photo when signed in as owner', () => {
    expect(planPeopleView(['owner'], ctx)).toEqual([
      { key: 'owner', name: 'Kacper', photoUri: 'file://me.jpg' },
    ]);
  });

  it('owner has no photo key when viewer is not the owner', () => {
    expect(planPeopleView(['owner'], { ...ctx, myUserId: 'user-linked' })).toEqual([
      { key: 'owner', name: 'Kacper' },
    ]);
  });

  it('owner has no photo key when no photo exists', () => {
    expect(planPeopleView(['owner'], { ...ctx, myPhotoUri: undefined })).toEqual([
      { key: 'owner', name: 'Kacper' },
    ]);
  });

  it('member gets the photo only when it is the signed-in user', () => {
    const out = planPeopleView([M1, M2], { ...ctx, myUserId: 'user-linked' });
    expect(out).toEqual([
      { key: M1, name: 'Ola', photoUri: 'file://me.jpg' },
      { key: M2, name: 'Bob' },
    ]);
  });

  it('guest member never gets a photo even when myUserId is null', () => {
    expect(planPeopleView([M2], { ...ctx, myUserId: null })).toEqual([{ key: M2, name: 'Bob' }]);
  });

  it('skips unknown uuids, dedupes, keeps order', () => {
    expect(planPeopleView([M2, GUEST, 'owner', M2, 'owner'], ctx)).toEqual([
      { key: M2, name: 'Bob' },
      { key: 'owner', name: 'Kacper', photoUri: 'file://me.jpg' },
    ]);
  });
});

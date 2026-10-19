import { AVATAR_MAX_SIDE, avatarPath } from '@/lib/avatar';

describe('avatar', () => {
  it('shrinks the longer side to 512 px (auth-onboarding P2)', () => {
    expect(AVATAR_MAX_SIDE).toBe(512);
  });

  it('keeps the file at <userId>/<avatarId>.jpg in the avatars bucket', () => {
    expect(avatarPath('9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d', '6a5d3b0e-2f98-4c0a-b1aa-7e1d5e3d7f06')).toBe(
      '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d/6a5d3b0e-2f98-4c0a-b1aa-7e1d5e3d7f06.jpg',
    );
  });
});

import { act, renderHook } from '@testing-library/react-native';

import { useSignOut } from '../useSignOut';

const mockSignOut = jest.fn<Promise<void>, []>();
jest.mock('@/providers/Session', () => ({ useSession: () => ({ state: { status: 'signedIn', userId: null }, retry: jest.fn(), signOut: mockSignOut }) }));

beforeEach(() => mockSignOut.mockReset());

describe('useSignOut (profile-screen D16)', () => {
  it('signs out once even when called twice before the first call has finished', async () => {
    let finish: () => void = () => {};
    mockSignOut.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = await renderHook(() => useSignOut());
    await act(async () => {
      void result.current.signOut();
      void result.current.signOut();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    await act(async () => finish());
  });

  it('stays pending after a success: the gate takes the screen away, the button must not flash enabled', async () => {
    mockSignOut.mockResolvedValue();
    const { result } = await renderHook(() => useSignOut());
    await act(async () => result.current.signOut());
    expect(result.current.pending).toBe(true);
    await act(async () => result.current.signOut());
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('a rejection is swallowed and not pending any more, so a user who is still signed in can try again', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('network request failed')).mockResolvedValueOnce();
    const { result } = await renderHook(() => useSignOut());
    await act(async () => result.current.signOut());
    expect(result.current.pending).toBe(false);
    await act(async () => result.current.signOut());
    expect(mockSignOut).toHaveBeenCalledTimes(2);
    expect(result.current.pending).toBe(true);
  });
});

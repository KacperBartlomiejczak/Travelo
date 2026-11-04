import { act, renderHook } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { usePickAvatar } from '../usePickAvatar';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const launch = jest.mocked(launchImageLibraryAsync);

const picked = (uri: string) => ({ canceled: false, assets: [{ uri }] }) as Awaited<ReturnType<typeof launchImageLibraryAsync>>;
const cancelled = { canceled: true, assets: null } as Awaited<ReturnType<typeof launchImageLibraryAsync>>;

async function setup() {
  const onPick = jest.fn();
  const onError = jest.fn();
  const { result } = await renderHook(() => usePickAvatar({ onPick, onError }));
  return { onPick, onError, call: () => result.current(), pick: () => act(async () => result.current()) };
}

beforeEach(() => launch.mockReset());

describe('usePickAvatar', () => {
  it('opens the gallery for one square-cropped image and hands the picked file uri on', async () => {
    launch.mockResolvedValue(picked('file:///a.jpg'));
    const { onPick, onError, pick } = await setup();
    await pick();
    expect(launch).toHaveBeenCalledWith({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] });
    expect(onPick).toHaveBeenCalledWith('file:///a.jpg');
    expect(onError).not.toHaveBeenCalled();
  });

  it('does nothing when the gallery is cancelled', async () => {
    launch.mockResolvedValue(cancelled);
    const { onPick, onError, pick } = await setup();
    await pick();
    expect(onPick).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports an error for a uri that is not a local file', async () => {
    launch.mockResolvedValue(picked('https://example.com/a.jpg'));
    const { onPick, onError, pick } = await setup();
    await pick();
    expect(onPick).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reports an error when the gallery cannot be opened', async () => {
    launch.mockRejectedValue(new Error('denied'));
    const { onPick, onError, pick } = await setup();
    await pick();
    expect(onPick).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('opens the gallery once for two calls in the same moment, and again after it closed', async () => {
    let close: (result: Awaited<ReturnType<typeof launchImageLibraryAsync>>) => void = () => {};
    launch.mockImplementation(() => new Promise((resolve) => (close = resolve)));
    const { call, pick } = await setup();
    await act(async () => {
      void call();
      void call();
    });
    expect(launch).toHaveBeenCalledTimes(1);
    await act(async () => close(cancelled));
    launch.mockResolvedValue(cancelled);
    await pick();
    expect(launch).toHaveBeenCalledTimes(2);
  });
});

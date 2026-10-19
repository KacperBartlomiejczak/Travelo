import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';

type Deferred = { promise: Promise<boolean>; resolve: (value: boolean) => void; reject: (reason: Error) => void };

function deferred(): Deferred {
  let resolve: Deferred['resolve'] = () => {};
  let reject: Deferred['reject'] = () => {};
  const promise = new Promise<boolean>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A controllable stand-in for the system: the answer to the first question, and the `reduceMotionChanged` listener. */
function stubSystem(answer: Promise<boolean>) {
  const remove = jest.fn();
  let emit: (enabled: boolean) => void = () => {};
  const isEnabled = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(answer);
  // The overloads of addEventListener are per event name; the stand-in only serves 'reduceMotionChanged'.
  const addListener = jest.fn((_event: string, handler: (enabled: boolean) => void) => {
    emit = handler;
    return { remove };
  });
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(addListener as unknown as typeof AccessibilityInfo.addEventListener);
  return { isEnabled, addListener, remove, change: (enabled: boolean) => emit(enabled) };
}

afterEach(() => {
  // React Native's Jest setup already mocks AccessibilityInfo, so restoring is not enough: forget the calls too.
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('useReduceMotion', () => {
  it('is null until the system answers', async () => {
    const answer = deferred();
    stubSystem(answer.promise);
    const { result } = await renderHook(() => useReduceMotion());
    expect(result.current).toBeNull();
    await act(async () => answer.resolve(false));
    expect(result.current).toBe(false);
  });

  it('follows the answer of the system: true, and false', async () => {
    stubSystem(Promise.resolve(true));
    const on = await renderHook(() => useReduceMotion());
    await waitFor(() => expect(on.result.current).toBe(true));

    stubSystem(Promise.resolve(false));
    const off = await renderHook(() => useReduceMotion());
    await waitFor(() => expect(off.result.current).toBe(false));
  });

  it('follows a reduceMotionChanged event: false, then true, then false', async () => {
    const system = stubSystem(Promise.resolve(false));
    const { result } = await renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(false));
    await act(async () => system.change(true));
    expect(result.current).toBe(true);
    await act(async () => system.change(false));
    expect(result.current).toBe(false);
  });

  it('is true when the system cannot answer (the call rejects)', async () => {
    stubSystem(Promise.reject(new Error('no native module')));
    const { result } = await renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('still follows a change event after the system failed to answer', async () => {
    const system = stubSystem(Promise.reject(new Error('no native module')));
    const { result } = await renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(true));
    await act(async () => system.change(false));
    expect(result.current).toBe(false);
  });

  it('removes its listener when it unmounts', async () => {
    const system = stubSystem(Promise.resolve(false));
    const { unmount } = await renderHook(() => useReduceMotion());
    expect(system.remove).not.toHaveBeenCalled();
    await unmount();
    expect(system.remove).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an answer', (answer: Deferred) => answer.resolve(true)],
    ['a failure', (answer: Deferred) => answer.reject(new Error('no native module'))],
  ])('ignores %s that arrives after it unmounted', async (_name, settle) => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const answer = deferred();
    stubSystem(answer.promise);
    const { result, unmount } = await renderHook(() => useReduceMotion());
    await unmount();
    await act(async () => settle(answer));
    expect(result.current).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('asks and subscribes once per mount, not on every render', async () => {
    const system = stubSystem(Promise.resolve(false));
    const { rerender } = await renderHook(() => useReduceMotion());
    await rerender({});
    await rerender({});
    await rerender({});
    expect(system.isEnabled).toHaveBeenCalledTimes(1);
    expect(system.addListener).toHaveBeenCalledTimes(1);
    expect(system.addListener).toHaveBeenCalledWith('reduceMotionChanged', expect.any(Function));
  });
});

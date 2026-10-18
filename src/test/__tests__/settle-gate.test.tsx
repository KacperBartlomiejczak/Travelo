import { useFonts } from 'expo-font';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import RootLayout from '@/app/_layout';
import { allowGateToStayLoading } from '@/test/settle-gate';
import { useFakeAppSession } from '@/test/fake-session-source';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

const routes = { _layout: RootLayout, '(drawer)/(tabs)/index': () => <Text>home screen</Text>, '(drawer)/_layout': () => null };

// The test helper that makes route tests wait for the sign-in gate (jest.setup.ts). If the gate never gets going, a test must
// fail loudly, not pass on "nothing is shown" assertions.
describe('settle-gate (test helper)', () => {
  it('waits for the gate, so the home screen is there right after renderRouter', async () => {
    await renderRouter(routes);
    expect(screen.queryByTestId('app-loading')).toBeNull();
  });

  it('fails the test when the gate is still loading after the wait (a stuck session must not look like an empty screen)', async () => {
    useFakeAppSession({ status: 'signedIn', userId: null }).holdCurrent();
    await expect(renderRouter(routes)).rejects.toThrow(/gate is still loading/);
  });

  it('lets a test that holds the gate on purpose look at the loading state', async () => {
    useFakeAppSession({ status: 'signedIn', userId: null }).holdCurrent();
    allowGateToStayLoading();
    await renderRouter(routes);
    expect(screen.getByTestId('app-loading')).toBeTruthy();
  });

  it('the permission does not leak into the next test', async () => {
    useFakeAppSession({ status: 'signedIn', userId: null }).holdCurrent();
    await expect(renderRouter(routes)).rejects.toThrow(/gate is still loading/);
  });
});

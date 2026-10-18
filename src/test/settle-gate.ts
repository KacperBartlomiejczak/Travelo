/**
 * Route tests render the real root layout, whose gate (auth-onboarding step 5) reads the session and the profile before it
 * shows any screen. `renderRouter` only waits for the first render, so this wraps it to also wait until the gate has left its
 * blank "loading" view, and FAILS the test when it has not: otherwise "nothing is shown" assertions would pass on a stuck gate.
 * A test that holds the session or the clear on purpose, to look at the loading state, says so with `allowGateToStayLoading()`.
 * Installed for every test file by jest.setup.ts (which also calls `resetGateAllowance` after each test).
 */
type TestingLibrary = typeof import('expo-router/testing-library');

let stayLoadingAllowed = false;

/** The current test holds the gate in its loading view on purpose; `renderRouter` then does not fail when it stays there. */
export function allowGateToStayLoading(): void {
  stayLoadingAllowed = true;
}

export function resetGateAllowance(): void {
  stayLoadingAllowed = false;
}

export function settleGateAfterRender(testingLibrary: TestingLibrary): void {
  const original = testingLibrary.renderRouter;
  const settling: typeof original = (...args) => {
    const rendered = original(...args);
    const settled = Promise.resolve(rendered).then(async (result) => {
      try {
        await testingLibrary.waitFor(() => expect(testingLibrary.screen.queryByTestId('app-loading')).toBeNull(), { timeout: 200 });
      } catch {
        if (!stayLoadingAllowed) {
          throw new Error(
            'The sign-in gate is still loading after renderRouter: the session or the profile never resolved. ' +
              'If the test holds it on purpose, call allowGateToStayLoading() from @/test/settle-gate.',
          );
        }
      }
      return result;
    });
    // `getPathname`, `getSegments`, ... are on the promise renderRouter returns, and tests call them on it.
    return Object.assign(settled, rendered);
  };
  testingLibrary.renderRouter = settling;
}

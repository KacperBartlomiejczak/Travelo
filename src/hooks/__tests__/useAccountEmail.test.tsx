import { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAccountEmail } from '@/hooks/useAccountEmail';
import { AppProviders } from '@/providers/AppProviders';
import { createFakeSessionSource } from '@/test/fake-session-source';

function wrapperFor(session: ReturnType<typeof createFakeSessionSource>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={client} sessionSource={session.source}>
      {children}
    </AppProviders>
  );
  return Wrapper;
}

describe('useAccountEmail', () => {
  it('returns the e-mail of the signed-in account', async () => {
    const session = createFakeSessionSource();
    session.setEmail('kacper@example.com');
    const { result } = await renderHook(() => useAccountEmail(), { wrapper: wrapperFor(session) });
    await waitFor(() => expect(result.current).toBe('kacper@example.com'));
  });

  it('returns null when the session has no readable e-mail', async () => {
    const session = createFakeSessionSource();
    session.setEmail(null);
    const email = jest.spyOn(session.source, 'email');
    const { result } = await renderHook(() => useAccountEmail(), { wrapper: wrapperFor(session) });
    await waitFor(() => expect(email).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('does not read anything while signed out', async () => {
    const session = createFakeSessionSource({ status: 'signedOut' });
    session.setEmail('kacper@example.com');
    const email = jest.spyOn(session.source, 'email');
    const { result } = await renderHook(() => useAccountEmail(), { wrapper: wrapperFor(session) });
    await waitFor(() => expect(session.clearUserData).toHaveBeenCalled());
    expect(email).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });
});

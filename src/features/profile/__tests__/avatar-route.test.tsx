import { render, waitFor } from '@testing-library/react-native';

import AvatarScreen from '@/app/avatar';

const mockParams: { uri?: string; avatarId?: string } = {};
let mockSeen: string | undefined;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/features/profile/AvatarViewer', () => ({
  AvatarViewer: (props: { fallbackUri?: string }) => {
    mockSeen = props.fallbackUri;
    return null;
  },
}));
jest.mock('@/theme/legacy/useTheme', () => ({
  DarkThemeScope: ({ children }: { children: React.ReactNode }) => children,
}));

const SUPABASE = 'https://project.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE;

beforeEach(() => {
  mockSeen = 'unrendered';
});

describe('avatar route fallback uri', () => {
  it('drops a foreign origin', async () => {
    mockParams.uri = 'https://evil.example/x.png';
    render(<AvatarScreen />);
    await waitFor(() => expect(mockSeen).not.toBe('unrendered'));
    expect(mockSeen).toBeUndefined();
  });

  it('keeps a URL on the Supabase origin', async () => {
    mockParams.uri = `${SUPABASE}/storage/v1/object/sign/avatars/a.png?token=t`;
    render(<AvatarScreen />);
    await waitFor(() => expect(mockSeen).not.toBe('unrendered'));
    expect(mockSeen).toBe(mockParams.uri);
  });

  it('drops garbage', async () => {
    mockParams.uri = 'not a url';
    render(<AvatarScreen />);
    await waitFor(() => expect(mockSeen).not.toBe('unrendered'));
    expect(mockSeen).toBeUndefined();
  });
});

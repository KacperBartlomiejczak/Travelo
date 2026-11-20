// @ts-expect-error react-dom ships no types here and @types/react-dom is not a dependency (no new deps allowed)
import { renderToString } from 'react-dom/server';

import { readThemePreference } from '@/data/preferences';
import { useThemePreference } from '../themePreference';

jest.mock('@/data/preferences', () => ({ readThemePreference: jest.fn(() => 'dark') }));

function Probe() {
  return <>{useThemePreference()}</>;
}

describe('useThemePreference on the server', () => {
  it('renders to string with the system default and never reads storage', () => {
    let html = '';
    expect(() => {
      html = renderToString(<Probe />);
    }).not.toThrow();
    expect(html).toContain('system');
    expect(readThemePreference).not.toHaveBeenCalled();
  });
});

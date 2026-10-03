import { useFonts } from 'expo-font';
import { renderRouter } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import NewTripScreen from '@/app/trips/new';
import i18n from '@/i18n';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

function renderNewTrip() {
  return renderRouter(
    {
      _layout: RootLayout,
      index: () => null,
      'trips/new': NewTripScreen,
    },
    { initialUrl: '/trips/new' },
  );
}

// The native Stack header is not a <Text> element in Jest, so the title is read from its config.
function headerConfigs(container: Awaited<ReturnType<typeof renderNewTrip>>['container']) {
  return container.queryAll((node) => node.type === 'RNSScreenStackHeaderConfig');
}

function headerTitles(container: Awaited<ReturnType<typeof renderNewTrip>>['container']) {
  return headerConfigs(container).map((node) => node.props.title);
}

describe('New trip screen', () => {
  it('shows the Polish title', async () => {
    await i18n.changeLanguage('pl');
    const { container } = await renderNewTrip();
    expect(headerTitles(container)).toEqual(['Nowa podróż']);
  });

  it('shows the English title', async () => {
    await i18n.changeLanguage('en');
    const { container } = await renderNewTrip();
    expect(headerTitles(container)).toEqual(['New trip']);
  });

  it('labels the back button with the trips list title, not the route name', async () => {
    await i18n.changeLanguage('pl');
    const { container } = await renderNewTrip();
    expect(headerConfigs(container).map((node) => node.props.backTitle)).toEqual(['Twoje podróże']);
  });
});

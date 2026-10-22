import { router, usePathname } from 'expo-router';
import { Drawer, useDrawerStatus, type DrawerContentComponentProps } from 'expo-router/drawer';
import { useTranslation } from 'react-i18next';
import { Platform, useWindowDimensions, View } from 'react-native';

import { TripsDrawer } from '@/features/drawer/TripsDrawer';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// trips-drawer P1: the panel takes 85 % of the screen, up to `components.drawer.maxWidth`.
const PANEL_SHARE = 0.85;

// The scrim behind the panel is the bottom sheet's: black at `backdropOpacity` (A6). The drawer library animates the overlay's own
// opacity, so the 0.48 goes into the colour's alpha channel (#RRGGBBAA).
const SCRIM = tokens.primitives.pure.black + Math.round(tokens.components.bottomSheet.backdropOpacity * 255).toString(16).padStart(2, '0');

// The home screen sits in a drawer: a side panel slides in from the left with all trips (trips-drawer).
// The wizard stays in the root stack above the drawer and shows no panel. The four other pill screens sit in the drawer
// too, but only the home path "/" has the menu button, so the edge swipe is limited to it (pill-nav-and-dialog R3).
// The panel still opens over the pill: the tabs are the drawer's child.
// The panel follows the system theme (A7), like a bottom sheet: elevated surface over the scrim.
export default function DrawerLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const onHome = usePathname() === '/';
  return (
    <Drawer
      drawerContent={(props) => <Panel {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        // The library's own default is off on the web; keep it.
        swipeEnabled: Platform.OS !== 'web' && onHome,
        drawerStyle: {
          width: Math.min(width * PANEL_SHARE, tokens.components.drawer.maxWidth),
          backgroundColor: theme.surface.elevated,
          borderTopRightRadius: tokens.radii.xl,
          borderBottomRightRadius: tokens.radii.xl,
          overflow: 'hidden',
        },
        overlayColor: SCRIM,
        overlayAccessibilityLabel: t('common.close'),
      }}
    />
  );
}

// Hidden from screen readers while the panel is closed, from the navigation state. On a device the drawer library
// does the same through animated props; Jest's Reanimated mock does not apply those, so without this the closed
// panel's content would count as visible in tests.
function Panel({ navigation }: DrawerContentComponentProps) {
  const open = useDrawerStatus() === 'open';
  return (
    <View testID="drawer-panel" style={{ flex: 1 }} aria-hidden={!open}>
      <TripsDrawer
        onClose={() => navigation.closeDrawer()}
        onCreate={() => {
          navigation.closeDrawer();
          router.push('/trips/new');
        }}
      />
    </View>
  );
}

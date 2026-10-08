import { router } from 'expo-router';
import { Drawer, useDrawerStatus, type DrawerContentComponentProps } from 'expo-router/drawer';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';

import { TripsDrawer } from '@/features/drawer/TripsDrawer';
import { useTheme } from '@/theme/useTheme';

// trips-drawer P1: the panel takes 85 % of the screen, up to `size.drawerMaxWidth`.
const PANEL_SHARE = 0.85;

// The home screen sits in a drawer: a side panel slides in from the left with all trips (trips-drawer).
// The wizard stays in the root stack above it, so the edge swipe works only on the home screen (A8).
// The panel follows the system theme (A7), like a bottom sheet: elevated surface over the scrim.
export default function DrawerLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  return (
    <Drawer
      drawerContent={(props) => <Panel {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          width: Math.min(width * PANEL_SHARE, theme.size.drawerMaxWidth),
          backgroundColor: theme.colors.surface.elevated,
          borderTopRightRadius: theme.radius.xl,
          borderBottomRightRadius: theme.radius.xl,
          overflow: 'hidden',
        },
        overlayColor: theme.colors.overlay.scrim,
        overlayAccessibilityLabel: t('common.close'),
      }}
    />
  );
}

// Hidden from screen readers as soon as the panel is closed; the drawer library does it only once the slide ends.
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

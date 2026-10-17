import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { PillNav } from '@/components/PillNav';
import { NAV_TABS } from '@/features/nav/tabs';

// The five main screens, switched by the floating pill (pill-nav-and-dialog). The bar is absolutely positioned, so it
// takes no layout space: the screens fill the whole height and the pill floats over them. Screens stay mounted when
// blurred (the home screen's photo upload queue relies on it); each is created the first time it is opened (`lazy`).
// The Drawer is the parent, so the side panel slides over the pill.
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <PillTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {NAV_TABS.map(({ key }) => (
        <Tabs.Screen key={key} name={key} />
      ))}
    </Tabs>
  );
}

// Same press handling as the default bar: `tabPress` listeners can prevent the switch, and the focused item does nothing.
function PillTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const items = NAV_TABS.map(({ key, labelKey, Icon }) => ({ key, label: t(labelKey), Icon }));
  const select = (key: string) => {
    const route = state.routes.find((candidate) => candidate.name === key);
    if (!route) return;
    const focused = state.routes[state.index].key === route.key;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  };
  return <PillNav items={items} activeKey={state.routes[state.index].name} onSelect={select} />;
}

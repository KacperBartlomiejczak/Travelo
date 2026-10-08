import { Drawer } from 'expo-router/drawer';

// The home screen sits in a drawer: a side panel slides in from the left with all trips (trips-drawer).
// The wizard stays in the root stack above it, so the edge swipe works only on the home screen (A8).
export default function DrawerLayout() {
  // The panel's content and look arrive with the trips list (step 7).
  return <Drawer screenOptions={{ headerShown: false }} drawerContent={() => null} />;
}

import { getDrawerStatusFromState } from 'expo-router/drawer';

type NavigationState = { type?: string; routes: { state?: NavigationState }[] };

function findDrawer(state: NavigationState | undefined): NavigationState | undefined {
  if (!state) return undefined;
  if (state.type === 'drawer') return state;
  for (const route of state.routes) {
    const found = findDrawer(route.state);
    if (found) return found;
  }
  return undefined;
}

/**
 * Whether the side panel is open, read from the router state that `renderRouter` exposes. A drawer that has not
 * been acted on yet has no state of its own there, which means closed. Tests only.
 */
export function drawerStatus(rendered: { getRouterState(): unknown }): 'open' | 'closed' {
  const drawer = findDrawer(rendered.getRouterState() as NavigationState | undefined);
  if (!drawer) return 'closed';
  return getDrawerStatusFromState(drawer as Parameters<typeof getDrawerStatusFromState>[0]);
}

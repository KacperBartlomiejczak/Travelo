import { CalendarDays, CircleUser, Plane, Receipt, type LucideIcon } from 'lucide-react-native';

type NavTab = { key: string; labelKey: string; Icon: LucideIcon };

// The four screens of the pill navigation, in order (pill-nav-and-dialog A7). `key` is the route name
// inside `(drawer)/(tabs)`.
export const NAV_TABS = [
  { key: 'index', labelKey: 'nav.trip', Icon: Plane },
  { key: 'expenses', labelKey: 'nav.expenses', Icon: Receipt },
  { key: 'plan', labelKey: 'nav.plan', Icon: CalendarDays },
  { key: 'profile', labelKey: 'nav.profile', Icon: CircleUser },
] as const satisfies readonly NavTab[];

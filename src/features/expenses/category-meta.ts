import { BedDouble, BusFront, Shapes, Ticket, Utensils } from 'lucide-react-native';

import type { ExpenseCategory } from '@/schemas';

// Fixed order, icon (expenses D20, design-context §8.6) and color token key (§2.8) of the five categories.
export const CATEGORY_META = [
  { key: 'food', icon: Utensils },
  { key: 'transport', icon: BusFront },
  { key: 'stay', icon: BedDouble },
  { key: 'activities', icon: Ticket },
  { key: 'other', icon: Shapes },
] as const satisfies readonly { key: ExpenseCategory; icon: unknown }[];

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, type ScrollViewInstance } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { dates: string[]; selected: number; onSelect: (index: number) => void };

const { spacing, typography, layout } = tokens;
const { chip, focusRing } = tokens.components;

// Horizontal day chips (plan-timeline step 3): weekday + day of month; `YYYY-MM-DD` is read as UTC so it never shifts a day.
export function PlanDayPicker({ dates, selected, onSelect }: Props) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  const xs = useRef<number[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const parse = (date: string) => new Date(`${date}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat(i18n.language, { timeZone: 'UTC', weekday: 'short' });
  const full = new Intl.DateTimeFormat(i18n.language, { timeZone: 'UTC', dateStyle: 'full' });

  const reveal = (index: number) => scroll.current?.scrollTo({ x: Math.max(0, (xs.current[index] ?? 0) - spacing[4]), animated: false });
  useEffect(() => reveal(selected), [selected]);

  return (
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
      {dates.map((date, index) => {
        const active = index === selected;
        const color = active ? theme.brand.onBrand : theme.text.primary;
        return (
          <Pressable
            key={`${date}-${index}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={full.format(parse(date))}
            onLayout={(e) => {
              xs.current[index] = e.nativeEvent.layout.x;
              if (active) reveal(index);
            }}
            onPress={() => onSelect(index)}
            onFocus={() => setFocused(index)}
            onBlur={() => setFocused(null)}
            style={({ pressed }) => ({
              minWidth: layout.touchTarget,
              minHeight: layout.touchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing[3],
              borderRadius: chip.radius,
              borderWidth: focused === index ? focusRing.width : chip.borderWidth,
              borderColor: focused === index ? theme.border.focus : active ? theme.brand.primary : theme.border.default,
              backgroundColor: active ? (pressed ? theme.brand.pressed : theme.brand.primary) : pressed ? theme.background.sunken : theme.surface.primary,
            })}
          >
            <Text style={[typography.styles.labelSM, { color }]}>{weekday.format(parse(date))}</Text>
            <Text style={[typography.styles.labelLG, { color }]}>{parse(date).getUTCDate()}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

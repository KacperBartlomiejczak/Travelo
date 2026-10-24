import type { LucideIcon } from 'lucide-react-native';
import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { usePillBottomOffset } from '@/features/nav/usePillClearance';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type PillNavItem = { key: string; label: string; Icon: LucideIcon };

type Props = {
  items: PillNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

const { tabs, focusRing } = tokens.components;

// R1 (pill-nav-and-dialog): above this font scale five labels no longer fit, so inactive items keep only their icon.
const MAX_FONT_SCALE_WITH_LABELS = 1.3;

// Floating pill tabs (design-context §8.14, pill-nav-and-dialog D1, D2, D4): a capsule detached from the bottom edge on
// the elevated surface at elevation level 2 (a border in dark mode, §5.2). The selected item sits in a `brand.tint`
// capsule with `text.brand` icon and label, so selection is colour and shape. The capsule fades in over `duration.standard`
// (§7.3 selected-tab indicator; instantly with reduce motion, §7.4). The wrapper lets touches through everywhere except the pill.
export function PillNav({ items, activeKey, onSelect }: Props) {
  const theme = useTheme();
  const bottomOffset = usePillBottomOffset();
  const { width, fontScale } = useWindowDimensions();
  const animate = useReduceMotion() === false;

  const labelsForAll = fontScale <= MAX_FONT_SCALE_WITH_LABELS;
  return (
    <View
      testID="pill-nav-container"
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomOffset,
        alignItems: 'center',
      }}
    >
      <View
        testID="pill-nav"
        style={[
          {
            width: Math.min(width - 2 * tokens.spacing[4], tokens.layout.maxContentWidth),
            height: tabs.height,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: tabs.horizontalPadding,
            borderRadius: tabs.radius,
            backgroundColor: theme.surface.elevated,
          },
          theme.elevation.level2,
        ]}
      >
        {items.map((item) => (
          <PillNavTab
            key={item.key}
            item={item}
            selected={item.key === activeKey}
            showLabel={labelsForAll || item.key === activeKey}
            animate={animate}
            minWidth={width < tokens.layout.compactBreakpoint ? tokens.layout.touchTarget : tabs.itemMinWidth}
            onPress={() => onSelect(item.key)}
          />
        ))}
      </View>
    </View>
  );
}

type TabProps = {
  item: PillNavItem;
  selected: boolean;
  showLabel: boolean;
  animate: boolean;
  minWidth: number;
  onPress: () => void;
};

function PillNavTab({ item, selected, showLabel, animate, minWidth, onPress }: TabProps) {
  const { Icon, label, key } = item;
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  // Opacity of the selected capsule behind icon and label: when this item becomes the selected one, it fades from 0 to 1.
  const [fade] = useState(() => new Animated.Value(1));
  const wasSelected = useRef(selected);
  useLayoutEffect(() => {
    const changed = wasSelected.current !== selected;
    wasSelected.current = selected;
    // Also settles a fade that was running when reduce motion came on (its cleanup stopped it mid-way).
    if (!animate) {
      fade.setValue(1);
      return;
    }
    if (!changed || !selected) return;
    fade.setValue(0);
    // JS driver: only an opacity moves, for 180 ms, and the native driver does not update the rendered style under Jest.
    const fadeIn = Animated.timing(fade, {
      toValue: 1,
      duration: tokens.motion.duration.standard,
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: false,
    });
    fadeIn.start();
    return () => fadeIn.stop();
  }, [selected, animate, fade]);

  const iconColor = selected ? theme.text.brand : theme.icon.secondary;
  const labelColor = selected ? theme.text.brand : theme.text.tertiary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        {
          flex: 1,
          minWidth,
          minHeight: tokens.layout.touchTarget,
          justifyContent: 'center',
          paddingVertical: tokens.spacing[1],
          borderRadius: tabs.radius,
          backgroundColor: pressed ? theme.background.sunken : undefined,
        },
        focused && {
          outlineStyle: 'solid',
          outlineWidth: focusRing.width,
          outlineColor: theme.border.focus,
          outlineOffset: -focusRing.width,
        },
      ]}
    >
      {({ pressed }) => (
        <View
          testID={`pill-nav-content-${key}`}
          style={{
            alignItems: 'center',
            gap: tabs.labelGap,
            paddingVertical: tokens.spacing[1],
          }}
        >
          {selected && (
            <Animated.View
              testID={`pill-nav-capsule-${key}`}
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: tabs.radius,
                  backgroundColor: pressed ? theme.background.sunken : theme.brand.tint,
                  opacity: fade,
                },
              ]}
            />
          )}
          <Icon testID={`pill-nav-icon-${key}`} size={tabs.iconSize} strokeWidth={tokens.iconography.strokeWidth} color={iconColor} />
          {showLabel && (
            <Text numberOfLines={1} style={[tokens.typography.styles.labelSM, { color: labelColor }]}>
              {label}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

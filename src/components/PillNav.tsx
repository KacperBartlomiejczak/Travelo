import type { LucideIcon } from 'lucide-react-native';
import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Pressable, useWindowDimensions, View } from 'react-native';

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

// Floating tabs (design-context §8.14, places-legal-navbar A2): a centred row of separate elements with no shared
// background. The selected tab is a `brand.primary` capsule with icon and label; the others are 48 dp icon-only circles on
// the elevated surface. Each element has its own elevation level 2 (a border in dark mode, §5.2). The container is taller
// than the items so the shadow is not cut, and lets touches through everywhere except the items.
export function PillNav({ items, activeKey, onSelect }: Props) {
  const bottomOffset = usePillBottomOffset();
  const { width } = useWindowDimensions();
  const animate = useReduceMotion() === false;
  // The capsule's width change animates natively (new architecture: no experimental flag needed); skipped with reduce motion.
  const lastKey = useRef(activeKey);
  useLayoutEffect(() => {
    const changed = lastKey.current !== activeKey;
    lastKey.current = activeKey;
    if (changed && animate) {
      LayoutAnimation.configureNext({
        duration: tokens.motion.duration.standard,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });
    }
  }, [activeKey, animate]);

  return (
    <View
      testID="pill-nav-container"
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        // The extra vertical padding is the room for the shadow; subtracting it keeps the items at the usual offset.
        bottom: bottomOffset - tokens.spacing[2],
        paddingVertical: tokens.spacing[2],
        alignItems: 'center',
      }}
    >
      <View
        testID="pill-nav"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing[2],
          maxWidth: Math.min(width - 2 * tokens.spacing[4], tokens.layout.maxContentWidth),
        }}
      >
        {items.map((item) => (
          <PillNavTab key={item.key} item={item} selected={item.key === activeKey} animate={animate} onPress={() => onSelect(item.key)} />
        ))}
      </View>
    </View>
  );
}

type TabProps = {
  item: PillNavItem;
  selected: boolean;
  animate: boolean;
  onPress: () => void;
};

function PillNavTab({ item, selected, animate, onPress }: TabProps) {
  const { Icon, label, key } = item;
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  // Opacity of the label: when this item becomes the selected one, the label fades in from 0 to 1.
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
    // JS driver: only an opacity moves, and the native driver does not update the rendered style under Jest.
    const fadeIn = Animated.timing(fade, {
      toValue: 1,
      duration: tokens.motion.duration.standard,
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: false,
    });
    fadeIn.start();
    return () => fadeIn.stop();
  }, [selected, animate, fade]);

  const color = selected ? theme.brand.onBrand : theme.icon.secondary;
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
          height: tabs.height,
          borderRadius: tokens.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
        },
        selected
          ? {
              flexShrink: 1,
              paddingHorizontal: tabs.horizontalPadding,
              backgroundColor: pressed ? theme.brand.pressed : theme.brand.primary,
            }
          : {
              width: tabs.height,
              backgroundColor: pressed ? theme.background.sunken : theme.surface.elevated,
            },
        theme.elevation.level2,
        focused && {
          outlineStyle: 'solid',
          outlineWidth: focusRing.width,
          outlineColor: theme.border.focus,
          outlineOffset: focusRing.offset,
        },
      ]}
    >
      <View testID={`pill-nav-content-${key}`} style={{ flexDirection: 'row', alignItems: 'center', gap: tabs.gap, minWidth: 0 }}>
        <Icon testID={`pill-nav-icon-${key}`} size={tabs.iconSize} strokeWidth={tokens.iconography.strokeWidth} color={color} />
        {selected && (
          <Animated.Text numberOfLines={1} style={[tokens.typography.styles.labelSM, { color, opacity: fade, flexShrink: 1 }]}>
            {label}
          </Animated.Text>
        )}
      </View>
    </Pressable>
  );
}

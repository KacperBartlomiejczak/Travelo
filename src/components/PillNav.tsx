import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { usePillBottomOffset } from '@/features/nav/usePillClearance';
import { useTheme } from '@/theme/useTheme';

export type PillNavItem = { key: string; label: string; Icon: LucideIcon };

type Props = {
  items: PillNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

// R1 (pill-nav-and-dialog): above this font scale five labels no longer fit, so inactive items keep only their icon.
const MAX_FONT_SCALE_WITH_LABELS = 1.3;

// Floating pill navigation (design-context §10.2, pill-nav-and-dialog D1, D2, D4): an ink capsule detached from the
// bottom edge, in light and dark mode alike. The active item is brand coloured, its icon is larger, and the change
// animates over `duration.small` (instantly with reduce motion, §9.4). The wrapper lets touches through everywhere
// except the capsule.
export function PillNav({ items, activeKey, onSelect }: Props) {
  const theme = useTheme();
  const bottomOffset = usePillBottomOffset();
  const { width, fontScale } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => active && setReduceMotion(enabled));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const { colors, spacing, size, radius, elevation } = theme;
  const labelsForAll = fontScale <= MAX_FONT_SCALE_WITH_LABELS;
  return (
    <View
      testID="pill-nav-container"
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: bottomOffset, alignItems: 'center' }}
    >
      <View
        testID="pill-nav"
        style={[
          {
            width: Math.min(width - 2 * spacing[4], size.maxContentWidth),
            height: size.navPill,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[1],
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.nav.border,
            backgroundColor: colors.nav.background,
          },
          elevation.floating,
        ]}
      >
        {items.map((item) => (
          <PillNavTab
            key={item.key}
            item={item}
            selected={item.key === activeKey}
            showLabel={labelsForAll || item.key === activeKey}
            reduceMotion={reduceMotion}
            onPress={() => onSelect(item.key)}
          />
        ))}
      </View>
    </View>
  );
}

type TabProps = { item: PillNavItem; selected: boolean; showLabel: boolean; reduceMotion: boolean; onPress: () => void };

function PillNavTab({ item, selected, showLabel, reduceMotion, onPress }: TabProps) {
  const { Icon, label, key } = item;
  const theme = useTheme();
  const { colors, spacing, size, radius, typography, duration } = theme;
  const [focused, setFocused] = useState(false);
  // Scale of the icon and label: when the active item changes, it eases from the size it had before to its new one.
  const [scale] = useState(() => new Animated.Value(1));
  const wasSelected = useRef(selected);
  useLayoutEffect(() => {
    const changed = wasSelected.current !== selected;
    wasSelected.current = selected;
    // Also settles an animation that was running when reduce motion came on (its cleanup stopped it mid-way).
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    if (!changed) return;
    scale.setValue(selected ? size.iconStandard / size.iconPrimary : size.iconPrimary / size.iconStandard);
    // JS driver: only a transform moves, for 180 ms, and the native driver does not update the rendered style under Jest.
    const grow = Animated.timing(scale, { toValue: 1, duration: duration.small, useNativeDriver: false });
    grow.start();
    return () => grow.stop();
  }, [selected, reduceMotion, scale, size.iconStandard, size.iconPrimary, duration.small]);

  const color = selected ? colors.nav.active : colors.nav.textInactive;
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
          minWidth: size.touchTarget,
          minHeight: size.touchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.full,
          backgroundColor: pressed ? colors.nav.border : undefined,
        },
        focused && {
          outlineStyle: 'solid',
          outlineWidth: size.focusRing,
          outlineColor: colors.nav.active,
          outlineOffset: -size.focusRing,
        },
      ]}
    >
      <Animated.View testID={`pill-nav-content-${key}`} style={{ alignItems: 'center', gap: spacing[1], transform: [{ scale }] }}>
        <Icon
          testID={`pill-nav-icon-${key}`}
          size={selected ? size.iconPrimary : size.iconStandard}
          strokeWidth={size.iconStroke}
          color={color}
        />
        {showLabel && (
          <Text numberOfLines={1} style={[typography.caption, { color }]}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

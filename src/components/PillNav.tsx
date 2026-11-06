import type { LucideIcon } from "lucide-react-native";
import { useLayoutEffect, useRef, useState } from "react";
import {
  LayoutAnimation,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import ReAnimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { usePressScale } from "@/components/usePressScale";
import { usePillBottomOffset } from "@/features/nav/usePillClearance";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { darkTheme } from "@/theme/theme";
import { tokens } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export type PillNavItem = { key: string; label: string; Icon: LucideIcon };

type Props = {
  items: PillNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

const { tabs, focusRing } = tokens.components;

// Floating tabs (design-context §8.14, places-legal-navbar A5): one shared pill (`surface.elevated`, level 2 elevation, a
// border in dark mode §5.2, 8 dp padding) under the whole row. Inside, one `brand.primary` indicator slides behind the
// items to the selected one; the selected item shows icon and label, the others are 48 dp icon-only `background.sunken`
// circles. The container is taller than the pill so its shadow is not cut, and lets touches through except on the pill.
export function PillNav({ items, activeKey, onSelect }: Props) {
  const bottomOffset = usePillBottomOffset();
  const { width } = useWindowDimensions();
  const theme = useTheme();
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

  // The sliding indicator follows the active item's onLayout (x, width). The first layout and reduce motion set it at once.
  const left = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const placed = useRef(false);
  const activeRef = useRef(activeKey);
  const animateRef = useRef(animate);
  useLayoutEffect(() => {
    activeRef.current = activeKey;
    animateRef.current = animate;
  }, [activeKey, animate]);
  // Absolute `left` is measured inside the border, a layout x from the outside of it (dark mode has a 1 dp border).
  const border = StyleSheet.flatten(theme.elevation.level2).borderWidth ?? 0;
  const place = (key: string, x: number, w: number) => {
    if (key !== activeRef.current) return;
    if (!placed.current || !animateRef.current) {
      placed.current = true;
      left.value = x - border;
      indicatorWidth.value = w;
      return;
    }
    const config = {
      duration: tokens.motion.duration.standard,
      easing: Easing.bezier(...tokens.motion.easing.standard),
    };
    left.value = withTiming(x - border, config);
    indicatorWidth.value = withTiming(w, config);
  };
  // Reanimated runs on the UI thread: a later React commit cannot re-apply stale left/width/opacity (Fabric).
  const indicatorStyle = useAnimatedStyle(() => ({
    left: left.value,
    width: indicatorWidth.value,
  }));

  return (
    <View
      testID="pill-nav-container"
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // The extra vertical padding is the room for the shadow; subtracting it keeps the items at the usual offset.
        bottom: bottomOffset - tokens.spacing[2],
        paddingVertical: tokens.spacing[2],
        alignItems: "center",
      }}
    >
      <View
        testID="pill-nav"
        // Remount on a scheme change: Android keeps a stale square shadow outline when elevation/border change in place.
        key={theme === darkTheme ? "dark" : "light"}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.spacing[2],
          padding: tabs.containerPadding,
          borderRadius: tokens.radii.pill,
          backgroundColor: theme.surface.elevated,
          // Fixed width (D10): the row never resizes on a tab switch, only the indicator slides.
          width: Math.min(tabs.pillWidth, width - 2 * tokens.spacing[4]),
          ...theme.elevation.level2,
        }}
      >
        <ReAnimated.View
          testID="pill-nav-indicator"
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: tabs.containerPadding, // layout y includes the border, absolute top is inside it, so no compensation
              height: tabs.height,
              borderRadius: tokens.radii.pill,
              backgroundColor: theme.brand.primary,
            },
            indicatorStyle,
          ]}
        />
        {items.map((item) => (
          <PillNavTab
            key={item.key}
            item={item}
            selected={item.key === activeKey}
            animate={animate}
            onPress={() => onSelect(item.key)}
            onLayout={(x, w) => place(item.key, x, w)}
          />
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
  onLayout: (x: number, width: number) => void;
};

function PillNavTab({ item, selected, animate, onPress, onLayout }: TabProps) {
  const { Icon, label, key } = item;
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  // Opacity of the label: when this item becomes the selected one, the label fades in from 0 to 1.
  const fade = useSharedValue(1);
  const wasSelected = useRef(selected);
  useLayoutEffect(() => {
    const changed = wasSelected.current !== selected;
    wasSelected.current = selected;
    if (!animate || !changed || !selected) {
      fade.value = 1; // never leave a label part-transparent
      return;
    }
    fade.value = 0;
    fade.value = withTiming(1, {
      duration: tokens.motion.duration.standard,
      easing: Easing.bezier(...tokens.motion.easing.standard),
    });
  }, [selected, animate, fade]);
  const labelStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const { style: motionStyle, ...pressHandlers } = usePressScale();
  const color = selected ? theme.brand.onBrand : theme.icon.secondary;
  // The wrapper carries the press scale (like every button) and the layout the indicator follows.
  return (
    <ReAnimated.View
      testID={`pill-nav-motion-${key}`}
      style={[motionStyle, selected && { flexShrink: 1 }]}
      onLayout={(event) =>
        onLayout(event.nativeEvent.layout.x, event.nativeEvent.layout.width)
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={onPress}
        {...pressHandlers}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          {
            height: tabs.height,
            borderRadius: tokens.radii.pill,
            alignItems: "center",
            justifyContent: "center",
          },
          selected
            ? {
                flexShrink: 1,
                paddingHorizontal: tabs.horizontalPadding,
                // The brand.primary indicator is behind; pressing paints the item itself with brand.pressed.
                backgroundColor: pressed ? theme.brand.pressed : undefined,
              }
            : {
                width: tabs.height,
                backgroundColor: theme.background.sunken,
              },
          focused && {
            outlineStyle: "solid",
            outlineWidth: focusRing.width,
            outlineColor: theme.border.focus,
            outlineOffset: focusRing.offset,
          },
        ]}
      >
        <View
          testID={`pill-nav-content-${key}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tabs.gap,
            minWidth: 0,
          }}
        >
          <Icon
            testID={`pill-nav-icon-${key}`}
            size={tabs.iconSize}
            strokeWidth={tokens.iconography.strokeWidth}
            color={color}
          />
          {selected && (
            <ReAnimated.Text
              numberOfLines={1}
              style={[
                tokens.typography.styles.labelSM,
                { color, flexShrink: 1 },
                labelStyle,
              ]}
            >
              {label}
            </ReAnimated.Text>
          )}
        </View>
      </Pressable>
    </ReAnimated.View>
  );
}

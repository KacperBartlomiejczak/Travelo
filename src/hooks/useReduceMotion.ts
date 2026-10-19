import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the system asks to reduce motion (design-context §9.4): `null` until it has answered, then `true` / `false`, and
 * it follows the setting while the app runs. If the system cannot answer (the call can reject), play it safe: `true`, no
 * decorative motion. A change event after such a failure still counts.
 */
export function useReduceMotion(): boolean | null {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => active && setReduceMotion(enabled))
      .catch(() => active && setReduceMotion(true));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

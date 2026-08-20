/**
 * hooks/useReducedMotion.ts
 *
 * Returns true when the device "Reduce Motion" accessibility setting is on.
 * Use this to opt animations out for users who need it.
 *
 * Usage:
 *   const noMotion = useReducedMotion();
 *   <Animated.View entering={noMotion ? undefined : FadeInDown.delay(80)}>
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // Read initial value
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});

    // Subscribe to changes (user flips the switch without restarting)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);

  return reduced;
}

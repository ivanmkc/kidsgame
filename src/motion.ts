import { Platform } from 'react-native';

// Respect prefers-reduced-motion on web: ambient/decorative animation
// (twinkles, confetti, bobbing) switches off; functional transitions stay.
export function prefersReducedMotion(): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }
  return false;
}

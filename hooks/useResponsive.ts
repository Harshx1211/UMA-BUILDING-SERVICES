/**
 * hooks/useResponsive.ts
 *
 * The app had zero tablet/large-screen handling anywhere — every list and
 * detail screen was built assuming phone width, so a single-column list of
 * phone-sized cards just stretches edge-to-edge on an iPad, looking sparse
 * and unfinished rather than intentionally designed.
 *
 * This is a minimal, additive primitive: on a phone-width screen every
 * value below is a no-op (maxWidth === '100%', isTablet === false), so
 * adopting it on a screen changes nothing there. On a wide screen it caps
 * content to a comfortable reading/card width and centers it, which is the
 * single highest-leverage fix for "phone-only" layouts.
 *
 * Usage:
 *   const { contentMaxWidth, isTablet } = useResponsive();
 *   <FlatList contentContainerStyle={[styles.scroll, { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }]} ... />
 */
import { useWindowDimensions } from 'react-native';

/** Below this, treat as a phone — no layout changes. */
const TABLET_BREAKPOINT = 700;
/** Content never grows wider than this on very large screens — keeps card
 * rows, text lines, and form fields from stretching to an unreadable width. */
const MAX_CONTENT_WIDTH = 720;

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  return {
    width,
    isTablet,
    /** Pass straight into a ScrollView/FlatList's contentContainerStyle
     * alongside `width: '100%', alignSelf: 'center'`. */
    contentMaxWidth: Math.min(width, MAX_CONTENT_WIDTH),
  };
}

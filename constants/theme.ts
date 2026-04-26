import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Dattl design tokens — single source of truth for the dark UI.
//
// Orange (`accent`) is reserved for the brand title, the primary CTA per
// screen, urgent expiry indicators, and tab-bar / date-picker selection.
// Everywhere else, demote to the neutral tonal scale below.
// ─────────────────────────────────────────────────────────────────────────────
export const colors = {
  // surfaces
  bg:        '#0f0f0f',
  surface:   '#161616',
  surface2:  '#1f1f1f',
  border:    '#2a2a2a',

  // text
  text:      '#e8e8e8',
  muted:     '#888888',
  mutedDeep: '#555555',

  // brand
  accent:    '#D97706',
  onAccent:  '#000000',

  // status
  warning:   '#f5c542',
  expired:   '#E05252',
  success:   '#4ade80',
  danger:    '#FF6B6B',

  // misc
  overlay:   'rgba(0,0,0,0.7)',
} as const;

export const fonts = {
  brand: 'Poppins_800ExtraBold',
} as const;

export const weights = {
  regular: '400',
  medium:  '500',
  bold:    '700',
} as const;

export const radii = {
  sm:   8,
  md:   12,
  lg:   14,
  xl:   20,
  pill: 999,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Expo-template exports — kept so the unused themed-text / themed-view
// / parallax-scroll-view / collapsible chain keeps compiling. Not consumed by
// any real screen. Safe to delete once those template files are removed.
// ─────────────────────────────────────────────────────────────────────────────
const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

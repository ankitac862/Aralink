import { useColorScheme } from './use-color-scheme';

/**
 * Canonical app theme — single source of truth for colors.
 *
 * Design language: monochrome accent (white button on dark / black button on light),
 * near-black dark mode, soft gray light mode. Green is reserved for money/positive
 * stats, red for destructive/negative. System font with bold weights.
 *
 * Dark:  bg #0B0B0C · card #1A1B1E · chip #26282C · text #FFFFFF / #9BA1A6
 * Light: bg #F2F2F4 · card #FFFFFF · chip #E8E8EA · text #111315 / #6E7377
 */
export function useAppTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    isDark,

    // Surfaces
    bg: isDark ? '#0B0B0C' : '#F2F2F4',
    card: isDark ? '#1A1B1E' : '#FFFFFF',
    chip: isDark ? '#26282C' : '#E8E8EA',       // pills, filter chips, inputs
    subtle: isDark ? '#141517' : '#F7F7F8',     // inset sections inside cards
    border: isDark ? '#26282C' : '#E5E5E7',

    // Text
    text: isDark ? '#FFFFFF' : '#111315',
    textSecondary: isDark ? '#9BA1A6' : '#6E7377',

    // Monochrome accent (primary buttons)
    accent: isDark ? '#FFFFFF' : '#111315',
    onAccent: isDark ? '#0B0B0C' : '#FFFFFF',   // text/icon on top of accent

    // Status
    success: isDark ? '#4ADE80' : '#15803D',
    successBg: isDark ? '#1E3B2A' : '#DFF2E4',
    warning: '#FF9500',
    danger: isDark ? '#FF453A' : '#DC2626',
    dangerBg: isDark ? '#3B1D1B' : '#FDE8E7',

    // ── Legacy aliases (older screens) — same values, do not diverge ──
    bgColor: isDark ? '#0B0B0C' : '#F2F2F4',
    cardBgColor: isDark ? '#1A1B1E' : '#FFFFFF',
    textPrimaryColor: isDark ? '#FFFFFF' : '#111315',
    textSecondaryColor: isDark ? '#9BA1A6' : '#6E7377',
    borderColor: isDark ? '#26282C' : '#E5E5E7',
    primaryColor: isDark ? '#FFFFFF' : '#111315',
    inputBgColor: isDark ? '#1A1B1E' : '#FFFFFF',
    successColor: isDark ? '#4ADE80' : '#15803D',
    warningColor: '#FF9500',
    dangerColor: isDark ? '#FF453A' : '#DC2626',
    infoColor: isDark ? '#9BA1A6' : '#6E7377',
  };
}

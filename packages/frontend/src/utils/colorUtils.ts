/**
 * Color utility functions
 */

/**
 * Calculate whether to use black or white text based on background color luminance.
 * Uses the sRGB luminance formula to determine appropriate contrast.
 *
 * @param hexColor - Hex color string (e.g., '#FF5733' or 'FF5733')
 * @returns '#000' for bright backgrounds, '#fff' for dark backgrounds
 */
export const getContrastColor = (hexColor: string): string => {
  if (!hexColor) return "#fff";

  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Handle 3-character hex
  const fullHex =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;

  // Parse RGB values
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);

  // Handle invalid colors
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#fff";

  // Calculate relative luminance using sRGB formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Use black text for bright backgrounds, white for dark
  return luminance > 0.5 ? "#000" : "#fff";
};

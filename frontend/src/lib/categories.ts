// Each category's tile tint (a hue) and the colours its scene is painted with.
// From the Claude Design file; "other" has no scene and gets a plain gift icon.
export const PALETTE: Record<string, [number, string, string, string?, string?]> = {
  dining: [30, 'oklch(0.64 0.17 25)', 'oklch(0.88 0.13 90)', 'oklch(0.5 0.1 40)'],
  transport: [90, 'oklch(0.86 0.16 92)', 'oklch(0.9 0.05 230)', 'oklch(0.32 0.03 260)'],
  travel: [200, 'oklch(0.66 0.12 200)', 'oklch(0.75 0.15 55)'],
  wellness: [150, 'oklch(0.72 0.12 150)', 'oklch(0.84 0.1 150)'],
  shopping: [350, 'oklch(0.7 0.15 350)', 'oklch(0.7 0.12 240)'],
  entertainment: [290, 'oklch(0.62 0.19 25)', 'oklch(0.95 0.06 95)', 'oklch(0.65 0.2 25)', 'oklch(0.8 0.12 210)'],
}

/** The hue a category's tile is tinted with (from PALETTE), or null for "other". */
export const categoryHue = (category: string): number | null => PALETTE[category]?.[0] ?? null

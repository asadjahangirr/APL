/**
 * Style themes for library designs. Every design is built from a theme, so one
 * layout is available in each of these looks.
 */
export interface Theme {
  id: string; name: string; dark: boolean;
  /** Page background, alternate section background, card surface. */
  bg: string; alt: string; surface: string;
  text: string; muted: string; line: string;
  primary: string; onPrimary: string; accent: string;
  /** Inverse band (dark on light themes, light on dark themes). */
  inv: string; onInv: string;
  /** Gradient pairs used for picture placeholders and avatars. */
  imgs: [string, string][];
  head: string; body: string;
  /** Heading weight and letter spacing (fraction of the font size). */
  hw: number; hls: number;
  /** Card radius, button radius, line weight. */
  r: number; br: number; lw: number;
  card: 'line' | 'shadow';
}

const theme = (id: string, name: string, colors: string, imgs: string, head: string, body: string, hw: number, hls: number, r: number, br: number, card: Theme['card'], dark = false, lw = 1): Theme => {
  const [bg, alt, surface, text, muted, line, primary, onPrimary, accent, inv, onInv] = colors.split(' ').map(value => '#' + value);
  const list = imgs.split(' ').map(value => '#' + value);
  return { id, name, dark, bg, alt, surface, text, muted, line, primary, onPrimary, accent, inv, onInv, imgs: [[list[0], list[1]], [list[2], list[3]], [list[4], list[5]]], head, body, hw, hls, r, br, lw, card };
};

//                              bg     alt    surface text   muted  line   primary onPrim accent inv    onInv
export const THEMES: Theme[] = [
  theme('paper', 'Paper', 'FFFFFF F6F6F4 FFFFFF 111113 62646B E7E6E3 111113 FFFFFF 2563EB 111113 FFFFFF', 'E8ECF4 C9D4EA F4E9E1 EBCDB8 E3F1EA BFE0CF', 'Inter', 'Inter', 700, -0.03, 14, 10, 'line'),
  theme('midnight', 'Midnight', '0B0D12 10131A 151922 F4F5F7 9BA1AE 252A36 6366F1 FFFFFF A5B4FC F4F5F7 0B0D12', '312E81 6366F1 1E293B 475569 4C1D95 C084FC', 'Sora', 'Inter', 600, -0.03, 16, 12, 'line', true),
  theme('editorial', 'Editorial', 'F6F1E7 EFE8DA FBF8F1 1F1B16 6B6257 DDD3C0 1F1B16 F6F1E7 B4532A 1F1B16 F6F1E7', 'D9C7A8 B9966B C9B9A0 8F7B62 E5D5BC C4A27A', 'Instrument Serif', 'Inter', 400, -0.02, 2, 2, 'line'),
  theme('neon', 'Neon', '050505 0D0D0D 121212 FAFAFA 8E8E93 262626 C6FF3D 050505 C6FF3D C6FF3D 050505', '1A2E05 C6FF3D 171717 404040 0F3D3E 5EEAD4', 'Space Grotesk', 'Space Grotesk', 700, -0.04, 20, 999, 'line', true),
  theme('ocean', 'Ocean', 'FFFFFF F2F7FF FFFFFF 0B1B33 55657E DCE6F5 0B63F6 FFFFFF 0891B2 0B1B33 FFFFFF', 'CFE3FF 7FB2FF D5F5F6 7ADCE0 E0E7FF A5B4FC', 'Plus Jakarta Sans', 'Plus Jakarta Sans', 800, -0.03, 18, 12, 'shadow'),
  theme('forest', 'Forest', 'F3F5EF E9EDE2 FFFFFF 17261E 5A6B60 D5DCCB 1F4D3A F3F5EF C2703D 17261E F3F5EF', 'C8D9BE 7FA38A E6D9C3 C9A77C B7CDB9 4F7A63', 'Fraunces', 'DM Sans', 600, -0.02, 12, 999, 'line'),
  theme('sunset', 'Sunset', 'FFFAF5 FFF1E6 FFFFFF 2A1810 7A6257 F3DFD0 F9541C FFFFFF E11D74 2A1810 FFFAF5', 'FFD3B0 FF8A5B FFC2D6 F0609E FFE7A8 FFB347', 'Outfit', 'Outfit', 700, -0.02, 24, 999, 'shadow'),
  theme('mono', 'Mono', 'FFFFFF F2F2F2 FFFFFF 000000 555555 000000 000000 FFFFFF FF3B00 000000 FFFFFF', 'E5E5E5 BDBDBD D4D4D4 8C8C8C F0F0F0 CFCFCF', 'JetBrains Mono', 'JetBrains Mono', 700, -0.04, 0, 0, 'line', false, 2),
  theme('lavender', 'Lavender', 'FAF7FF F1EBFF FFFFFF 1E1533 675E80 E4DAFA 7C3AED FFFFFF DB2777 1E1533 FAF7FF', 'DDD0FF A78BFA FBD0E8 F472B6 D4E4FF 93B4FF', 'Manrope', 'Manrope', 800, -0.03, 20, 14, 'shadow'),
  theme('carbon', 'Carbon', '161616 1D1D1D 222222 F2F2F2 A3A3A3 333333 F2F2F2 161616 FF6B2C F2F2F2 161616', '2B2B2B 555555 3A2418 FF6B2C 262626 737373', 'Syne', 'Inter', 700, -0.03, 6, 6, 'line', true),
  theme('rose', 'Rose', 'FFF6F6 FDEAEA FFFFFF 2B0F16 7D5962 F3D5D8 BE123C FFFFFF B45309 2B0F16 FFF6F6', 'F9CBD3 E88A9B F6E0C8 E2B07E F3D9E6 D48DB0', 'Playfair Display', 'DM Sans', 600, -0.01, 10, 4, 'line'),
  theme('aurora', 'Aurora', '070B1A 0C1226 111A33 EEF2FF 94A0C2 1E2A4D 22D3EE 06202A A78BFA EEF2FF 070B1A', '0E7490 22D3EE 4C1D95 A78BFA 1E3A8A 60A5FA', 'Bricolage Grotesque', 'Inter', 700, -0.03, 22, 999, 'line', true),
];

export const themeById = (id: string): Theme => THEMES.find(value => value.id === id) ?? THEMES[0];

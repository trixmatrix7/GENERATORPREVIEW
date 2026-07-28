/** VICE HEAT — visual parameters the build ships with by default.
 *
 *  These are settings the partner dev asked for as *settings*, not as baked-in
 *  constants. They used to be hardcoded in ReelSet (an opaque 0x0b0d14 panel
 *  behind the expanded wild, no border at all, and a plain fade for the ×N
 *  badge), which is why they could not be found in the studio drawer.
 *
 *  Two consumers, one source of truth:
 *    · App.tsx applies them on Vice load, so a fresh visitor sees exactly this.
 *    · buildPresets.ts seeds the export with them, so the dev receives them in
 *      `extras.visualParams` even when nothing was touched in the studio (the
 *      export otherwise only carries params the user actively changed).
 *
 *  Values below ARE the previously hardcoded look — dialling them changes the
 *  game, leaving them does not. borderWidth 0 = no border, as shipped.
 */
export const VICE_DEFAULT_VISUAL_PARAMS: Record<string, string> = {
  // Panel behind the full-reel wild tower.
  expandWildBackdrop: '#0b0d14',
  expandWildBackdropAlpha: '1',
  // Border around the wild reel. Did not exist before; off by default.
  expandWildBorder: '#ff3ea5',
  expandWildBorderWidth: '0',
  expandWildBorderAlpha: '1',
  // How hard the ×N badge punches on when it locks onto the tower, and how
  // long that takes (seconds). 1 = no overshoot.
  expandWildMultiPop: '1.45',
  expandWildMultiPopTime: '0.42',
};

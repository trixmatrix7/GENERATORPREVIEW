// FRUIT STACKS — Noskis FINALER, handgemachter Zustand (2026-07-24), als
// Code-Default eingebrannt (Settings-Durability-Regel: er stellt ein, ich
// persistiere). Ein FRISCHER Vercel-Besucher (leerer localStorage) muss beim
// Öffnen von Fruit Stacks EXAKT diesen Zustand vorfinden. Extrahiert 1:1 aus
// seinem localStorage (slot:assets + slot:audio-event-volumes).
//
// Angewendet im Fruit-Wiring (App.tsx) NUR wenn der Nutzer nichts Eigenes
// gespeichert hat — ein bewusster späterer Pick/Volume gewinnt weiterhin.

/** Sound-Bibliothek-Picks (eventId → asset-URL). Genau Noskis Auswahl. */
export const FRUIT_LOCKED_SOUNDS: Record<string, string> = {
  'coin-chime': '/audio/library/coin-chime/fairy-arcade-sparkle-299474.ogg',
  'free-spin-trigger': '/audio/library/free-spin-trigger/achievement-bell-af8df2.ogg',
  'ambient-music': '/audio/themelib/bewaehrt/mango-market-loop.ogg',
  'win-marquee': '/audio/themelib/bewaehrt/island-victory-fanfare.ogg',
  'spin-start': '/audio/themelib/ui-click/ui-klick-08.ogg',
  'scatter-land': '/audio/themelib/pop-burst/pop-blase-02.ogg',
};

/** Event-Lautstärken (eventId → 0..1). Noskis handgemischter Pegel. */
export const FRUIT_LOCKED_VOLUMES: Record<string, number> = {
  'free-spin-trigger': 0.42,
  'ambient-music': 0.26,
  'win-marquee': 0.65,
};

/** Params-Drawer-Overrides (applyVisualParam id → value). Rahmen aus, Zelle
 *  ohne Backdrop — Noskis finaler Look. */
export const FRUIT_LOCKED_VISUAL_PARAMS: Record<string, string> = {
  frameWidth: '0',
  frameOpacity: '0',
  cellBgOpacity: '0',
};

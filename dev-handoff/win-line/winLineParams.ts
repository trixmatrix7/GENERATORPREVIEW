// winLineParams.ts — the four adjustable-params for the ways-light win line, in
// the same shape as your existing whitelist entries. Spread these into your
// ADJUSTABLE_PARAMS array. All are standard `enum` — no new control type needed.
//
// Defaults = a WHITE beam, normal speed, medium thickness, ON.

export const WIN_LINE_PARAMS = [
  {
    id: 'waysLight',
    label: 'Ways-light comet',
    layer: 'win-presentation',
    type: 'enum',
    options: ['on', 'off'],
    default: 'on',
    description: 'Toggle the thin white light comet that shoots through each winning ways-connection. Phrases: "turn off the win light streak", "enable the ways comet".',
    keywords: ['ways light', 'light streak', 'comet', 'win light', 'beam'],
  },
  {
    id: 'waysLightColor',
    label: 'Ways-light colour',
    layer: 'win-presentation',
    type: 'enum',
    options: ['white', 'ice', 'gold', 'purple', 'green', 'pink'],
    default: 'white',
    description: 'Colour of the ways-light comet beam. Phrases: "make the win light ice blue / gold / purple / green / pink / white".',
    keywords: ['ways light', 'light streak', 'comet', 'beam', 'streak'],
  },
  {
    id: 'waysLightSpeed',
    label: 'Ways-light speed',
    layer: 'win-presentation',
    type: 'enum',
    options: ['slow', 'normal', 'fast'],
    default: 'normal',
    description: 'How fast the ways-light comet shoots through the connection — visual only. Phrases: "faster win light", "slower comet".',
    keywords: ['ways light', 'comet', 'speed', 'fast', 'slow'],
  },
  {
    id: 'waysLightWidth',
    label: 'Ways-light thickness',
    layer: 'win-presentation',
    type: 'enum',
    options: ['thin', 'medium', 'bold'],
    default: 'medium',
    description: 'Thickness of the ways-light comet line. Phrases: "thinner win light", "bolder comet beam".',
    keywords: ['ways light', 'comet', 'thickness', 'width', 'thin', 'bold'],
  },
] as const;

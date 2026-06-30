// adjustableParams.ts — the whitelist of params that are live-tunable in the
// studio (in the dev generator these are the params the NL parser may change at
// generation time). Each maps to a knob the renderers read at runtime.

export interface AdjustableParam {
  key: string;
  label: string;
  group: 'spin' | 'symbol' | 'win' | 'anticipation' | 'celebration';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  description: string;
}

export const ADJUSTABLE_PARAMS: AdjustableParam[] = [
  {
    key: 'spinSpeed',
    label: 'Spin speed',
    group: 'spin',
    min: 0.4,
    max: 2.5,
    step: 0.1,
    default: 1,
    unit: '×',
    description: 'Turbo factor — scales all drop + tween durations.',
  },
  {
    key: 'dropDurationMs',
    label: 'Drop duration',
    group: 'spin',
    min: 150,
    max: 800,
    step: 10,
    default: 430,
    unit: 'ms',
    description: 'Fall duration per symbol column (TIMING.dropDuration).',
  },
  {
    key: 'dropStaggerMs',
    label: 'Column stagger',
    group: 'spin',
    min: 0,
    max: 200,
    step: 5,
    default: 70,
    unit: 'ms',
    description: 'Delay between reels starting their drop (left→right).',
  },
  {
    key: 'landingSquash',
    label: 'Landing squash',
    group: 'symbol',
    min: 0,
    max: 1.5,
    step: 0.05,
    default: 1,
    unit: '×',
    description: 'Intensity of the squash & stretch impact on reel-stop.',
  },
  {
    key: 'idlePulseSpeed',
    label: 'Idle pulse speed',
    group: 'symbol',
    min: 0.3,
    max: 2.5,
    step: 0.1,
    default: 1,
    unit: '×',
    description: 'Scatter-tension breathing rate (idle-glow-pulse).',
  },
  {
    key: 'winPopIntensity',
    label: 'Win pop intensity',
    group: 'win',
    min: 0.3,
    max: 2,
    step: 0.05,
    default: 1,
    unit: '×',
    description: 'Per-cell win overshoot (scales the per-kind pop factor).',
  },
  {
    key: 'glowIntensity',
    label: 'Glow intensity',
    group: 'win',
    min: 0,
    max: 2,
    step: 0.05,
    default: 1,
    unit: '×',
    description: 'Radial glow flare strength on win + anticipation.',
  },
  {
    key: 'shockwaveScale',
    label: 'Shockwave size',
    group: 'win',
    min: 1,
    max: 3,
    step: 0.05,
    default: 1.95,
    unit: '×cell',
    description: 'Final scale of the expanding win shockwave ring.',
  },
  {
    key: 'sweatSlowFactor',
    label: 'Sweat slow-mo',
    group: 'anticipation',
    min: 1,
    max: 3,
    step: 0.1,
    default: 1.7,
    unit: '×',
    description: 'How much slower remaining reels fall during scatter sweat.',
  },
  {
    key: 'celebrationIntensity',
    label: 'Celebration intensity',
    group: 'celebration',
    min: 0.3,
    max: 2,
    step: 0.05,
    default: 1,
    unit: '×',
    description: 'Big/Mega win-screen particle + shake strength.',
  },
];

export type ParamValues = Record<string, number>;

export const defaultParamValues = (): ParamValues =>
  Object.fromEntries(ADJUSTABLE_PARAMS.map((p) => [p.key, p.default]));

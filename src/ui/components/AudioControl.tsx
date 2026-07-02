// AudioControl — sidebar widget for master volume + mute.
// Subscribes to the SoundManager so external changes (e.g. from another tab)
// stay reflected in the UI.

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { SoundManager } from '@/audio/SoundManager';

interface Props {
  soundManager: SoundManager;
}

export function AudioControl({ soundManager }: Props) {
  const [volume, setVolumeState] = useState(soundManager.volume);
  const [muted, setMutedState] = useState(soundManager.muted);

  useEffect(() => {
    const unsub = soundManager.subscribe(() => {
      setVolumeState(soundManager.volume);
      setMutedState(soundManager.muted);
    });
    return unsub;
  }, [soundManager]);

  const handleToggleMute = () => soundManager.toggleMuted();
  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100;
    soundManager.setVolume(v);
    // Tapping the slider while muted should unmute as a UX nicety.
    if (muted && v > 0) soundManager.setMuted(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggleMute}
        title={muted ? 'Unmute' : 'Mute'}
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
      >
        {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(volume * 100)}
        onChange={handleVolume}
        aria-label="Master volume"
        className="h-1 flex-1 cursor-pointer accent-[var(--color-blue)]"
      />
    </div>
  );
}

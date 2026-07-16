# Slot-gameplay VIDEO analyzer — measures audio-motion sync from a screen
# recording of a real slot (research/slot-feel ground truth).
#
# Usage:  python research/tools/analyze_slot_video.py "<video.mp4>" [out_dir]
#
# Pipeline:
#   1. Audio: extract mono wav -> onset envelope (spectral flux) -> onset
#      times + per-onset spectral fingerprint (centroid, dominant freq band,
#      attack ms, duration) -> classify into rough SFX groups by similarity.
#   2. Video: per-reel motion curves (frame differencing on 5 vertical strips
#      over the reel area) -> spin start/stop times per reel.
#   3. Align: reel-stop motion events vs audio onsets (offset stats), stop
#      pitch ladder check (dominant freq per stop 1..5), stop stagger ms,
#      tally tick rate over time, level of the spin bed vs music.
#   4. Output: <out>/timeline.md (event table), <out>/onsets.json,
#      frames at key moments in <out>/frames/ for visual inspection.

import sys, os, json, subprocess
import numpy as np
from scipy import signal
from scipy.io import wavfile

VIDEO = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(VIDEO), 'slot_video_analysis')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(OUT, 'frames'), exist_ok=True)

# ── 1. AUDIO ────────────────────────────────────────────────────────────────
wav = os.path.join(OUT, 'audio.wav')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', VIDEO,
                '-ac', '1', '-ar', '44100', wav], check=True)
sr, x = wavfile.read(wav)
x = x.astype(np.float32) / 32768.0

# STFT for onset envelope (spectral flux) + fingerprints
NFFT, HOP = 2048, 512
f, t, Z = signal.stft(x, sr, nperseg=NFFT, noverlap=NFFT - HOP)
mag = np.abs(Z)
flux = np.maximum(0, np.diff(mag, axis=1)).sum(axis=0)
flux = flux / (flux.max() + 1e-9)
# adaptive threshold onset picking
med = signal.medfilt(flux, 31)
peaks, props = signal.find_peaks(flux - med, height=0.06, distance=int(0.05 * sr / HOP))
onset_times = t[1:][peaks]

def fingerprint(at):
    i0 = int(at * sr); seg = x[i0:i0 + int(0.25 * sr)]
    if len(seg) < 1000: return None
    env = np.abs(signal.hilbert(seg))
    att_ms = float(np.argmax(env > 0.6 * env.max()) / sr * 1000)
    dur_ms = float(np.sum(env > 0.15 * env.max()) / sr * 1000)
    F, P = signal.welch(seg, sr, nperseg=2048)
    centroid = float((F * P).sum() / (P.sum() + 1e-12))
    dom = float(F[np.argmax(P)])
    rms = float(np.sqrt((seg ** 2).mean()))
    return dict(t=float(at), attack_ms=round(att_ms, 1), dur_ms=round(dur_ms, 1),
                centroid=round(centroid), dominant_hz=round(dom), rms=round(rms, 4))

fps_audio = [fp for at in onset_times if (fp := fingerprint(at))]

# ── 2. VIDEO motion per reel strip ─────────────────────────────────────────
probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,duration', '-of', 'json', VIDEO],
    capture_output=True, text=True).stdout)['streams'][0]
W, H = probe['width'], probe['height']
num, den = probe['r_frame_rate'].split('/')
FPS = float(num) / float(den)
# low-res grayscale dump for motion analysis
tiny = os.path.join(OUT, 'tiny_%05d.png')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', VIDEO,
                '-vf', 'scale=160:90,format=gray', '-vsync', '0',
                os.path.join(OUT, 'tiny', 'f_%06d.png')], check=False)
tiny_dir = os.path.join(OUT, 'tiny'); os.makedirs(tiny_dir, exist_ok=True)
if not os.listdir(tiny_dir):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', VIDEO,
                    '-vf', 'scale=160:90,format=gray',
                    os.path.join(tiny_dir, 'f_%06d.png')], check=True)
from PIL import Image
files = sorted(os.listdir(tiny_dir))
frames = np.stack([np.asarray(Image.open(os.path.join(tiny_dir, fn)), dtype=np.float32) for fn in files])
# assume the reel area is the central band; 5 strips across the middle 70%
x0, x1 = int(160 * 0.15), int(160 * 0.85)
y0, y1 = int(90 * 0.2), int(90 * 0.85)
strips = np.array_split(np.arange(x0, x1), 5)
diff = np.abs(np.diff(frames, axis=0))
motion = np.stack([diff[:, y0:y1, s].mean(axis=(1, 2)) for s in strips], axis=1)  # [frame, reel]
mnorm = motion / (motion.max(axis=0, keepdims=True) + 1e-9)

def spin_events(col, thr=0.35):
    on = mnorm[:, col] > thr
    ev = []
    prev = False
    for i, v in enumerate(on):
        if v and not prev: ev.append(('start', i / FPS))
        if not v and prev: ev.append(('stop', i / FPS))
        prev = v
    return ev

reel_events = {r: spin_events(r) for r in range(5)}

# ── 3. ALIGN stops ↔ onsets ────────────────────────────────────────────────
stop_rows = []
for r, evs in reel_events.items():
    for kind, tt in evs:
        if kind != 'stop': continue
        near = [fp for fp in fps_audio if abs(fp['t'] - tt) < 0.12]
        best = min(near, key=lambda fp: abs(fp['t'] - tt)) if near else None
        stop_rows.append(dict(reel=r, t_video=round(tt, 3),
                              t_audio=round(best['t'], 3) if best else None,
                              offset_ms=round((best['t'] - tt) * 1000, 1) if best else None,
                              dominant_hz=best['dominant_hz'] if best else None,
                              centroid=best['centroid'] if best else None))

# key frames at each audio onset class for visual inspection (every ~Nth)
for i, fp in enumerate(fps_audio[:400]):
    if i % 8: continue
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(fp['t']), '-i', VIDEO,
                    '-vframes', '1', os.path.join(OUT, 'frames', f'onset_{i:03d}_{fp["t"]:.2f}s.jpg')], check=False)

# ── 4. REPORT ──────────────────────────────────────────────────────────────
json.dump(dict(onsets=fps_audio, stops=stop_rows), open(os.path.join(OUT, 'onsets.json'), 'w'), indent=1)
lines = ['# Slot video analysis', '', f'video: {os.path.basename(VIDEO)} — {W}x{H} @ {FPS:.1f}fps', '',
         f'audio onsets detected: {len(fps_audio)}', '', '## Reel stops (video motion vs audio)', '',
         '| reel | t_video | t_audio | offset ms | dominant Hz | centroid |', '|---|---|---|---|---|---|']
for s in stop_rows[:120]:
    lines.append(f"| {s['reel']+1} | {s['t_video']} | {s['t_audio']} | {s['offset_ms']} | {s['dominant_hz']} | {s['centroid']} |")
# stop pitch ladder check: group consecutive stops in 5s windows
lines += ['', '## Stop pitch ladder check (per spin, dominant Hz reel 1→5)', '']
by_time = sorted([s for s in stop_rows if s['dominant_hz']], key=lambda s: s['t_video'])
spin, last_t = [], -10
for s in by_time:
    if s['t_video'] - last_t > 2.0 and spin:
        lines.append('- ' + ' → '.join(f"R{p['reel']+1}:{p['dominant_hz']}Hz" for p in spin))
        spin = []
    spin.append(s); last_t = s['t_video']
if spin: lines.append('- ' + ' → '.join(f"R{p['reel']+1}:{p['dominant_hz']}Hz" for p in spin))
open(os.path.join(OUT, 'timeline.md'), 'w', encoding='utf-8').write('\n'.join(lines))
print('analysis ->', OUT)
print('onsets:', len(fps_audio), '| stop events:', len(stop_rows))

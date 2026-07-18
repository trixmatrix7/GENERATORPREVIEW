#!/usr/bin/env bash
# master-audio.sh — turn ANY raw generated sound (Suno / ElevenLabs / whatever)
# into a clean, correctly-levelled, game-ready .ogg. This is the mastering
# stage that was missing: raw generation is easy, but without loudness
# normalisation + a true-peak ceiling every sound sits at 0 dBFS and the mix
# clips ("es kracht") the moment two play together.
#
# Usage:
#   scripts/master-audio.sh <input> <role> [output.ogg]
#
# Roles (target loudness / true-peak ceiling — the whole point):
#   music    base / FS background bed      -20 LUFS  ceiling -3 dBTP   (sits UNDER sfx)
#   loop     spin bed (very quiet)         -24 LUFS  ceiling -6 dBTP
#   sfx      reel-stop, wild-land, clicks  peak-norm ceiling -4 dBTP   (short one-shots)
#   stinger  trigger, tier-up, quips       -15 LUFS  ceiling -2 dBTP
#   win      win-small..mega, marquee      -14 LUFS  ceiling -1.5 dBTP (the loud peaks)
#
# Output is always 48 kHz OGG (libvorbis q5). A brick-wall alimiter guarantees
# the ceiling, so NOTHING you feed it can clip. Pair with the in-app
# master-bus limiter (src/audio/masterBus.ts) for a belt-and-braces clean mix.
set -euo pipefail

IN="${1:?usage: master-audio.sh <input> <role> [output.ogg]}"
ROLE="${2:?role required: music|loop|sfx|stinger|win}"
OUT="${3:-}"
[ -z "$OUT" ] && OUT="${IN%.*}.mastered.ogg"

case "$ROLE" in
  music)   LUFS=-20; TP=-3.0 ;;
  loop)    LUFS=-24; TP=-6.0 ;;
  stinger) LUFS=-15; TP=-2.0 ;;
  win)     LUFS=-14; TP=-1.5 ;;
  sfx)     LUFS="";  TP=-4.0 ;;   # peak-normalised, not LUFS (too short to gate)
  *) echo "unknown role '$ROLE' (music|loop|sfx|stinger|win)"; exit 1 ;;
esac

# alimiter limit as a linear amplitude from the dBTP ceiling: 10^(dB/20)
LIMIT=$(awk "BEGIN{printf \"%.4f\", exp($TP/20*log(10))}")

tmp_log=$(mktemp)
if [ -n "$LUFS" ]; then
  # --- Long material: two-pass EBU R128 loudnorm to hit LUFS exactly, then a
  #     true-peak brick-wall at the ceiling. ---
  # Pass 1: measure.
  ffmpeg -hide_banner -nostats -i "$IN" \
    -af "loudnorm=I=${LUFS}:TP=${TP}:LRA=11:print_format=json" \
    -f null - 2>"$tmp_log" || true
  meas_i=$(grep -o '"input_i" : "[^"]*"' "$tmp_log" | grep -o '[-0-9.]*' | head -1)
  meas_tp=$(grep -o '"input_tp" : "[^"]*"' "$tmp_log" | grep -o '[-0-9.]*' | head -1)
  meas_lra=$(grep -o '"input_lra" : "[^"]*"' "$tmp_log" | grep -o '[-0-9.]*' | head -1)
  meas_thresh=$(grep -o '"input_thresh" : "[^"]*"' "$tmp_log" | grep -o '[-0-9.]*' | head -1)
  if [ -n "$meas_i" ]; then
    FILT="loudnorm=I=${LUFS}:TP=${TP}:LRA=11:measured_I=${meas_i}:measured_TP=${meas_tp}:measured_LRA=${meas_lra}:measured_thresh=${meas_thresh}:linear=true"
  else
    FILT="loudnorm=I=${LUFS}:TP=${TP}:LRA=11"   # fallback: single-pass
  fi
  FILT="${FILT},alimiter=limit=${LIMIT}:attack=1:release=50:level=disabled"
else
  # --- Short one-shots: peak-normalise to the ceiling, then limit. dynaudnorm
  #     off (would pump a transient); a soft alimiter guarantees no over. ---
  # NOTE: parse AFTER the colon — the "[Parsed_astats_0 @ 0x...]" prefix would
  # otherwise hand us the "0" from the filter name and under-gain every SFX.
  peak_db=$(ffmpeg -hide_banner -i "$IN" -af "astats=metadata=1" -f null - 2>&1 \
    | grep -m1 "Peak level dB" | sed 's/.*Peak level dB: *//' | tr -d '[:space:]')
  [ "$peak_db" = "inf" ] && peak_db=0
  gain=$(awk "BEGIN{printf \"%.2f\", ($TP)-($peak_db)}")
  FILT="volume=${gain}dB,alimiter=limit=${LIMIT}:attack=1:release=50:level=disabled"
fi

ffmpeg -hide_banner -loglevel error -y -i "$IN" \
  -af "$FILT" -ar 48000 -c:a libvorbis -q:a 5 "$OUT"
rm -f "$tmp_log"

# Verify the result and print before/after so you can trust it. Never let the
# verify step fail the script (the master is already written).
set +e
after=$(ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1)
aI=$(echo "$after" | grep -oE "I:\s+[-0-9.]+ LUFS" | tail -1 | grep -oE "[-0-9.]+" | head -1)
aTP=$(echo "$after" | grep -oE "Peak:\s+[-0-9.]+ dBFS" | tail -1 | grep -oE "[-0-9.]+" | head -1)
echo "[mastered] $OUT  (role=$ROLE)  ->  ${aI:-?} LUFS  truepeak ${aTP:-?} dBTP  (ceiling ${TP})"

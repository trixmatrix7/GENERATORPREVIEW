#!/bin/bash
# make_sheet.sh IN OUT SIZE COLS ROWS KEY [ASPECT]
# Chroma-keys magenta (KEY=1) and montages evenly-sampled frames into a grid PNG.
# ASPECT: "square" (default, pad to SIZExSIZE) or "wide" (SIZE = WxH like 512x288, no pad).
set -e
IN="$1"; OUT="$2"; SIZE="$3"; COLS="$4"; ROWS="$5"; KEY="$6"; ASPECT="${7:-square}"
COUNT=$((COLS*ROWS))
TMP=$(mktemp -d)
TOTAL=$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$IN" 2>/dev/null | tr -d '[:space:]')
STEP=$(( TOTAL / COUNT )); [ "$STEP" -lt 1 ] && STEP=1

KEYF=""
if [ "$KEY" = "1" ]; then
  # magenta key (#F60BF3). similarity/blend tuned for clean cartoon edges.
  KEYF="colorkey=0xF60BF3:0.30:0.12,"
fi

if [ "$ASPECT" = "wide" ]; then
  W="${SIZE%x*}"; H="${SIZE#*x}"
  SCALEF="scale=${W}:${H}"
  FRAMESIZE="$SIZE"
else
  SCALEF="scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease,pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
  FRAMESIZE="${SIZE}x${SIZE}"
fi

ffmpeg -y -v error -i "$IN" \
  -vf "select='not(mod(n\,${STEP}))',${KEYF}${SCALEF},setsar=1" \
  -vsync 0 -frames:v $COUNT "$TMP/f_%03d.png"

# pad missing frames (if fewer produced) by holding the last
GOT=$(ls "$TMP"/f_*.png | wc -l | tr -d '[:space:]')
LAST=$(ls "$TMP"/f_*.png | tail -1)
i=$((GOT+1))
while [ $i -le $COUNT ]; do cp "$LAST" "$(printf "$TMP/f_%03d.png" $i)"; i=$((i+1)); done

ffmpeg -y -v error -i "$TMP/f_%03d.png" \
  -filter_complex "tile=${COLS}x${ROWS}:padding=0:color=0x00000000" -frames:v 1 "$OUT"
rm -rf "$TMP"
echo "OK $OUT  ${COLS}x${ROWS} @ ${FRAMESIZE}  (from $TOTAL frames, step $STEP)"

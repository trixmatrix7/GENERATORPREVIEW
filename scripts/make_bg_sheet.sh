#!/bin/bash
# bg_sheet.sh IN OUTBASE FRAME_W FRAME_H COLS ROWS NSHEETS
# Splits an mp4 into NSHEETS spritesheets of COLSxROWS frames each (no key, full frame).
set -e
IN="$1"; OUTBASE="$2"; FW="$3"; FH="$4"; COLS="$5"; ROWS="$6"; NSHEETS="$7"
PERSHEET=$((COLS*ROWS)); TOTAL_WANT=$((PERSHEET*NSHEETS))
TMP=$(mktemp -d)
SRCFRAMES=$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$IN" 2>/dev/null | tr -d '[:space:]')
STEP=$(( SRCFRAMES / TOTAL_WANT )); [ "$STEP" -lt 1 ] && STEP=1
ffmpeg -y -v error -i "$IN" -vf "select='not(mod(n\,${STEP}))',scale=${FW}:${FH},setsar=1" -vsync 0 -frames:v $TOTAL_WANT "$TMP/f_%04d.png"
# pad short
GOT=$(ls "$TMP"/f_*.png | wc -l | tr -d '[:space:]'); LAST=$(ls "$TMP"/f_*.png | tail -1)
i=$((GOT+1)); while [ $i -le $TOTAL_WANT ]; do cp "$LAST" "$(printf "$TMP/f_%04d.png" $i)"; i=$((i+1)); done
# tile per sheet
for s in $(seq 0 $((NSHEETS-1))); do
  START=$((s*PERSHEET+1))
  ffmpeg -y -v error -start_number $START -i "$TMP/f_%04d.png" \
    -filter_complex "tile=${COLS}x${ROWS}:padding=0" -frames:v 1 "${OUTBASE}_$((s+1)).png"
done
rm -rf "$TMP"
echo "OK ${OUTBASE}_[1..${NSHEETS}].png  ${COLS}x${ROWS} @ ${FW}x${FH}  ($TOTAL_WANT frames from $SRCFRAMES, step $STEP)"

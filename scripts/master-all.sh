#!/usr/bin/env bash
# master-all.sh — batch-master a whole slot's raw sounds using a role manifest.
#
# Usage:
#   scripts/master-all.sh <manifest.tsv> <indir> <outdir>
#
# manifest.tsv = one "<filename><TAB><role>" line per sound (blank lines / #
# comments ignored). Roles: music|loop|sfx|stinger|win (see master-audio.sh).
# This is the whole-slot workflow: drop raw Suno exports in <indir>, list them
# in the manifest with a role each, run once — every file comes out clean and
# level-matched into <outdir>.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="${1:?usage: master-all.sh <manifest.tsv> <indir> <outdir>}"
INDIR="${2:?indir required}"
OUTDIR="${3:?outdir required}"
mkdir -p "$OUTDIR"

n=0; ok=0
while IFS=$'\t' read -r file role rest; do
  [ -z "${file:-}" ] && continue
  case "$file" in \#*) continue ;; esac
  role="$(echo "$role" | tr -d '[:space:]')"
  # accept either an exact file or a basename to search for
  src="$INDIR/$file"
  [ -f "$src" ] || src="$(find "$INDIR" -name "$file" -print -quit 2>/dev/null)"
  if [ -z "$src" ] || [ ! -f "$src" ]; then echo "  MISSING: $file"; continue; fi
  base="$(basename "${file%.*}").ogg"
  n=$((n+1))
  if bash "$HERE/master-audio.sh" "$src" "$role" "$OUTDIR/$base" 2>&1; then ok=$((ok+1)); fi
done < "$MANIFEST"
echo "---- mastered $ok/$n files into $OUTDIR ----"

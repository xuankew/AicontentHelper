#!/usr/bin/env bash
# Sync split pagination templates from vendor/moka (run `git clone` into vendor/moka first).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/vendor/moka/src/components/templates/split"
COM="$ROOT/vendor/moka/src/components/common"
DST="$ROOT/src/moka-upstream"
if [[ ! -d "$SRC" ]]; then
  echo "缺失 $SRC ，请先在仓库根目录执行：git clone --depth 1 https://github.com/OLD-SIX-AI-TEAM/moka.git vendor/moka"
  exit 1
fi
mkdir -p "$DST/split" "$DST/common"
cp "$SRC"/*.jsx "$DST/split/"
cp "$COM/EditableText.jsx" "$COM/EditableEmoji.jsx" "$DST/common/"
for j in "$DST/split"/*.jsx; do
  sed -i '' 's|from "../../common/|from "../common/|g' "$j"
  sed -i '' 's|from "../../../constants"|from "../constants"|g' "$j"
done
echo "Synced Moka split templates -> $DST"

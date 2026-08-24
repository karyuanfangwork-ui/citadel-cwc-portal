#!/usr/bin/env bash
# Convert all handover Markdown docs (credit + ESM) to styled PDFs.
# Usage: bash scripts/md_to_pdf_all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONV="$ROOT/scripts/md_to_pdf.py"
cd "$ROOT"

# Make sure the dependency is present.
python3 -c "import reportlab" 2>/dev/null || { echo "Missing reportlab. Run: python3 -m pip install reportlab pypdf"; exit 1; }

for dir in docs/handover docs/handover-esm; do
  for md in "$dir"/*.md; do
    out="${md%.md}.pdf"
    echo "==> $md -> $out"
    python3 "$CONV" "$md" -o "$out" --page-size A4 --title "$(basename "$md" .md)" --author "CWC 2.0 Maintainer Handover"
  done
done

echo
echo "Done. PDFs written next to their source Markdown files."

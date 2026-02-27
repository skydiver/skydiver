#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "  1) Pull — discover new repos from GitHub"
echo "  2) Sync — regenerate README.md from config"
echo "  3) Commit — commit updated README.md"
echo ""
read -rp "  Choose [1-3]: " choice
echo ""

case "$choice" in
  1)
    deno run --allow-run --allow-read --allow-write scripts/pull.ts
    ;;
  2)
    deno run --allow-run --allow-read --allow-write scripts/sync.ts
    ;;
  3)
    git add README.md
    git commit -m "Sync README.md"
    ;;
  *)
    echo "Invalid option"
    exit 1
    ;;
esac

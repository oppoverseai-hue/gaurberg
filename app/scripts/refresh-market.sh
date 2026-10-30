#!/bin/bash
# Daily market-data refresh (DEM-1, DEM-3). Run by launchd at 19:00 Makassar time, or by hand: bash scripts/refresh-market.sh
# Refreshes quote, fundamentals, profile and next earnings in data/market/*.json for the mapped US-listed companies.
# Keeps the saved price bars (--no-history). Reads keys from app/.env; never prints them. Writes no database rows.
set -u
APP="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$HOME/Library/Logs/gaurberg-refresh.log"
mkdir -p "$(dirname "$LOG")"
# launchd starts with a bare PATH: find node the way a terminal would (nvm, Homebrew, system).
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.bun/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
cd "$APP" || exit 1
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') refresh start"
  node --env-file=.env scripts/save-market.mjs --no-history 2>&1 | grep -v "MODULE_TYPELESS\|Reparsing\|To eliminate\|trace-warnings"
  echo "=== exit ${PIPESTATUS[0]} at $(date '+%H:%M:%S')"
} >> "$LOG" 2>&1

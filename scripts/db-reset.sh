#!/usr/bin/env bash
# HopOn — reset local database to a clean migrated + seeded state.
# Safe by construction: operates on the LOCAL stack only (no --linked flag ever).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Resetting local database (migrations + seed.sql)…"
supabase db reset
echo "✓ Local database reset complete."
echo "  Studio: http://127.0.0.1:54323"

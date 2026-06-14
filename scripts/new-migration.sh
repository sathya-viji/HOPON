#!/usr/bin/env bash
# HopOn — create a new migration file with the frozen naming convention.
# Usage: ./scripts/new-migration.sh 0001_extensions
# Produces: supabase/migrations/<timestamp>_0001_extensions.sql
# The NNNN prefix in the name must follow the execution doc's migration order.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "Usage: $0 <NNNN_name>   e.g. $0 0001_extensions" >&2
  exit 1
fi
if ! [[ "$1" =~ ^[0-9]{4}_[a-z0-9_]+$ ]]; then
  echo "Error: name must match NNNN_snake_case (execution doc migration order)." >&2
  exit 1
fi

supabase migration new "$1"
echo "✓ Created migration $1. Write idempotent SQL (create ... if not exists / or replace)."

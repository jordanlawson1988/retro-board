#!/usr/bin/env bash
# supabase-env-guard.sh
# Pre-tool hook that warns when supabase CLI target and .env.local point to different environments.
# Adapted from Harman's Desserts hook for Retro Board project (Vite-based).

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

# Only check supabase-related commands
if ! echo "$TOOL_INPUT" | grep -qE 'supabase (db push|db execute|migration|link)'; then
  echo '{}'
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/Users/jordan.lawson/Projects/retro-board}"

# Read the linked project ref
PROJECT_REF_FILE="$PROJECT_DIR/supabase/.temp/project-ref"
if [ ! -f "$PROJECT_REF_FILE" ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"WARNING: supabase/.temp/project-ref not found. Run supabase link first before pushing migrations."}}'
  exit 0
fi
LINKED_REF=$(tr -d '[:space:]' < "$PROJECT_REF_FILE")

# Read the .env.local SUPABASE_URL (Retro Board uses VITE_SUPABASE_URL prefix)
ENV_FILE="$PROJECT_DIR/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"WARNING: .env.local not found. Cannot verify environment alignment."}}'
  exit 0
fi
ENV_URL=$(grep -E '^(VITE_|NEXT_PUBLIC_)?SUPABASE_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]"'\''')

# Extract project ref from the URL (format: https://<ref>.supabase.co)
ENV_REF=$(echo "$ENV_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co.*|\1|p')

# If they match, report and continue
if [ "$LINKED_REF" = "$ENV_REF" ]; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"Supabase env check PASSED: CLI linked to $LINKED_REF, .env.local points to $ENV_REF.\"}}"
  exit 0
fi

# MISMATCH - warn loudly
echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"DANGER: ENVIRONMENT MISMATCH!\\n\\nSupabase CLI is linked to: $LINKED_REF\\n.env.local SUPABASE_URL points to: $ENV_REF\\n\\nRunning supabase db push will push migrations to the CLI-linked project while the app connects to a different project.\\n\\nTo fix: supabase link --project-ref <correct-ref>\\n\\nSTOP and confirm with Jordan before proceeding.\"}}"
exit 0

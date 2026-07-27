#!/usr/bin/env bash
# skill-stats: track Claude Code skill + agent invocations to a local JSONL.
#
# Fires from PreToolUse on Skill|Task. Reads the hook payload from stdin
# (JSON with tool_name and tool_input), appends one line to the log, and
# exits 0 no matter what — never blocks the tool call, never surfaces an
# error to Claude.
#
# Log format: one JSON object per line, keys: ts, tool, name, cwd.

set +e
umask 077

LOG="${SKILL_STATS_LOG:-$HOME/.claude/skill-usage.jsonl}"
LOG_DIR="$(dirname "$LOG")"
mkdir -p "$LOG_DIR" 2>/dev/null || exit 0
[ -e "$LOG" ] || { touch "$LOG" 2>/dev/null && chmod 600 "$LOG" 2>/dev/null; }

PAYLOAD="$(cat 2>/dev/null || echo '{}')"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
CWD="$(pwd 2>/dev/null || echo '')"

TOOL="unknown"
NAME="unknown"

if command -v jq >/dev/null 2>&1; then
  TOOL="$(printf '%s' "$PAYLOAD" | jq -r '.tool_name // "unknown"' 2>/dev/null || echo unknown)"
  NAME="$(printf '%s' "$PAYLOAD" | jq -r '
    .tool_input.subagent_type
    // .tool_input.skill
    // .tool_input.command
    // .tool_input.name
    // "unknown"
  ' 2>/dev/null || echo unknown)"
fi

# Escape any embedded quotes/backslashes for safe JSON.
esc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

printf '{"ts":"%s","tool":"%s","name":"%s","cwd":"%s"}\n' \
  "$(esc "$TS")" "$(esc "$TOOL")" "$(esc "$NAME")" "$(esc "$CWD")" \
  >> "$LOG" 2>/dev/null

exit 0

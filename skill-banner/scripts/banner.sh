#!/usr/bin/env bash
# skill-banner — one banner every time a skill starts.
#
# Claude Code runs this on two hook events and pipes the event's JSON in on stdin:
#   UserPromptSubmit     you typed a slash command      → "prompt": "/name ..."
#   PreToolUse (Skill)   Claude picked a skill itself   → "tool_name": "Skill", "tool_input": {"skill": "name"}
#
# It prints one JSON line carrying a systemMessage, which Claude Code shows on screen.
# It never blocks: every exit is 0. It writes no files and makes no network calls.
#
# From The AI Kitchen by Alex Tong — https://alextong.me/kitchen
#
# Requires: bash, grep, sed. No jq.

input=$(cat 2>/dev/null) || exit 0
name=""

# Claude picked it: the skill name sits in tool_input.
if printf '%s' "$input" | grep -qE '"tool_name" *: *"Skill"'; then
  name=$(printf '%s' "$input" | sed -nE 's/.*"skill" *: *"([A-Za-z0-9_:.-]+)".*/\1/p' | head -n 1)
fi

# You typed it: the prompt starts with /name, and the name ends at a space, a quote,
# a JSON escape (\n) or the end of the value — so a pasted path like /tmp/notes.md stays quiet.
if [ -z "$name" ]; then
  name=$(printf '%s' "$input" | sed -nE 's/.*"prompt" *: *"\/([A-Za-z0-9_:.-]+)([ "\\].*)?$/\1/p' | head -n 1)
fi

[ -z "$name" ] && exit 0

# A plugin skill arrives as plugin:skill. Show just the skill, as a typed command does.
name="${name##*:}"
[ -z "$name" ] && exit 0

# The name is limited to the characters above, so this is always valid JSON.
# The leading \n puts the box on its own line under Claude Code's "<hook> says:" label.
printf '{"systemMessage":"\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n▶ RUNNING SKILL   %s\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"}\n' "$name"
exit 0

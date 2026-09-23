#!/usr/bin/env bash
# Claude Code status line — compact two-line
# Line 1: model  effort  project  branch
# Line 2: context % left   session cost   session duration
#
# From The AI Kitchen by Alex Tong — https://alextong.me/kitchen
#
# Requires: jq
# Input: JSON via stdin (Claude Code pipes session state in on every render)

input=$(cat)

# ── Parse ─────────────────────────────────────────────────────────────────────
cwd=$(echo "$input" | jq -r '.cwd // ""')
project=$(basename "${cwd:-$PWD}")
branch=$(GIT_OPTIONAL_LOCKS=0 git -C "${cwd:-$PWD}" symbolic-ref --short HEAD 2>/dev/null \
         || GIT_OPTIONAL_LOCKS=0 git -C "${cwd:-$PWD}" rev-parse --short HEAD 2>/dev/null)
model=$(echo "$input" | jq -r '.model.display_name // .model.id // ""')
# Effort: the session's level when Claude Code reports it; otherwise the level
# stamped on the last assistant message in the transcript.
effort=$(echo "$input" | jq -r '.effort.level // empty')
if [[ -z "$effort" ]]; then
  transcript=$(echo "$input" | jq -r '.transcript_path // empty')
  if [[ -n "$transcript" && -r "$transcript" ]]; then
    effort=$(tail -c 400000 "$transcript" 2>/dev/null | grep -o '"effort":"[a-z]*"' | tail -1 | cut -d'"' -f4)
  fi
fi
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')
cost=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')
duration_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // empty')

# Worktree detection
in_worktree=0
if git -C "${cwd:-$PWD}" rev-parse --git-dir 2>/dev/null | grep -q '/worktrees/'; then
  in_worktree=1
fi

# Truncate long strings
truncate() { local s="$1" max="$2"; [[ ${#s} -gt $max ]] && echo "${s:0:$((max-1))}…" || echo "$s"; }
project=$(truncate "$project" 20)
branch=$(truncate "$branch" 18)

# ── Colors ────────────────────────────────────────────────────────────────────
r="\033[0m"; b="\033[1m"
amber="\033[38;2;229;181;103m"
white="\033[38;2;220;223;228m"
teal="\033[38;2;128;203;196m"
mint="\033[38;2;130;201;135m"
warn="\033[38;2;229;192;103m"
crit="\033[38;2;224;108;117m"
cash="\033[38;2;130;201;135m"
mute="\033[38;2;108;112;124m"
purple="\033[38;2;187;154;247m"

# ── Line 1: identity ─────────────────────────────────────────────────────────
case "$model" in
  *opus*|*Opus*)     sm="Opus" ;;
  *sonnet*|*Sonnet*) sm="Sonnet" ;;
  *haiku*|*Haiku*)   sm="Haiku" ;;
  *)                 sm="$model" ;;
esac
printf "${amber}${b}%s${r}" "$sm"
[[ -n "$effort" ]] && printf " ${mute}%s${r}" "$effort"
printf "  ${white}%s${r}" "$project"
if [[ -n "$branch" ]]; then
  if (( in_worktree )); then
    printf "  ${purple}⌥ %s${r}" "$branch"
  else
    printf "  ${teal}%s${r}" "$branch"
  fi
fi
printf "\n"

# ── Line 2: metrics ──────────────────────────────────────────────────────────
first=1

if [[ -n "$remaining" ]]; then
  pct=$(printf "%.0f" "$remaining")
  if (( pct > 50 )); then c="$mint"
  elif (( pct > 20 )); then c="$warn"
  else c="$crit"; fi
  printf "${c}${b}%s%%${r} ${c}left${r}" "$pct"
  first=0
fi

if [[ -n "$cost" && "$cost" != "null" ]]; then
  cost_fmt=$(printf '%.2f' "$cost")
  if [[ "$cost_fmt" != "0.00" ]]; then
    (( first )) || printf "  "
    printf "${cash}\$%s${r}" "$cost_fmt"
    first=0
  fi
fi

if [[ -n "$duration_ms" && "$duration_ms" != "null" ]]; then
  total_sec=$((duration_ms / 1000))
  if (( total_sec > 0 )); then
    mins=$((total_sec / 60))
    (( first )) || printf "  "
    if (( mins > 0 )); then
      printf "${mute}%dm${r}" "$mins"
    else
      printf "${mute}%ds${r}" "$total_sec"
    fi
    first=0
  fi
fi
printf "\n"

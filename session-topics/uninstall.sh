#!/bin/bash
# Session topics — stop it and remove the LaunchAgent. Your saved topics stay
# in ~/.claude/session-topics/ until you delete that folder yourself.
set -uo pipefail

LABEL="com.alextong.session-topics"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$PLIST"

printf 'Session topics is stopped and will not start at login.\n'
printf 'To remove its files and saved topics too, delete ~/.claude/session-topics\n'

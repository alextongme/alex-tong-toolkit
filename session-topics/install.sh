#!/bin/bash
# Session topics — install or update. Run from a clone of alex-tong-toolkit:
#   bash session-topics/install.sh
# Writes ~/.claude/session-topics/ and one LaunchAgent plist. Nothing else.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.claude/session-topics"
LABEL="com.alextong.session-topics"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

say()  { printf '%s\n' "$*"; }
fail() { printf 'Stopped: %s\n' "$*" >&2; exit 1; }

# Unreleased: locked until its video ships. Remove this block on release.
if [ "${1:-}" != "--preview" ]; then
  say "Session topics isn't released yet, so this installer is locked."
  say "It opens when its video is out: https://alextong.me/kitchen"
  exit 1
fi

# -- requirements (checked, never changed) ----------------------------------
[ "$(uname)" = "Darwin" ] || fail "macOS only (it runs as a LaunchAgent)."
[ -d /Applications/iTerm.app ] || [ -d "$HOME/Applications/iTerm.app" ] \
  || fail "iTerm2 not found. Install it from https://iterm2.com first."
command -v python3 >/dev/null || fail "python3 not found. Run: xcode-select --install"
command -v claude >/dev/null || fail "the claude CLI is not on your PATH. Install Claude Code and log in first."

API="$(defaults read com.googlecode.iterm2 EnableAPIServer 2>/dev/null || echo 0)"
if [ "$API" != "1" ]; then
  say "iTerm2's Python API is off. Turn it on, then run this again:"
  say "  iTerm2 > Settings > General > Magic > Enable Python API"
  exit 1
fi

# -- files ------------------------------------------------------------------
umask 077
mkdir -p "$DEST/static"
cp "$SRC/server.py" "$DEST/server.py"
cp "$SRC/static/index.html" "$DEST/static/index.html"
cp "$SRC/VERSION" "$DEST/VERSION"

if [ ! -x "$DEST/venv/bin/python" ]; then
  say "Creating a Python environment in $DEST/venv ..."
  python3 -m venv "$DEST/venv"
fi
say "Installing the iterm2 Python package from PyPI ..."
"$DEST/venv/bin/python" -m pip install --quiet --disable-pip-version-check -r "$SRC/requirements.txt"

# -- LaunchAgent: starts at login, restarts on crash -------------------------
CLAUDE_DIR="$(dirname "$(command -v claude)")"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$DEST/venv/bin/python</string>
    <string>-u</string>
    <string>$DEST/server.py</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$DEST</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$CLAUDE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>$HOME</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$DEST/logs/launchd.log</string>
  <key>StandardErrorPath</key>
  <string>$DEST/logs/launchd.log</string>
</dict>
</plist>
EOF
mkdir -p "$DEST/logs"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

say ""
say "Session topics $(cat "$SRC/VERSION") is running."
say "iTerm2 will ask once to allow the script to connect: choose Allow."
say "Show or hide the sidebar: View > Toolbelt > Show Toolbelt (Shift-Cmd-B)."
say ""
say "Optional: to have the sidebar name each tab after its conversation, add this"
say "line to your ~/.zshrc yourself and restart Claude Code:"
say "  export CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1"

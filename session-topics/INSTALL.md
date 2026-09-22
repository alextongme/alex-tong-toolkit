# Session Topics  —  v0.1.0

> **Not released yet.** The installer is locked until the video that ships it is out. Follow [the Kitchen](https://alextong.me/kitchen) for the release.

A sidebar docked in iTerm2 that lists, in plain language, what the Claude Code conversation in the current tab has covered so far. It marks the topic you're on now, shows the question Claude is waiting on, and when a chat has drifted to a new subject, suggests starting a fresh one.

Switch tabs and the sidebar switches with you.

---

## Requirements

- **macOS** and **iTerm2 3.7 or newer**
- **iTerm2's Python API turned on:** iTerm2 > Settings > General > Magic > Enable Python API
- **Claude Code**, logged in, with `claude` on your PATH
- **python3**, which comes with the Xcode command line tools (`xcode-select --install`)

It doesn't work in other terminals. The docked panel and following the focused tab both come from iTerm2's API.

## Install (about a minute)

From the root of a clone of this repo:

```bash
bash session-topics/install.sh
```

iTerm2 asks once whether to let the script connect. Choose **Allow**. Then open the sidebar with **View > Toolbelt > Show Toolbelt** (Shift-Cmd-B).

Run the same command again to update.

### Optional: name tabs after their conversation

Claude Code normally sets the tab title itself. To let the sidebar name each tab with the conversation's plain-language title instead, add this line to your `~/.zshrc` yourself and restart Claude Code:

```bash
export CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1
```

The installer never edits your shell profile.

## What it touches

| Where | What |
|---|---|
| `~/.claude/session-topics/` | The server, its Python environment, saved topics and logs. Files are readable by you only. |
| `~/Library/LaunchAgents/com.alextong.session-topics.plist` | Starts it at login and restarts it if it crashes. |

It reads your Claude Code conversations from `~/.claude/` to work out the topics. It never writes to them.

## Network

- **At install:** `pip` downloads the `iterm2` Python package from PyPI.
- **While running:** each finished turn is sent to Claude Haiku through your own `claude` CLI, on your own subscription. That's the only outbound call.
- The sidebar page is served on `127.0.0.1:48231`, which only your machine can reach.

Nothing is sent anywhere else. No telemetry.

## The fresh-chat card

When a conversation has moved to a new subject, a card suggests starting a new chat. If you have the [handoff](../handoff) plugin, the card gives you a `/handoff` command that carries the newest topic over. Without it, the card gives a plain line to paste after `/clear`, plus a button that copies the command to install handoff.

## Uninstall

```bash
bash session-topics/uninstall.sh
```

That stops it and removes the LaunchAgent. Your saved topics stay in `~/.claude/session-topics/` until you delete that folder.

## Troubleshooting

- **The sidebar says it can't connect.** Check the Python API setting above, then run the installer again.
- **Topics never appear.** Run `claude -p "hi"` in a terminal. If that fails, the sidebar can't reach Haiku either.
- **Logs:** `~/.claude/session-topics/logs/server.log`

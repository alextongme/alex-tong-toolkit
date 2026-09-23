---
name: setup
description: Alex Tong's status line setup. Points Claude Code's status line at this plugin's script, after showing the change and getting one yes. Backs up settings.json first and changes only its statusLine key. Also removes it again when asked.
argument-hint: "(optional) remove"
disable-model-invocation: true
model: inherit
---

# /statusline:setup

A plugin can't set the status line itself, so this skill makes the one settings change for the user, with their approval. It touches exactly two things: a copy of the script in the plugin's data folder, and the `statusLine` key in `~/.claude/settings.json`.

**Never print `~/.claude/settings.json`.** It can hold tokens and API keys. Read only the `statusLine` key with `jq`, as below.

The script path used everywhere below:

```
~/.claude/plugins/data/statusline-alex-tong-toolkit/statusline-command.sh
```

## 1. Check, in one Bash call

```bash
command -v jq >/dev/null && echo "jq: ok" || echo "jq: missing"
mkdir -p ~/.claude/plugins/data/statusline-alex-tong-toolkit && cp "${CLAUDE_PLUGIN_ROOT}/statusline-command.sh" ~/.claude/plugins/data/statusline-alex-tong-toolkit/statusline-command.sh && chmod 600 ~/.claude/plugins/data/statusline-alex-tong-toolkit/statusline-command.sh && echo "script: ok"
[ -f ~/.claude/settings.json ] && jq -c '.statusLine // "none"' ~/.claude/settings.json || echo "settings.json: missing"
```

- **`jq: missing`:** stop. Tell the user the script needs `jq` (`brew install jq` on macOS, `sudo apt install jq` on Debian or Ubuntu), then to run `/statusline:setup` again.
- **`jq` prints a parse error:** stop. `settings.json` isn't valid JSON, and writing to it would make things worse. Tell the user, and suggest `jq . ~/.claude/settings.json` to find the line.
- **The argument is `remove`:** go to step 4.
- **`statusLine` already points at the path above:** say it's already set up and stop.

## 2. Show the change and ask once

Show what `statusLine` is now (or that there isn't one), and what it will become:

```json
"statusLine": {
  "type": "command",
  "command": "bash ~/.claude/plugins/data/statusline-alex-tong-toolkit/statusline-command.sh"
}
```

If the user already has a different `statusLine`, say plainly that it will be replaced and that the backup keeps it.

Ask one question: **Apply this change? (recommended: yes)**. Then stop and wait. Do not write anything before a yes.

## 3. Apply, after a yes

```bash
f=~/.claude/settings.json
[ -f "$f" ] || echo '{}' > "$f"
cp "$f" "$f.bak-statusline" && chmod 600 "$f.bak-statusline"
tmp=$(mktemp) && jq '.statusLine = {"type": "command", "command": "bash ~/.claude/plugins/data/statusline-alex-tong-toolkit/statusline-command.sh"}' "$f" > "$tmp" && mv "$tmp" "$f" && jq -c '.statusLine' "$f"
```

Confirm from the last line that `statusLine` now points at the script. Tell the user:

- The status line should appear within a few seconds. If it doesn't, start a new session.
- The old settings are saved at `~/.claude/settings.json.bak-statusline`.
- Before uninstalling the plugin, run `/statusline:setup remove`, or the status line goes blank.

## 4. Remove, when the argument is `remove`

Only remove a `statusLine` that points at this plugin's script. If it points somewhere else, say so and stop, because it isn't ours to remove.

Show that `statusLine` will be removed, ask **Remove it? (recommended: yes)**, and wait. After a yes:

```bash
f=~/.claude/settings.json
cp "$f" "$f.bak-statusline" && chmod 600 "$f.bak-statusline"
tmp=$(mktemp) && jq 'del(.statusLine)' "$f" > "$tmp" && mv "$tmp" "$f" && jq -c '.statusLine // "none"' "$f"
```

Tell the user it's removed, and that they can now uninstall the plugin.

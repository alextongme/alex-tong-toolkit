# Status Line  —  v1.3.0

Replaces the default Claude Code status line with a compact two-line readout:

```
Opus high  my-project  main
82% left  $1.47  14m
```

**Line 1** — model, effort level, project folder, git branch. A branch in a worktree shows as `⌥ branch` in purple, so you always know which tree you're in.

**Line 2** — how much context window is left (green above 50%, amber above 20%, red below), what this session has cost you so far, and how long it's been running. Each piece only appears when Claude Code reports it, so a fresh session stays quiet.

The context percentage is the point. Knowing you're at 12% *before* Claude starts forgetting the thing you told it forty messages ago is the difference between compacting on purpose and getting compacted by surprise.

---

## Requirements

**`jq`** — the script parses the JSON Claude Code pipes in. Check first, because you may already have it:

```bash
jq --version
```

Recent macOS ships `jq` at `/usr/bin/jq` (it reports as `jq-1.7.1-apple`), so most Mac users need to do nothing here. If the command errors, install it:

- **macOS:** `brew install jq`
- **Debian / Ubuntu:** `sudo apt install jq`
- **Windows:** use WSL, or `winget install jqlang.jq`

## Install (about a minute)

**1. Install the plugin.** The install command is in The AI Kitchen's Classroom with the rest of the toolkit — https://alextong.me/kitchen. From then on, every session start copies the script to `~/.claude/plugins/data/statusline-alex-tong-toolkit/statusline-command.sh`. That folder keeps its path across plugin updates, so `/plugin update` updates your status line too.

**2. Run `/statusline:setup`.** A plugin can't set your status line itself, so this command does it for you. It shows the change, waits for your yes, backs up `~/.claude/settings.json`, and sets only its `statusLine` key.

Rather do it by hand? Add this block at the top level of `~/.claude/settings.json`, alongside whatever is already in there:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash ~/.claude/plugins/data/statusline-alex-tong-toolkit/statusline-command.sh"
  }
}
```

**3. Look at the bottom of the terminal.** The status line shows up within a few seconds. If it doesn't, start a new session.

**Uninstalling:** run `/statusline:setup remove` first, or remove the `statusLine` block from `~/.claude/settings.json` yourself. Uninstalling the plugin deletes the script's folder, so a leftover block points at nothing and the status line goes blank.

## Customizing it

It's a bash script — everything is editable. The plugin overwrites its copy at `~/.claude/plugins/data/statusline-alex-tong-toolkit/statusline-command.sh` on every session start, so edit your own copy instead: `cp ~/.claude/plugins/data/statusline-alex-tong-toolkit/statusline-command.sh ~/.claude/statusline-command.sh`, then point the `statusLine` block at `~/.claude/statusline-command.sh`. Your copy won't get updates after that. The four things people usually change are:

- **Colors** — the block near the top under `── Colors ──`. They're 24-bit RGB escapes (`\033[38;2;R;G;Bm`), so any hex color drops straight in.
- **The context thresholds** — the `pct > 50` and `pct > 20` lines decide when green becomes amber becomes red.
- **What's on line 2** — each metric is its own `if` block. Delete the cost block if you're on a flat plan and it's just noise.
- **Truncation widths** — `truncate "$project" 20` and `truncate "$branch" 18`. Raise them if you have a wide terminal and long branch names.

To test a change without restarting, pipe fake state at it:

```bash
echo '{"cwd":"'"$PWD"'","model":{"display_name":"Opus"},"context_window":{"remaining_percentage":42},"cost":{"total_cost_usd":1.23,"total_duration_ms":840000}}' | bash ~/.claude/statusline-command.sh
```

(Point that at whichever copy you're testing.)

## Updating

`/plugin update`. The next session start copies the new script into place; nothing else to do. **The AI Kitchen posts a one-line changelog every time a version lands** — https://alextong.me/kitchen

Your version: see `VERSION` in this folder.

## Troubleshooting

- **You see the folder and branch, but no model name and an empty second line.** That's the missing-`jq` signature — every field it parses comes back empty. Run `jq --version`.
- **Line 1 is fine but the context percentage or cost never appears.** Your Claude Code version isn't reporting `context_window` or `cost` in the status line payload. Update Claude Code.
- **Nothing appears at all.** The `statusLine` block isn't being read. Check `~/.claude/settings.json` is valid JSON (`jq . ~/.claude/settings.json` will tell you), and that you restarted Claude Code.
- **Colors look wrong or show as raw escape codes.** Your terminal doesn't support 24-bit color. iTerm2, Ghostty, Alacritty, WezTerm, and modern Terminal.app all do; older setups may not.
- **Blank status line right after installing.** The copy happens on session start, so start a new session.

---

*From **The AI Kitchen** by [Alex Tong](https://alextong.me). Questions, or it didn't work?
Post in the community — https://alextong.me/kitchen*

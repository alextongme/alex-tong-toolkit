# alex-tong-toolkit

Claude Code plugin marketplace for [Alex Tong's Toolkit](https://alextong.me/toolkit).

## Versioning

**Bump the version on every push that changes skill behavior.** The plugin cache keys on `version` in `plugin.json` and `marketplace.json` — if you push changes without bumping, existing installs serve stale files from cache.

Both files must be updated in lockstep:
- `.claude-plugin/marketplace.json` → `metadata.version` and `plugins[0].version`
- `plugins/alex-tong-toolkit/.claude-plugin/plugin.json` → `version`

Use semver: patch for bug fixes, minor for new features or enforcement changes, major for breaking changes.

## Structure

```
.claude-plugin/marketplace.json          # Marketplace registry (top-level)
plugins/alex-tong-toolkit/
  .claude-plugin/plugin.json             # Plugin metadata
  skills/
    worksheet-maker/
      SKILL.md                           # Skill definition
      references/                        # Runtime reference files (read by skill)
    pr-summary-generator/
      SKILL.md
```

## Skills

- **worksheet-maker** — active (`user_invocable: true`). Creates printable HTML worksheets.
- **pr-summary-generator** — deactivated (`user_invocable: false`). Not ready yet.

## Testing changes

After pushing, verify the installed version updated:

```bash
find ~/.claude/plugins/cache -path "*alex-tong-toolkit*worksheet-maker/SKILL.md"
# Path should contain the new version number
head -25 <that-path>
# Should show latest frontmatter (e.g. allowed-tools)
```

If the cache still shows the old version, the version wasn't bumped.

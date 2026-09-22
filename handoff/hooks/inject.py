#!/usr/bin/env python3
"""SessionStart hook for /handoff.

If ~/.claude/handoff/seed.md exists and was written for the directory this
session is starting in, inject it as context and delete it. Otherwise do
nothing. Every failure path exits 0 with no output: this hook never blocks
Claude Code. Reads stdin, reads one file, writes stdout, no network.
"""
import json
import os
import re
import sys

try:
    data = json.load(sys.stdin)
    cwd = os.path.realpath(data.get("cwd") or os.getcwd())
    seed = os.path.join(os.path.expanduser("~"), ".claude", "handoff", "seed.md")
    if not os.path.isfile(seed):
        sys.exit(0)

    with open(seed, encoding="utf-8") as f:
        text = f.read()

    tag = re.match(r"<!-- handoff cwd=(.+?) written=(\S+) -->", text)
    if not tag or os.path.realpath(tag.group(1)) != cwd:
        sys.exit(0)  # written for another directory; leave it for that session

    os.remove(seed)  # consume once; last.md keeps the recovery copy
    written = tag.group(2)
    body = text[tag.end():].strip()
    first = next((ln for ln in body.splitlines() if ln.strip() and not ln.startswith("#")), "")

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": (
                "You are resuming a previous session from a handoff written "
                + written + ". Act on it directly; do not summarise it back "
                "to the user.\n\n" + body
            ),
            "systemMessage": "↩ handoff resumed (" + written + ") — " + first[:90],
        }
    }))
except Exception:
    pass
sys.exit(0)

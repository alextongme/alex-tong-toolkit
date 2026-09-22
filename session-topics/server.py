#!/usr/bin/env python3
"""Session topics: a docked iTerm2 Toolbelt sidebar listing the topics of the
Claude Code conversation running in the active terminal session.

What it does
  * serves a small page on 127.0.0.1:PORT and registers it as an iTerm2
    Toolbelt web-view tool ("Session topics")
  * watches live Claude Code conversations (~/.claude/sessions + transcripts)
  * after each finished turn asks Haiku (via `claude -p`) whether the exchange
    continues an existing topic or starts a new one
  * maps each iTerm2 session to its Claude conversation by tty, so the sidebar
    follows the active tab; topics persist in data/topics/<sessionId>.json

Show / hide the sidebar: View > Toolbelt > Show Toolbelt (Shift-Cmd-B).
Stop for good:  launchctl bootout gui/$(id -u)/com.alextong.session-topics
Start again:    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.alextong.session-topics.plist
Logs:           logs/server.log
"""
import asyncio
import json
import logging
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from logging.handlers import RotatingFileHandler
from pathlib import Path

import iterm2

try:                          # only used to recognise a socket iTerm2 has closed
    from websockets.exceptions import ConnectionClosed as WSClosed
except Exception:             # pragma: no cover - iterm2 ships websockets
    WSClosed = ()

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA = ROOT / "data" / "topics"
LOGS = ROOT / "logs"
FLAGS = ROOT / "data"
CLAUDE_HOME = Path(os.environ.get("CLAUDE_CONFIG_DIR", str(Path.home() / ".claude")))
PORT = int(os.environ.get("SESSION_TOPICS_PORT", "48231"))
TOOL_ID = "com.alextong.session-topics"
TOOL_NAME = "Session topics"
MODEL = os.environ.get("SESSION_TOPICS_MODEL", "claude-haiku-4-5-20251001")
TICK = 1.5                     # seconds between transcript scans
QUIET_SECS = 1.0               # transcript must be quiet this long after idle
MAX_BATCH = 60                 # oldest pending exchanges beyond this are skipped
BATCH_THRESHOLD = 4            # >= this many pending exchanges -> one batch call
MSG_CHARS = 500
REPLY_CHARS = 350
MAX_EXCHANGES_KEPT = 300
CONTEXT_MSGS = 2               # earlier user messages shown next to the newest one
RECONCILE_EVERY = 2.0          # seconds between direct reads of the focused iTerm2 session
NUDGE_MIN_EXCHANGES = 6        # no 'start a fresh chat' card in a short conversation
NUDGE_STREAK = 2               # ...and only after this many exchanges in a row drifted
FRESH_INSTALL = ("claude plugin marketplace add alextongme/alex-tong-toolkit"
                 " && claude plugin install fresh@alex-tong-toolkit")
PATH_AUG = ":".join([
    str(Path.home() / ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin",
    "/usr/bin", "/bin",
])

os.umask(0o077)                # topics and logs quote the conversation: owner-only
for d in (DATA, LOGS):
    d.mkdir(parents=True, exist_ok=True)

log = logging.getLogger("session-topics")
log.setLevel(logging.INFO)
_h = RotatingFileHandler(LOGS / "server.log", maxBytes=1_000_000, backupCount=3)
_h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
log.addHandler(_h)
log.addHandler(logging.StreamHandler(sys.stdout))

LOCK = threading.RLock()
STOP = threading.Event()


def find_claude():
    env_path = os.environ.get("PATH", "")
    found = shutil.which("claude", path=PATH_AUG + ":" + env_path)
    return found or str(Path.home() / ".local/bin/claude")


CLAUDE_BIN = find_claude()

# --------------------------------------------------------------------------
# Conversation model
# --------------------------------------------------------------------------

class Conversation:
    def __init__(self, session_id, cwd, pid):
        self.session_id = session_id
        self.cwd = cwd
        self.pid = pid
        self.tty = None
        self.status = "idle"
        self.transcript = None
        self.offset = 0
        self.partial = b""
        self.title = None
        self.exchanges = []       # dicts: uuid, text, ts, reply
        self.topics = []          # dicts: label, first_ts, last_ts
        self.current = None       # index into topics
        self.question = None      # what Claude is waiting on the user to answer
        self.plain_title = None   # our own plain-language title for the conversation
        self.tab_named = None     # last title pushed to the iTerm2 tab
        self.tab_naming = None    # True when the claude process has title updates disabled
        self.processed_uuid = None
        self.processed_index = 0
        self.drift_streak = 0       # exchanges in a row unrelated to the original purpose
        self.nudge_dismissed = []   # topic labels whose fresh-chat card was dismissed
        self.revision = 0
        self.retries = 0
        self.retry_after = 0.0
        self.refresh = False        # rebuild topics once (old files without summaries)
        self.last_growth = 0.0
        self.last_seen = time.time()
        self.loaded = False

    # -- persistence -------------------------------------------------------
    @property
    def store(self):
        return DATA / f"{self.session_id}.json"

    def load(self):
        try:
            d = json.loads(self.store.read_text())
        except FileNotFoundError:
            return
        except Exception as e:
            log.warning("could not read %s: %r", self.store, e)
            return
        self.topics = [t for t in d.get("topics", []) if isinstance(t, dict) and t.get("label")]
        cur = d.get("current")
        self.current = cur if isinstance(cur, int) and 0 <= cur < len(self.topics) else None
        self.processed_uuid = d.get("processed_uuid")
        self.title = d.get("title") or self.title
        self.question = d.get("question") or None
        self.plain_title = d.get("plain_title") or None
        self.drift_streak = int(d.get("drift_streak") or 0)
        self.nudge_dismissed = [x for x in d.get("nudge_dismissed") or [] if isinstance(x, str)]
        self.refresh = bool(self.topics) and (
            any(not t.get("summary") for t in self.topics)
            or d.get("style_version") != STYLE_VERSION)
        if self.refresh:
            self.plain_title = None

    def save(self):
        d = {
            "sessionId": self.session_id,
            "cwd": self.cwd,
            "title": self.title,
            "topics": self.topics,
            "current": self.current,
            "question": self.question,
            "plain_title": self.plain_title,
            "processed_uuid": self.processed_uuid,
            "drift_streak": self.drift_streak,
            "nudge_dismissed": self.nudge_dismissed,
            "style_version": STYLE_VERSION,
            "updated": time.time(),
        }
        tmp = self.store.with_suffix(".tmp")
        tmp.write_text(json.dumps(d, indent=1))
        os.replace(tmp, self.store)

    # -- transcript --------------------------------------------------------
    def locate_transcript(self):
        if self.transcript and self.transcript.exists():
            return True
        hits = list((CLAUDE_HOME / "projects").glob(f"*/{self.session_id}.jsonl"))
        if not hits:
            return False
        hits.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        self.transcript = hits[0]
        return True

    def read_new(self):
        """Read appended transcript lines. Returns True if anything was read."""
        if not self.locate_transcript():
            return False
        size = self.transcript.stat().st_size
        if size < self.offset:
            self.offset, self.partial = 0, b""
        if size == self.offset:
            return False
        with open(self.transcript, "rb") as fh:
            fh.seek(self.offset)
            chunk = fh.read()
        self.offset = size
        data = self.partial + chunk
        lines = data.split(b"\n")
        self.partial = lines.pop()
        for line in lines:
            if line.strip():
                self.handle_line(line)
        self.last_growth = time.time()
        return True

    def handle_line(self, line):
        try:
            e = json.loads(line)
        except Exception:
            return
        t = e.get("type")
        if t == "user":
            if e.get("isMeta") or e.get("isCompactSummary"):
                return
            text = user_text(message_text(e.get("message", {}).get("content")))
            if not text or text.startswith("[Request interrupted"):
                return
            if self.question:
                self.question = None
                bump(self)
            self.exchanges.append({
                "uuid": e.get("uuid"),
                "text": text[:2000],
                "ts": e.get("timestamp"),
                "reply": "",
            })
            if len(self.exchanges) > MAX_EXCHANGES_KEPT:
                drop = len(self.exchanges) - MAX_EXCHANGES_KEPT
                self.exchanges = self.exchanges[drop:]
                self.processed_index = max(0, self.processed_index - drop)
        elif t == "assistant":
            if not self.exchanges:
                return
            for block in e.get("message", {}).get("content") or []:
                if isinstance(block, dict) and block.get("type") == "text" and block.get("text"):
                    self.exchanges[-1]["reply"] = block["text"][:1200]
        elif t == "ai-title":
            self.title = e.get("aiTitle") or self.title

    def sync_processed_index(self):
        """After a full read, align processed_index with the persisted uuid."""
        if self.processed_uuid:
            for i, x in enumerate(self.exchanges):
                if x["uuid"] == self.processed_uuid:
                    self.processed_index = i + 1
                    return
        self.processed_index = 0

    # -- readiness ---------------------------------------------------------
    def ready_pending(self):
        pend = self.exchanges[self.processed_index:]
        if not pend:
            return []
        if self.status == "idle" and time.time() - self.last_growth >= QUIET_SECS:
            return pend
        return pend[:-1]   # everything but the in-progress last exchange

    def nudge_public(self):
        """The 'start a fresh chat for this' card, or None."""
        if (self.drift_streak < NUDGE_STREAK or len(self.exchanges) < NUDGE_MIN_EXCHANGES
                or not self.topics or not self.current):
            return None
        cur = self.topics[self.current]["label"]
        if cur in self.nudge_dismissed:
            return None
        if fresh_installed():
            return {"from": self.topics[0]["label"], "to": cur, "fresh": True,
                    "command": f'/fresh:fresh only the newest topic: "{cur}". Leave out everything before it.'}
        return {"from": self.topics[0]["label"], "to": cur, "fresh": False,
                "command": f'Let\'s work on: "{cur}".'}

    def public(self):
        return {
            "sessionId": self.session_id,
            "cwd": self.cwd,
            "title": self.title,
            "plain_title": self.plain_title,
            "status": self.status,
            "topics": [{"label": t["label"], "summary": t.get("summary", "")} for t in self.topics],
            "current": self.current,
            "question": self.question,
            "pending": len(self.exchanges) - self.processed_index,
        }


_FRESH_CACHE = {"key": None, "val": False}


def fresh_installed():
    """True when the fresh skill is installed, as a plugin or a user skill. Cached on mtime."""
    reg = CLAUDE_HOME / "plugins" / "installed_plugins.json"
    skill = CLAUDE_HOME / "skills" / "fresh" / "SKILL.md"
    try:
        key = (reg.stat().st_mtime, skill.exists())
    except OSError:
        key = (None, skill.exists())
    if key != _FRESH_CACHE["key"]:
        val = key[1]
        if not val and key[0] is not None:
            try:
                plugins = json.loads(reg.read_text()).get("plugins") or {}
                val = any(k.split("@")[0] == "fresh" for k in plugins)
            except (OSError, ValueError, AttributeError):
                val = False
        _FRESH_CACHE.update(key=key, val=val)
    return _FRESH_CACHE["val"]


def message_text(content):
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for b in content:
            if isinstance(b, dict) and b.get("type") == "text" and b.get("text"):
                parts.append(b["text"])
        return "\n".join(parts).strip()
    return ""


# Wrappers Claude Code puts around text the user did not type as a message:
# slash-command echoes, local command output, background-task notices, hooks.
NOISE_TAGS = ("command-name", "command-message", "command-args", "command-contents",
              "local-command-stdout", "local-command-stderr", "local-command-caveat",
              "task-notification", "system-reminder", "bash-input", "bash-stdout",
              "bash-stderr", "user-prompt-submit-hook")
NOISE_RE = re.compile(r"<(%s)\b[^>]*>.*?</\1\b[^>]*>" % "|".join(NOISE_TAGS), re.S)
PASTE_TAG_RE = re.compile(r"</?pasted_content\b[^>]*>")
WRAPPED_RE = re.compile(r"<([a-z][\w-]*)\b[^>]*>.*</\1\b[^>]*>", re.S)


def user_text(text):
    """What the user actually said.

    Dictated and pasted text arrives wrapped in <pasted_content> tags. Until
    2026-09-22 every message starting with "<" was dropped as noise, which
    silently threw away 13% of all messages, and up to 26 of 32 in a
    dictation-heavy session. Now the known noise wrappers are cut out, paste
    tags are unwrapped, and only a message that is still one unknown wrapper
    and nothing else is skipped.
    """
    text = NOISE_RE.sub("", text or "")
    text = PASTE_TAG_RE.sub("", text).strip()
    if WRAPPED_RE.fullmatch(text):
        return ""
    return text


# --------------------------------------------------------------------------
# Global state
# --------------------------------------------------------------------------

CONVS = {}            # sessionId -> Conversation (live)
ITERM_TTY = {}        # iTerm2 session id -> tty path
THEME = {}            # iTerm2 session id -> colors/font of that session's profile
ACTIVE = {"iterm": None}
QUEUE = []            # sessionIds awaiting classification
QUEUE_CV = threading.Condition(LOCK)
STATE = {"seq": 0}    # bumped on every visible change; /api/state?wait=<seq> blocks until it moves
STATE_CV = threading.Condition(LOCK)


def touch():
    with STATE_CV:
        STATE["seq"] += 1
        STATE_CV.notify_all()


def bump(conv):
    conv.revision += 1
    touch()


def conv_for_tty(tty):
    if not tty:
        return None
    cands = [c for c in CONVS.values() if c.tty == tty]
    if not cands:
        return None
    cands.sort(key=lambda c: c.last_seen, reverse=True)
    return cands[0]


def page_version():
    try:
        return int((STATIC / "index.html").stat().st_mtime)
    except OSError:
        return 0


def state_json():
    with LOCK:
        sid = ACTIVE["iterm"]
        tty = ITERM_TTY.get(sid) if sid else None
        conv = conv_for_tty(tty)
        if conv is None:
            return {"version": f"none:{sid}", "seq": STATE["seq"], "iterm_session": sid,
                    "tty": tty, "conversation": None, "topics": [], "current": None,
                    "question": None, "nudge": None, "page": page_version(),
                    "theme": THEME.get(sid)}
        return {
            "version": f"{conv.session_id}:{conv.revision}",
            "seq": STATE["seq"],
            "iterm_session": sid, "tty": tty,
            "conversation": conv.public(),
            "topics": [{"label": t["label"], "summary": t.get("summary", "")} for t in conv.topics],
            "current": conv.current,
            "question": conv.question,
            "nudge": conv.nudge_public(),
            "page": page_version(),
            "theme": THEME.get(sid),
        }


def debug_json():
    with LOCK:
        return {
            "active_iterm_session": ACTIVE["iterm"],
            "iterm_tty": ITERM_TTY,
            "conversations": {sid: dict(c.public(), tty=c.tty, pid=c.pid,
                                        transcript=str(c.transcript),
                                        exchanges=len(c.exchanges),
                                        processed=c.processed_index)
                              for sid, c in CONVS.items()},
            "claude_bin": CLAUDE_BIN, "model": MODEL,
        }


# --------------------------------------------------------------------------
# Claude Code session discovery
# --------------------------------------------------------------------------

def pid_alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def tty_for_pid(pid):
    try:
        out = subprocess.run(["ps", "-o", "tty=", "-p", str(pid)],
                             capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:
        return None
    if not out or out == "??":
        return None
    return "/dev/" + out


def scan_live_sessions():
    live = {}
    sdir = CLAUDE_HOME / "sessions"
    if not sdir.is_dir():
        return live
    for f in sdir.glob("*.json"):
        try:
            d = json.loads(f.read_text())
        except Exception:
            continue
        # only real terminal sessions; `claude -p` runs report entrypoint "sdk-cli"
        if d.get("kind") != "interactive" or d.get("entrypoint") != "cli":
            continue
        pid, sid = d.get("pid"), d.get("sessionId")
        if not pid or not sid or not pid_alive(int(pid)):
            continue
        live[sid] = d
    return live


def watcher():
    while not STOP.is_set():
        try:
            watch_once()
        except Exception as e:
            log.exception("watcher error: %r", e)
        STOP.wait(TICK)


def watch_once():
    live = scan_live_sessions()
    with LOCK:
        # drop conversations whose claude process is gone
        for sid in list(CONVS):
            if sid not in live:
                log.info("conversation ended: %s", sid)
                del CONVS[sid]
        for sid, d in live.items():
            conv = CONVS.get(sid)
            if conv is None:
                conv = Conversation(sid, d.get("cwd"), int(d["pid"]))
                conv.load()
                CONVS[sid] = conv
                log.info("conversation seen: %s pid=%s cwd=%s", sid, conv.pid, conv.cwd)
            elif conv.pid != int(d["pid"]):
                conv.pid = int(d["pid"])
                conv.tty = None
            new_status = d.get("status") or "idle"
            if new_status != conv.status:
                conv.status = new_status
                touch()
            conv.last_seen = time.time()
            if conv.tty is None:
                conv.tty = tty_for_pid(conv.pid)
                if conv.tty and conv.plain_title:
                    maybe_name_tab(conv)   # resumed conversation: name the tab right away
            grew = conv.read_new()
            if not conv.loaded:
                conv.loaded = True
                conv.sync_processed_index()
                bump(conv)
            if (conv.refresh or conv.ready_pending()) and time.time() >= conv.retry_after and sid not in QUEUE:
                QUEUE.append(sid)
                QUEUE_CV.notify()


# --------------------------------------------------------------------------
# Topic classification (Haiku via `claude -p`)
# --------------------------------------------------------------------------

SYSTEM = ("You maintain the topic list of a sidebar that summarizes a conversation "
          "between a user and Claude Code. Reply with one JSON object only: no prose, "
          "no code fences.")

STYLE_VERSION = 6   # bump when STYLE changes; old topic files get rebuilt once

STYLE = (
    "Write for someone glancing at a sidebar who knows nothing about this project. "
    "Simplest possible words. No jargon, no internal names, no acronyms unless spelled out. "
    "If a technical term is unavoidable, add a 2-3 word plain-language gloss after it. "
    "Labels: 4-8 plain words saying what the topic is about, sentence case, no trailing period. "
    "Good: \"Sidebar that lists what each chat is about\". "
    "Bad: \"Docked iTerm2 Toolbelt sidebar with custom webview\". "
    "Summaries: 1-2 short sentences, past tense, one idea per sentence: what the user wanted, "
    "then what happened. Cut filler words. "
    "A topic is one deliverable, one decision or one problem. Start a new topic when the user "
    "asks for a different deliverable, a different decision or a different problem, even inside "
    "the same project or about the same tool. Follow-ups, approvals, corrections and small "
    "tweaks to the same deliverable stay in its topic, and several questions about how one "
    "feature works are one topic. Example: rewriting a post, then asking how to structure the "
    "community, then setting a rule for removing spammers is three topics; rewriting the same "
    "post five times is one. Each summary covers only its own topic: never stretch a summary "
    "to take in a different subject."
)

TITLE_RULE = ("Also set \"title\": 3-6 plain words naming what this whole conversation is "
              "about, no jargon, sentence case. Keep the current title unless the conversation "
              "has clearly moved on to something else.")


NEEDS_RULE = ("\"needs_topic_1\" answers one question about topic 1 only: does this topic need "
              "topic 1's work, files or decisions? true if it builds on, fixes, ships or depends "
              "on topic 1. false if it would make sense as the first message of a brand-new "
              "conversation. A topic that only builds on some LATER topic, not on topic 1, is false.")


def fresh_rule(conv):
    """Asked once per new topic: could it have been its own conversation?"""
    if not conv.topics:
        return ""
    return (f" When you start a new topic, also set {NEEDS_RULE} "
            f"Topic 1 is \"{conv.topics[0]['label']}\".")


def track_drift(conv, idx):
    """Count exchanges in a row spent in topics that could be their own conversation."""
    conv.drift_streak = conv.drift_streak + 1 if conv.topics[idx].get("fresh") else 0


def call_claude(prompt):
    cmd = [CLAUDE_BIN, "-p", "--model", MODEL, "--no-session-persistence",
           "--setting-sources", "", "--strict-mcp-config", "--tools", "",
           "--output-format", "json", "--system-prompt", SYSTEM, prompt]
    env = {k: v for k, v in os.environ.items()
           if k not in ("CLAUDECODE", "ITERM_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT")}
    env["PATH"] = PATH_AUG + ":" + env.get("PATH", "")
    env["MAX_THINKING_TOKENS"] = "0"   # classification needs no thinking; cuts ~90% of output tokens
    r = subprocess.run(cmd, cwd="/", env=env, stdin=subprocess.DEVNULL,
                       capture_output=True, text=True, timeout=150)
    if r.returncode != 0 and not r.stdout.strip():
        raise RuntimeError(f"claude exit {r.returncode}: {r.stderr.strip()[:300]}")
    outer = json.loads(r.stdout)
    if outer.get("is_error"):
        raise RuntimeError(f"claude error: {str(outer.get('result'))[:300]}")
    return parse_object(outer.get("result", ""))


def parse_object(text):
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.S)
    i, j = text.find("{"), text.rfind("}")
    if i < 0 or j < 0:
        raise ValueError(f"no JSON object in: {text[:200]!r}")
    return json.loads(text[i:j + 1])


def clean_label(s):
    s = re.sub(r"\s+", " ", str(s or "")).strip().strip('"\'.')
    return s[:90] if s else ""


def clean_summary(s):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s[:400] if s else ""


def clean_question(s):
    if not isinstance(s, str):
        return None
    s = re.sub(r"\s+", " ", s).strip().strip('"')
    if not s or s.lower() in ("null", "none", "n/a", "no"):
        return None
    return s[:220]


QUESTION_RULE = ("Also set \"question\": if Claude's reply ends by asking the user something it "
                 "needs answered before continuing, give that question in one short plain "
                 "sentence addressed to the user, simplest words possible; otherwise null.")


def fmt_topics(topics):
    if not topics:
        return "None yet."
    lines = []
    for i, t in enumerate(topics):
        line = f"{i + 1}. {t['label']}"
        if t.get("summary"):
            line += f" — {t['summary']}"
        lines.append(line)
    return "\n".join(lines)


def recent_context(conv, x):
    """The user messages just before x, so the model sees the arc and not one line."""
    i = next((k for k, e in enumerate(conv.exchanges) if e is x), None)
    prev = conv.exchanges[max(0, i - CONTEXT_MSGS):i] if i else []
    if not prev:
        return ""
    return ("Earlier user messages (oldest first):\n"
            + "\n".join(f"- \"{p['text'][:200]}\"" for p in prev) + "\n")


def classify_one(conv, x):
    prompt = (
        f"Existing topics (chronological):\n{fmt_topics(conv.topics)}\n"
        f"Current topic: {conv.current + 1 if conv.current is not None else 'none'}\n\n"
        + recent_context(conv, x) +
        f"Newest user message:\n\"\"\"{x['text'][:MSG_CHARS]}\"\"\"\n"
        f"Claude's reply (excerpt):\n\"\"\"{x['reply'][:REPLY_CHARS]}\"\"\"\n\n"
        "Decide where the newest exchange belongs and describe it. Write \"reason\" first: one "
        "short line saying what the newest message asks for and whether that is the same "
        "deliverable, decision or problem as the current topic.\n"
        "- Continues or returns to an existing topic: {\"reason\": \"...\", \"topic\": <number>, "
        "\"summary\": \"<updated 1-2 sentence summary of that topic, adding what this exchange "
        "added>\", \"question\": <string or null>}\n"
        "- A different deliverable, decision or problem: {\"reason\": \"...\", \"new\": "
        "\"<label>\", \"needs_topic_1\": true|false, \"summary\": \"<1-2 sentences>\", "
        "\"question\": <string or null>, \"title\": \"...\"}\n"
        + STYLE + " " + QUESTION_RULE + fresh_rule(conv) + " " + TITLE_RULE
        + f"\nCurrent title: {conv.plain_title or 'none yet'}"
    )
    had_topics = bool(conv.topics)
    res = call_claude(prompt)
    ts = x.get("ts")
    conv.question = clean_question(res.get("question"))
    conv.plain_title = clean_label(res.get("title")) or conv.plain_title
    summary = clean_summary(res.get("summary"))
    if isinstance(res.get("topic"), int) and 1 <= res["topic"] <= len(conv.topics):
        idx = res["topic"] - 1
    elif clean_label(res.get("new")):
        conv.topics.append({"label": clean_label(res["new"]), "summary": summary,
                            "fresh": had_topics and res.get("needs_topic_1") is False,
                            "first_ts": ts, "last_ts": ts})
        idx = len(conv.topics) - 1
    elif conv.topics and isinstance(res.get("topic"), int):
        idx = min(max(res["topic"] - 1, 0), len(conv.topics) - 1)
    else:
        raise ValueError(f"unusable classification: {res!r}")
    conv.current = idx
    track_drift(conv, idx)
    conv.topics[idx]["last_ts"] = ts
    if summary:
        conv.topics[idx]["summary"] = summary


def classify_batch(conv, pend, rebuild=False):
    msgs = []
    for i, x in enumerate(pend):
        line = f"[{i + 1}] \"{x['text'][:MSG_CHARS]}\""
        if x["reply"]:
            line += f"  (reply: \"{x['reply'][:180]}\")"
        msgs.append(line)
    existing = [] if rebuild else conv.topics
    prompt = (
        f"Existing topics (keep these exactly, in this order):\n{fmt_topics(existing)}\n\n"
        f"User messages in order, with reply excerpts:\n" + "\n".join(msgs) + "\n\n"
        "Build the sidebar's topic list. Usually one topic per 4-8 messages, at most 8 topics. Keep existing topics first and in "
        "order, but you may refresh their summaries; append new topics in the order they "
        "first appear. " + STYLE + "\n"
        "Reply {\"topics\": [{\"label\": \"...\", \"summary\": \"...\", \"needs_topic_1\": true|false}, "
        "...], \"assignments\": [n, ...], \"question\": <string or null>, \"title\": \"...\"} "
        "where assignments gives one topic number (1-based, into the final list) per message, "
        "in order. " + QUESTION_RULE + " Judge \"question\" from the reply to the last message "
        "only. For every topic after the first, " + NEEDS_RULE + " " + TITLE_RULE
        + f"\nCurrent title: {conv.plain_title or 'none yet'}"
    )
    res = call_claude(prompt)
    conv.question = clean_question(res.get("question"))
    conv.plain_title = clean_label(res.get("title")) or conv.plain_title
    parsed = []
    for t in res.get("topics", []):
        if isinstance(t, dict):
            lab, summ = clean_label(t.get("label")), clean_summary(t.get("summary"))
            fresh = t.get("needs_topic_1") is False
        else:
            lab, summ, fresh = clean_label(t), "", False
        if lab:
            parsed.append((lab, summ, fresh))
    if len(parsed) < len(existing):
        raise ValueError("batch dropped existing topics")
    new_topics = []
    for i, t in enumerate(existing):
        keep = dict(t)
        if parsed[i][1]:
            keep["summary"] = parsed[i][1]
        new_topics.append(keep)
    for lab, summ, fresh in parsed[len(existing):]:
        if lab.lower() not in {t["label"].lower() for t in new_topics}:
            new_topics.append({"label": lab, "summary": summ, "fresh": bool(new_topics) and fresh,
                               "first_ts": None, "last_ts": None})
    assigns = res.get("assignments")
    if not isinstance(assigns, list) or not assigns:
        raise ValueError("batch without assignments")
    conv.topics = new_topics
    last_idx = None
    if rebuild:
        conv.drift_streak = 0
    for x, a in zip(pend, assigns):
        if isinstance(a, int) and 1 <= a <= len(conv.topics):
            t = conv.topics[a - 1]
            t["first_ts"] = t["first_ts"] or x.get("ts")
            t["last_ts"] = x.get("ts")
            last_idx = a - 1
            track_drift(conv, last_idx)
    if last_idx is None:
        last_idx = len(conv.topics) - 1
    conv.current = last_idx


def classifier():
    while not STOP.is_set():
        with QUEUE_CV:
            while not QUEUE and not STOP.is_set():
                QUEUE_CV.wait(2)
            if STOP.is_set():
                return
            sid = QUEUE.pop(0)
            conv = CONVS.get(sid)
            if conv is None:
                continue
            rebuild = conv.refresh
            if rebuild:
                pend = conv.exchanges[-MAX_BATCH:]
                start = len(conv.exchanges) - len(pend)
            else:
                pend = conv.ready_pending()
                if len(pend) > MAX_BATCH:
                    conv.processed_index += len(pend) - MAX_BATCH
                    pend = pend[-MAX_BATCH:]
                start = conv.processed_index
            snapshot = list(pend)
        if not snapshot:
            with LOCK:
                conv.refresh = False
            continue
        try:
            t0 = time.time()
            if rebuild or len(snapshot) >= BATCH_THRESHOLD or (not conv.topics and len(snapshot) > 1):
                classify_batch(conv, snapshot, rebuild=rebuild)
                done = len(snapshot)
            else:
                classify_one(conv, snapshot[0])
                done = 1
            with LOCK:
                conv.processed_index = start + done
                conv.processed_uuid = snapshot[done - 1]["uuid"]
                conv.retries = 0
                conv.refresh = False
                bump(conv)
                conv.save()
            log.info("%s: %s%d exchange(s) -> %d topics, current=%s, drift=%d (%.1fs)",
                     sid[:8], "rebuild " if rebuild else "", done, len(conv.topics),
                     conv.current, conv.drift_streak, time.time() - t0)
            maybe_name_tab(conv)
        except Exception as e:
            with LOCK:
                conv.retries += 1
                conv.retry_after = time.time() + min(60, 5 * conv.retries)
                if conv.retries >= 3:
                    log.error("%s: giving up on %d exchange(s): %r", sid[:8], len(snapshot), e)
                    conv.processed_index = start + len(snapshot)
                    conv.processed_uuid = snapshot[-1]["uuid"]
                    conv.retries = 0
                    conv.refresh = False
                    conv.save()
                else:
                    log.warning("%s: classification failed (try %d): %r", sid[:8], conv.retries, e)


# --------------------------------------------------------------------------
# Tab naming: only when the claude process runs with
# CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1, otherwise Claude Code keeps rewriting
# the tab title and the two would fight.
# --------------------------------------------------------------------------

ITERM_LOOP = {"loop": None, "app": None, "connection": None, "dead": None}


def claude_title_disabled(pid):
    try:
        out = subprocess.run(["ps", "-p", str(pid), "-wwE", "-o", "command="],
                             capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return False
    return "CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1" in out


def maybe_name_tab(conv):
    if conv.tab_naming is None:
        conv.tab_naming = claude_title_disabled(conv.pid)
    if not conv.tab_naming or not conv.plain_title or conv.plain_title == conv.tab_named:
        return
    loop = ITERM_LOOP["loop"]
    if loop is None:
        return
    title, tty = conv.plain_title, conv.tty

    async def do_name():
        app = ITERM_LOOP["app"]
        if app is None or not tty:
            return
        try:
            await refresh_app(app)
            for win in app.terminal_windows:
                for tab in win.tabs:
                    for sess in tab.sessions:
                        stty = ITERM_TTY.get(sess.session_id)
                        if stty is None:
                            stty = await sess.async_get_variable("tty")
                            with LOCK:
                                ITERM_TTY[sess.session_id] = stty
                        if stty == tty:
                            await sess.async_set_name(title)
                            conv.tab_named = title
                            log.info("tab named %r for %s", title, conv.session_id[:8])
                            return
        except Exception as e:
            iterm_call_failed("tab naming", e)

    try:
        loop.call_soon_threadsafe(lambda: asyncio.ensure_future(do_name()))
    except RuntimeError as e:      # loop already closed, between two connections
        log.debug("tab naming skipped: %r", e)


# --------------------------------------------------------------------------
# HTTP server (localhost only)
# --------------------------------------------------------------------------

class QuietServer(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        pass   # a client hanging up mid-response is not worth a traceback


class Handler(BaseHTTPRequestHandler):
    server_version = "SessionTopics/1"

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            body = (STATIC / "index.html").read_bytes()
            return self._send(200, body, "text/html; charset=utf-8")
        if path == "/favicon.ico":
            return self._send(204, b"", "image/x-icon")
        if path == "/api/state":
            qs = self.path.split("?", 1)[1] if "?" in self.path else ""
            wait = None
            for part in qs.split("&"):
                if part.startswith("wait="):
                    try:
                        wait = int(part[5:])
                    except ValueError:
                        wait = None
            if wait is not None:
                with STATE_CV:
                    STATE_CV.wait_for(lambda: STATE["seq"] != wait, timeout=20)
            return self._send(200, json.dumps(state_json()).encode(), "application/json")
        if path == "/api/debug":
            return self._send(200, json.dumps(debug_json(), indent=1).encode(), "application/json")
        self._send(404, b"not found", "text/plain")

    def do_POST(self):
        path, _, qs = self.path.partition("?")
        sid = (urllib.parse.parse_qs(qs).get("session") or [""])[0]
        if path not in ("/api/copy", "/api/dismiss"):
            return self._send(404, b"not found", "text/plain")
        with LOCK:
            conv = CONVS.get(sid)
            nudge = conv.nudge_public() if conv else None
            if nudge is None:
                return self._send(404, b"no nudge", "text/plain")
            if path == "/api/dismiss":
                conv.nudge_dismissed.append(nudge["to"])
                conv.save()
                bump(conv)
                return self._send(204, b"", "text/plain")
        install = (urllib.parse.parse_qs(qs).get("install") or [""])[0] == "1"
        text = FRESH_INSTALL if install else nudge["command"]
        try:
            subprocess.run(["pbcopy"], input=text, text=True, timeout=5, check=True)
        except Exception as e:
            log.warning("copy failed: %r", e)
            return self._send(500, b"copy failed", "text/plain")
        return self._send(204, b"", "text/plain")


def serve_http():
    try:
        httpd = QuietServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        log.error("cannot bind 127.0.0.1:%d (%s); exiting so launchd can retry", PORT, e)
        os._exit(1)
    log.info("http on 127.0.0.1:%d", PORT)
    while not STOP.is_set():
        httpd.serve_forever(poll_interval=0.5)
    httpd.server_close()


# --------------------------------------------------------------------------
# iTerm2 side: tool registration + active-session tracking
# --------------------------------------------------------------------------

def color_hex(c):
    try:
        return "#%02x%02x%02x" % (int(c.red), int(c.green), int(c.blue))
    except Exception:
        return None


async def read_theme(app, sess):
    """Colors and font of the session's profile, so the sidebar can match it."""
    prof = await sess.async_get_profile()
    dark = True
    try:
        t = await app.async_get_theme()
        dark = "dark" in " ".join(t).lower() if isinstance(t, (list, tuple)) else "dark" in str(t).lower()
    except Exception:
        pass
    separate = bool(getattr(prof, "use_separate_colors_for_light_and_dark_mode", False))

    def pick(name):
        # with separate light/dark sets the base property is unused, so read the
        # variant that matches iTerm2's current theme
        if separate:
            v = getattr(prof, name + ("_dark" if dark else "_light"), None)
            if v is not None:
                return v
        return getattr(prof, name, None)

    font = (getattr(prof, "normal_font", "") or "").strip()
    ps_name, size = font, 13.0
    if " " in font:
        head, tail = font.rsplit(" ", 1)
        try:
            size = float(tail)
            ps_name = head
        except ValueError:
            pass
    family = re.sub(r"-(Regular|Medium|Bold|Light|Book|Roman|Italic|Text)$", "", ps_name)
    family = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", family).replace("-", " ").strip()
    return {
        "dark": dark,
        "bg": color_hex(pick("background_color")),
        "fg": color_hex(pick("foreground_color")),
        "bold": color_hex(pick("bold_color")),
        "ansi": [color_hex(pick(f"ansi_{i}_color")) for i in range(16)],
        "font_ps": ps_name,
        "font_family": family,
        "font_size": size,
    }


THEME_AT = {}   # iTerm2 session id -> when its theme was last read
THEME_TTL = 120  # seconds before a cached theme is re-read (catches profile edits)
HEARTBEAT_TIMEOUT = 10  # a probe slower than this means the socket is wedged


def iterm_call_failed(where, err):
    """Log a failed iTerm2 call, and drop the connection when the socket is gone.

    Every RPC here used to swallow its own exception, so a closed socket could
    go unnoticed indefinitely: on 2026-09-19 tab naming logged ConnectionClosed
    four times while the sidebar sat frozen on a 21-hour-old connection.
    """
    log.warning("%s failed: %r", where, err)
    if not isinstance(err, (asyncio.TimeoutError, OSError, EOFError, WSClosed)):
        return
    dead = ITERM_LOOP.get("dead")
    if dead is not None and not dead.is_set():
        log.warning("%s: iTerm2 socket is gone; dropping connection to reconnect",
                    where)
        dead.set()


async def refresh_app(app):
    """app.async_refresh() with a deadline.

    App._refreshing is a plain bool held for the length of the call. A refresh
    left mid-flight by a dying socket never clears it, and from then on every
    refresh returns None instantly without touching the network -- which is how
    the old heartbeat kept passing on a connection that was already dead.
    """
    await asyncio.wait_for(app.async_refresh(), HEARTBEAT_TIMEOUT)


async def active_session(connection):
    """(iTerm2 session id, tty) of the focused session, or (None, None).

    Asked of iTerm2 directly through its "active" session proxy, never read from
    the App model. The model lags on a new tab: iTerm2 sends the focus event for
    a session the model has not loaded yet, App.async_refresh() is already
    running for the new-session notice and returns at once (its _refreshing
    flag), and the model's current tab is still the old one. So a new tab
    showed the topics of the tab it was opened from (2026-09-22).
    """
    out = []
    for name in ("id", "tty"):
        resp = await asyncio.wait_for(
            iterm2.rpc.async_variable(connection, "active", [], [name]), HEARTBEAT_TIMEOUT)
        vr = resp.variable_response
        if vr.status != iterm2.api_pb2.VariableResponse.Status.Value("OK"):
            return None, None
        out.append(json.loads(vr.values[0]) or None)
    return out[0], out[1]


async def refresh_active(app):
    """Point the sidebar at the focused session. Raises when the socket is dead."""
    sid, tty = await active_session(app.connection)
    if sid is None:
        with LOCK:
            changed = ACTIVE["iterm"] is not None
            ACTIVE["iterm"] = None
        if changed:
            touch()
        return
    with LOCK:
        theme = THEME.get(sid)
        stale = time.time() - THEME_AT.get(sid, 0) > THEME_TTL
    if theme is None or stale:
        sess = app.get_session_by_id(sid)   # lags for a brand-new tab; the next tick retries
        if sess is not None:
            THEME_AT[sid] = time.time()
            try:
                theme = await read_theme(app, sess)
            except Exception as e:
                log.warning("theme read failed: %r", e)
    with LOCK:
        if tty:
            ITERM_TTY[sid] = tty
        changed = ACTIVE["iterm"] != sid or bool(theme and THEME.get(sid) != theme)
        if theme:
            THEME[sid] = theme
        ACTIVE["iterm"] = sid
    if changed:
        touch()


async def reveal_toolbelt_once(connection):
    flag = FLAGS / ".toolbelt-revealed"
    if flag.exists():
        return
    try:
        st = await iterm2.MainMenu.async_get_menu_item_state(connection, "Show Toolbelt")
        if not st.checked:
            await iterm2.MainMenu.async_select_menu_item(connection, "Show Toolbelt")
            log.info("toolbelt shown (first run)")
        flag.write_text(str(time.time()))
    except Exception as e:
        log.info("toolbelt not revealed yet (%r); will retry on focus change", e)


async def focus_loop(connection, app):
    async with iterm2.FocusMonitor(connection) as mon:
        while not STOP.is_set():
            await mon.async_get_next_update()
            try:
                await refresh_active(app)
            except Exception as e:
                iterm_call_failed("refresh_active", e)
            if not (FLAGS / ".toolbelt-revealed").exists():
                await reveal_toolbelt_once(connection)


async def reconcile(app):
    """Re-read the focused session every RECONCILE_EVERY seconds.

    Catches any focus change the event stream missed, and doubles as the
    liveness probe: FocusMonitor can wait forever on a socket that closed
    without raising (2026-09-19, sidebar frozen for 21 hours). The probe is a
    variable read, which always round-trips; App.async_refresh() does not (a
    latched _refreshing flag makes it return without touching the network).
    A read that raises or times out ends iterm_main, and iterm_loop reconnects.
    """
    while not STOP.is_set():
        await asyncio.sleep(RECONCILE_EVERY)
        await refresh_active(app)


async def dead_watch(dead):
    """Ends iterm_main once any other call has proven the socket closed."""
    await dead.wait()
    raise ConnectionError("an iTerm2 call reported the socket closed")


async def iterm_main(connection):
    app = await iterm2.async_get_app(connection)
    dead = asyncio.Event()
    ITERM_LOOP.update(loop=asyncio.get_running_loop(), app=app,
                      connection=connection, dead=dead)
    await iterm2.tool.async_register_web_view_tool(
        connection, TOOL_NAME, TOOL_ID, False, f"http://127.0.0.1:{PORT}/")
    log.info("registered toolbelt tool %s", TOOL_ID)
    await reveal_toolbelt_once(connection)
    await refresh_active(app)
    tasks = [asyncio.create_task(focus_loop(connection, app), name="focus"),
             asyncio.create_task(reconcile(app), name="reconcile"),
             asyncio.create_task(dead_watch(dead), name="deadwatch")]
    try:
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    for task in done:
        err = task.exception()
        if err is not None:
            log.warning("%s task failed: %r; dropping connection to reconnect",
                        task.get_name(), err)
            raise err


def iterm_loop():
    while not STOP.is_set():
        try:
            iterm2.run_until_complete(iterm_main, retry=True)
        except (Exception, SystemExit) as e:
            log.warning("iTerm2 connection ended: %r", e)
        if STOP.is_set():
            break
        time.sleep(10)   # slow retry: avoids re-prompting for Automation permission


# --------------------------------------------------------------------------

def main():
    log.info("starting; claude=%s model=%s port=%d", CLAUDE_BIN, MODEL, PORT)

    def stop(*_):
        STOP.set()
        with QUEUE_CV:
            QUEUE_CV.notify_all()
        os._exit(0)

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    for target in (serve_http, watcher, classifier):
        threading.Thread(target=target, name=target.__name__, daemon=True).start()
    iterm_loop()


if __name__ == "__main__":
    main()

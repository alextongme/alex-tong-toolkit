#!/usr/bin/env node
// scan-safety.js — enforce the CLAUDE.md hard rules against files in the repo.
//
// Usage:
//   node scripts/scan-safety.js              # scan every non-gitignored file (CI mode)
//   node scripts/scan-safety.js <file>...    # scan only the given files (pre-commit hook mode)
//   node scripts/scan-safety.js --pre-push <remote>   # scan outgoing commits (pre-push hook mode)
//
// Exit codes:
//   0 — no hard-block matches (warnings do not fail)
//   1 — one or more hard-block matches; commit / build refused

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Rule set
// ---------------------------------------------------------------------------

// Filename patterns that should never appear in a commit at all — even empty.
const BANNED_FILENAMES = [
  /^\.env(\..+)?$/, // .env, .env.local, .env.production, …
  /\.pem$/,
  /\.key$/,
  /^id_rsa(\.pub)?$/,
  /^id_dsa(\.pub)?$/,
  /^id_ecdsa(\.pub)?$/,
  /^id_ed25519(\.pub)?$/,
  /^credentials\.json$/,
  /^service-account.*\.json$/,
  /^aws-credentials.*$/,
  /^google-credentials.*$/,
];

// Hard-block content patterns. A match in any scanned file fails the build.
// Each entry: {id, description, regex, allowInFiles?} — allowInFiles is an
// optional list of files where the pattern is expected (e.g. this scanner
// itself, which defines the patterns as regexes, must be exempt from its own
// literal-string matches).
// ############################################################################
// DO NOT ADD ORGANISATION- OR PERSON-SPECIFIC PATTERNS TO THIS FILE.
//
// This file is committed. A blocklist of confidential identifiers, published
// in order to block them, discloses exactly what it was written to protect —
// the blocklist becomes the leak. This is not hypothetical: an earlier
// revision of this scanner did exactly that.
//
// Identifying patterns — organisation names, internal tool and repo names,
// personal emails, hostnames, private domains — belong in
// `.safety-scan-local.txt`, which is gitignored and never leaves the machine.
// loadLocalPatterns() reads it and applies those patterns on top of the
// generic ones below, so enforcement is identical without the disclosure.
//
// Everything below must stay generic: credential *formats*, not identities.
// ############################################################################

const HARD_BLOCK = [
  // ----- Credentials / secrets -----
  {
    id: "SEC-ANTHROPIC",
    description: "Anthropic API key",
    regex: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/g,
  },
  {
    id: "SEC-OPENAI",
    description: "OpenAI-style API key",
    // sk- followed by 30+ non-hyphen chars. Excludes sk-ant- (checked above).
    regex: /\bsk-(?!ant-)[A-Za-z0-9]{30,}\b/g,
  },
  {
    id: "SEC-OPENAI-PROJ",
    description: "OpenAI project, service-account or admin key",
    // The newer formats carry a hyphenated prefix and underscores, which the
    // rule above cannot match.
    regex: /\bsk-(proj|svcacct|admin)-[A-Za-z0-9_\-]{40,}/g,
  },
  {
    id: "SEC-GH-TOKEN",
    description: "GitHub Personal Access Token",
    regex: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
  },
  {
    id: "SEC-AWS-ACCESS",
    description: "AWS access key ID",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: "SEC-AWS-SECRET",
    description: "AWS secret access key context",
    // Matches an aws_secret_access_key assignment with a real-looking value.
    regex: /aws_secret_access_key\s*[=:]\s*['"][A-Za-z0-9\/+=]{30,}['"]/gi,
  },
  {
    id: "SEC-GOOGLE",
    description: "Google API key",
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
  },
  {
    id: "SEC-SLACK",
    description: "Slack token",
    regex: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/g,
  },
  {
    id: "SEC-PRIVKEY",
    description: "Private key block",
    regex: /-----BEGIN (RSA |DSA |EC |OPENSSH |ENCRYPTED |)PRIVATE KEY-----/g,
  },

  // ----- Personal machine paths -----
  {
    id: "PATH-USER",
    description:
      "Hard-coded home directory path — use $HOME or ~ instead, never a literal username",
    // Deliberately generic: matches any /Users/<name> or /home/<name>, not a
    // specific username. Catches more, discloses nothing.
    regex: /\/(Users|home)\/(?!YOUR-|<)[a-z][a-z0-9._-]{2,}/gi,
    allowInFiles: ["scripts/scan-safety.js", "CLAUDE.md"],
  },
];

// Warning patterns — surface for human review but do NOT fail the build.
// Same rule as HARD_BLOCK: generic patterns only. Anything that names a
// specific organisation or person goes in `.safety-scan-local.txt`.
const WARN = [
  {
    id: "WARN-CONFIDENTIAL",
    description: "The words 'confidential', 'internal only', or 'do not share'",
    regex: /\b(confidential|internal only|do not share)\b/gi,
    allowInFiles: ["scripts/scan-safety.js", "CLAUDE.md"],
  },
];

// ---------------------------------------------------------------------------
// Local-only extra patterns (optional, gitignored)
// ---------------------------------------------------------------------------

function localPatternPath() {
  const name = ".safety-scan-local.txt";
  if (fs.existsSync(name)) return name;
  // The file is gitignored, so it does not exist inside a git worktree, and every
  // session here works in one. Without this fallback the scan silently ran with
  // no local patterns in any worktree (found 2026-09-24). Read the main
  // checkout's copy instead.
  try {
    const common = require("child_process")
      .execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" })
      .trim();
    const main = path.join(path.dirname(common), name);
    if (fs.existsSync(main)) return main;
  } catch {}
  console.warn(`warn   no ${name} found here or in the main checkout: client and personal patterns are NOT being checked`);
  return null;
}

function loadLocalPatterns() {
  const localPath = localPatternPath();
  if (!localPath) return [];
  const lines = fs
    .readFileSync(localPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  return lines.map((literal, idx) => ({
    id: `LOCAL-${idx + 1}`,
    description: `Local-only banned pattern from .safety-scan-local.txt`,
    regex: new RegExp(wordBounded(escapeRegExp(literal)), "gi"),
    // The local pattern file lists these literals by definition, so it can
    // never be scanned against itself.
    allowInFiles: ["scripts/scan-safety.js", ".safety-scan-local.txt"],
  }));
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Anchor a literal to word boundaries when its edges are word characters.
// Without this a short pattern is matched as a substring — e.g. a three-letter
// acronym fires on every occurrence of "anything" — which buries real hits
// under hundreds of false positives and trains people to ignore the scanner.
// Patterns whose edges are non-word characters (paths, emails, domains) get no
// boundary, since \b would not behave sensibly there.
function wordBounded(escaped) {
  const startsWord = /^\\?\w/.test(escaped);
  const endsWord = /\w$/.test(escaped);
  return `${startsWord ? "\\b" : ""}${escaped}${endsWord ? "\\b" : ""}`;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".vercel"]);

// Full-repo mode scans exactly what git tracks. Walking the filesystem instead
// would scan gitignored files — local scratch dirs, worktrees, and the local
// pattern file itself — none of which can ever be committed, so a match there
// is noise. It also matches what the rules actually protect: the committed
// tree. Falls back to a filesystem walk outside a git checkout.
function trackedFiles() {
  try {
    return require("child_process")
      .execFileSync("git", ["ls-files", "-z"], { maxBuffer: 64 * 1024 * 1024 })
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
  } catch (err) {
    console.warn("warn: not a git checkout — falling back to filesystem walk");
    return walk(".");
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Binary-ish file guard so we don't spam warnings on images / bundled assets.
function looksBinary(buf) {
  const len = Math.min(buf.length, 512);
  for (let i = 0; i < len; i++) if (buf[i] === 0) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

function scanFile(file, hardRules, warnRules) {
  const named = bannedName(file);
  if (named) return named;

  let content;
  try {
    const buf = fs.readFileSync(file);
    if (looksBinary(buf)) return { violations: [], warnings: [] };
    content = buf.toString("utf8");
  } catch (err) {
    // Unreadable — skip silently.
    return { violations: [], warnings: [] };
  }

  const relPath = path.relative(".", file).split(path.sep).join("/");
  return scanContent(content, relPath, hardRules, warnRules);
}

function bannedName(file) {
  const basename = path.basename(file);
  if (!BANNED_FILENAMES.some((pattern) => pattern.test(basename))) return null;
  return {
    violations: [
      {
        rule: "FILE-NAME",
        description: `Filename '${basename}' is banned — never commit files matching credential name patterns`,
        line: 0,
        excerpt: `(filename '${basename}')`,
      },
    ],
    warnings: [],
  };
}

// relPath is the repo-relative path the text came from, or null for text that
// is not a file (a commit message, a branch name).
function scanContent(content, relPath, hardRules, warnRules) {
  const violations = [];
  const warnings = [];

  for (const rule of hardRules) {
    if (rule.allowInFiles && rule.allowInFiles.includes(relPath)) continue;
    const matches = [...content.matchAll(rule.regex)];
    for (const m of matches) {
      const line = content.slice(0, m.index).split("\n").length;
      violations.push({
        rule: rule.id,
        description: rule.description,
        line,
        excerpt: excerpt(content, m.index, m[0].length),
      });
    }
  }

  for (const rule of warnRules) {
    if (rule.allowInFiles && rule.allowInFiles.includes(relPath)) continue;
    const matches = [...content.matchAll(rule.regex)];
    for (const m of matches) {
      const line = content.slice(0, m.index).split("\n").length;
      warnings.push({
        rule: rule.id,
        description: rule.description,
        line,
        excerpt: excerpt(content, m.index, m[0].length),
      });
    }
  }

  return { violations, warnings };
}

// The match itself is never printed. A blocked key or client name echoed to a
// terminal lands in scrollback, CI logs and screen recordings, which is the
// leak the scan exists to prevent. The context around it is enough to find it.
function excerpt(content, index, len) {
  const start = Math.max(0, index - 20);
  const end = Math.min(content.length, index + len + 20);
  const slice =
    content.slice(start, index) + `[${len} chars hidden]` + content.slice(index + len, end);
  return slice.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Pre-push mode
// ---------------------------------------------------------------------------

// Git feeds one line per ref being pushed on stdin:
//   <local ref> <local sha> <remote ref> <remote sha>
// Every commit about to leave this machine is scanned: its message, each file
// it adds or changes as that file stood in the commit, and the branch name.
// This catches what the commit-time hooks cannot: commits made with
// --no-verify or git commit-tree, in a clone without the hooks enabled, or
// before a pattern was added to the local list. Commits the remote already has
// are skipped; they are public either way.
function scanOutgoing(remote, report) {
  const git = (args) =>
    require("child_process").execFileSync("git", args, { maxBuffer: 256 * 1024 * 1024 });
  const seen = new Set();

  for (const line of fs.readFileSync(0, "utf8").split("\n").filter(Boolean)) {
    const [localRef, localSha, remoteRef] = line.split(" ");
    if (/^0+$/.test(localSha)) continue; // deleting a remote ref sends no content

    for (const ref of new Set([localRef, remoteRef])) {
      const name = ref.replace(/^refs\/(heads|tags)\//, "");
      report("(branch or tag name)", scanContent(name, null, hardRules, warnRules));
    }

    const commits = git(["rev-list", localSha, "--not", `--remotes=${remote}`])
      .toString()
      .split("\n")
      .filter(Boolean);
    for (const commit of commits) {
      if (seen.has(commit)) continue;
      seen.add(commit);
      const id = commit.slice(0, 8);

      const raw = git(["cat-file", "commit", commit]).toString("utf8");
      const message = raw.slice(raw.indexOf("\n\n") + 2);
      report(`${id} (commit message)`, scanContent(message, null, hardRules, warnRules));

      // -m so a merge's own changes are seen too; blobs already scanned are skipped.
      const diff = git(["diff-tree", "-r", "-m", "-z", "--root", "--no-commit-id", "--diff-filter=AMT", commit])
        .toString("utf8")
        .split("\0");
      for (let i = 0; i + 1 < diff.length; i += 2) {
        const [, mode, , blob] = diff[i].split(" ");
        const file = diff[i + 1];
        if (mode === "160000" || seen.has(blob + file)) continue; // submodule, or done
        seen.add(blob + file);

        const named = bannedName(file);
        if (named) {
          report(`${id} ${file}`, named);
          continue;
        }
        const buf = git(["cat-file", "blob", blob]);
        if (looksBinary(buf)) continue;
        report(`${id} ${file}`, scanContent(buf.toString("utf8"), file, hardRules, warnRules));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const localPatterns = loadLocalPatterns();
const hardRules = [...HARD_BLOCK, ...localPatterns];
const warnRules = WARN;

let hardCount = 0;
let warnCount = 0;
let scanned = 0;

function report(where, { violations, warnings }) {
  scanned++;
  for (const v of violations) {
    console.error(
      `BLOCK  ${where}:${v.line}  [${v.rule}] ${v.description}\n       ${v.excerpt}`,
    );
    hardCount++;
  }
  for (const w of warnings) {
    console.warn(
      `warn   ${where}:${w.line}  [${w.rule}] ${w.description}\n       ${w.excerpt}`,
    );
    warnCount++;
  }
}

if (args[0] === "--pre-push") {
  scanOutgoing(args[1] || "origin", report);
} else {
  for (const file of args.length ? args : trackedFiles()) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    report(file, scanFile(file, hardRules, warnRules));
  }
}

if (hardCount > 0) {
  console.error(
    `\nFAIL: ${hardCount} hard-block violation(s), ${warnCount} warning(s). See CLAUDE.md for the rule set.`,
  );
  process.exit(1);
} else if (warnCount > 0) {
  console.warn(
    `\nOK with warnings: 0 hard-block violations, ${warnCount} warning(s). Review the warnings above — they do not fail the build but usually shouldn't ship.`,
  );
  process.exit(0);
} else {
  console.log(`OK: ${scanned} item(s) scanned, no matches.`);
  process.exit(0);
}

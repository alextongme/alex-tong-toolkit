#!/usr/bin/env node
// scan-safety.js — enforce the CLAUDE.md hard rules against files in the repo.
//
// Usage:
//   node scripts/scan-safety.js              # scan every non-gitignored file (CI mode)
//   node scripts/scan-safety.js <file>...    # scan only the given files (pre-commit hook mode)
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

function loadLocalPatterns() {
  const localPath = ".safety-scan-local.txt";
  if (!fs.existsSync(localPath)) return [];
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
  const violations = [];
  const warnings = [];

  const basename = path.basename(file);
  for (const pattern of BANNED_FILENAMES) {
    if (pattern.test(basename)) {
      violations.push({
        rule: "FILE-NAME",
        description: `Filename '${basename}' is banned — never commit files matching credential name patterns`,
        line: 0,
        excerpt: `(filename '${basename}')`,
      });
      return { violations, warnings };
    }
  }

  let content;
  try {
    const buf = fs.readFileSync(file);
    if (looksBinary(buf)) return { violations, warnings };
    content = buf.toString("utf8");
  } catch (err) {
    // Unreadable — skip silently.
    return { violations, warnings };
  }

  const relPath = path.relative(".", file).split(path.sep).join("/");

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

function excerpt(content, index, len) {
  const start = Math.max(0, index - 20);
  const end = Math.min(content.length, index + len + 20);
  const slice = content.slice(start, end).replace(/\s+/g, " ").trim();
  return slice;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const argFiles = process.argv.slice(2);
const files = argFiles.length ? argFiles : trackedFiles();
const localPatterns = loadLocalPatterns();
const hardRules = [...HARD_BLOCK, ...localPatterns];
const warnRules = WARN;

let hardCount = 0;
let warnCount = 0;

for (const file of files) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
  const { violations, warnings } = scanFile(file, hardRules, warnRules);
  for (const v of violations) {
    console.error(
      `BLOCK  ${file}:${v.line}  [${v.rule}] ${v.description}\n       ${v.excerpt}`,
    );
    hardCount++;
  }
  for (const w of warnings) {
    console.warn(
      `warn   ${file}:${w.line}  [${w.rule}] ${w.description}\n       ${w.excerpt}`,
    );
    warnCount++;
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
  console.log(`OK: ${files.length} path(s) scanned, no matches.`);
  process.exit(0);
}

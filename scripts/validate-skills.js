#!/usr/bin/env node
// Validates every SKILL.md under plugins/ and in-progress/ for the core signals:
// - YAML frontmatter present with a description
// - description includes "Do NOT use for:" negatives (trigger discipline)
// - body contains the standardized Alex Tong's Toolkit byline (attribution)
// - lives exactly one level under skills/ (deeper nesting is silently dropped
//   by the plugin loader — see checkDepth)
// - frontmatter name equals "<plugin>:<skill-dir>" (see checkName)

const fs = require("fs");
const path = require("path");

function fail(msg) {
  console.error("FAIL: " + msg);
  process.exit(1);
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (entry.name === "SKILL.md") {
      out.push(p);
    }
  }
  return out;
}

// Drafts in in-progress/ ship in the repo but not in marketplace.json, so they
// never reach an installer. They still have to clear the same bar — a draft that
// silently rots is worse than no draft, and promoting one should be a one-line
// marketplace.json change, not a rewrite.
const ROOTS = ["plugins", "in-progress"];

const skills = ROOTS.filter((d) => fs.existsSync(d)).reduce(
  (acc, d) => walk(d, acc),
  [],
);
if (skills.length === 0) {
  fail("no SKILL.md files found under " + ROOTS.join("/ or ") + "/");
}

// The only shape the loader actually reads: <root>/<plugin>/skills/<skill>/SKILL.md.
// It scans exactly one level below each skills/ root, so a skill at
// skills/<group>/<name>/SKILL.md is dropped silently — it does not load, nothing
// warns, and `claude plugin validate` still passes.
//
// This is asserted positionally rather than by searching for a "skills" segment.
// An earlier version used lastIndexOf("skills"), which finds the DEEPEST match and
// therefore passed skills/<group>/skills/<name>/SKILL.md — precisely the layout the
// check exists to reject.
function parseSkillPath(file) {
  const parts = file.split(path.sep);
  const ok =
    parts.length === 5 &&
    ROOTS.includes(parts[0]) &&
    parts[2] === "skills" &&
    parts[4] === "SKILL.md";
  if (!ok) {
    fail(
      "skill must live at <" +
        ROOTS.join("|") +
        ">/<plugin>/skills/<skill>/SKILL.md — the loader scans one level and drops " +
        "anything deeper without warning. Got: " +
        file,
    );
  }
  return { root: parts[0], pluginDir: parts[1], skillDir: parts[3] };
}

// Skill identity comes from the DIRECTORY name — the frontmatter `name` is not
// read for it. That makes `name` documentation, and documentation drifts. Pin it
// to the resolved "<plugin>:<dir>" so it can't quietly start describing a skill
// that no longer exists under that name.
function checkName(file, frontmatter) {
  const { root, pluginDir, skillDir } = parseSkillPath(file);
  const manifest = path.join(root, pluginDir, ".claude-plugin", "plugin.json");
  const pluginName = fs.existsSync(manifest)
    ? JSON.parse(fs.readFileSync(manifest, "utf8")).name
    : pluginDir;

  // Tolerate quoted/unquoted values and a trailing comment, but nothing else.
  const m = frontmatter.match(/^name:\s*(?:"([^"]*)"|'([^']*)'|([^#\n]*))/m);
  if (!m) fail("frontmatter missing 'name' in " + file);
  const actual = (m[1] ?? m[2] ?? m[3] ?? "").trim();

  const expected = pluginName + ":" + skillDir;
  if (actual !== expected) {
    fail(
      "name must be '" +
        expected +
        "' (plugin manifest name + skill directory), got '" +
        actual +
        "' in " +
        file,
    );
  }
}

for (const file of skills) {
  const content = fs.readFileSync(file, "utf8");
  parseSkillPath(file); // fails on any layout the loader would silently drop

  if (!content.startsWith("---\n")) {
    fail("missing YAML frontmatter: " + file);
  }

  const end = content.indexOf("\n---", 4);
  if (end === -1) fail("unclosed frontmatter: " + file);

  const frontmatter = content.slice(4, end);
  const body = content.slice(end + 4);

  checkName(file, frontmatter);

  if (!/^description:/m.test(frontmatter)) {
    fail("frontmatter missing 'description' in " + file);
  }
  if (!/Do NOT use for:/i.test(frontmatter)) {
    fail("description must include 'Do NOT use for:' negatives in " + file);
  }

  if (!body.includes("Alex Tong's Toolkit")) {
    fail("SKILL.md missing toolkit byline: " + file);
  }
}

console.log("OK: " + skills.length + " skills validated");

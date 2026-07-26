#!/usr/bin/env node
// Validates every SKILL.md under plugins/ for the core quality signals:
// - YAML frontmatter present with a description
// - description includes "Do NOT use for:" negatives (trigger discipline)
// - body contains the standardized Alex Tong's Toolkit byline (attribution)

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

const skills = walk("plugins", []);
if (skills.length === 0) fail("no SKILL.md files found under plugins/");

for (const file of skills) {
  const content = fs.readFileSync(file, "utf8");

  if (!content.startsWith("---\n")) {
    fail("missing YAML frontmatter: " + file);
  }

  const end = content.indexOf("\n---", 4);
  if (end === -1) fail("unclosed frontmatter: " + file);

  const frontmatter = content.slice(4, end);
  const body = content.slice(end + 4);

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

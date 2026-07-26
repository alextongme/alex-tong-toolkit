#!/usr/bin/env node
// Smoke test: the pr-summary skill's worked example must
// contain every section the skill promises to emit, in the right shape.

const fs = require("fs");
const SKILL = "plugins/pr/skills/summary/SKILL.md";

const content = fs.readFileSync(SKILL, "utf8");

const exampleIdx = content.indexOf("\n## Example\n");
if (exampleIdx === -1) {
  console.error("FAIL: no ## Example section in " + SKILL);
  process.exit(1);
}

// The example's rendered PR body is wrapped in a fenced code block that
// follows an "**Output:**" marker. Find that, then search within the rest
// of the file — the markers are unique enough that bleed-over into later
// sections is not a concern.
const outputIdx = content.indexOf("**Output:**", exampleIdx);
if (outputIdx === -1) {
  console.error("FAIL: example is missing an '**Output:**' block");
  process.exit(1);
}
const example = content.slice(outputIdx);

const required = [
  "## Why",
  "## What changed",
  "**Review focus:**",
  "## Risk",
  "## Testing",
  "[!NOTE]",
];

const missing = required.filter((r) => !example.includes(r));
if (missing.length > 0) {
  console.error(
    "FAIL: example is missing: " + missing.map((m) => `"${m}"`).join(", "),
  );
  process.exit(1);
}

console.log("OK: pr-summary example contains all required markers");

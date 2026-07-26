#!/usr/bin/env node
// Parses every *.json file under the repo and fails on any invalid JSON.
// Skips node_modules, .git, and .vercel.

const fs = require("fs");
const path = require("path");

const SKIP = new Set(["node_modules", ".git", ".vercel"]);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".json")) out.push(p);
  }
  return out;
}

const files = walk(".", []);
let failures = 0;

for (const f of files) {
  try {
    JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (err) {
    console.error("INVALID JSON: " + f + " — " + err.message);
    failures++;
  }
}

if (failures > 0) {
  console.error(failures + " JSON file(s) failed to parse");
  process.exit(1);
}

console.log("OK: " + files.length + " JSON files parsed cleanly");

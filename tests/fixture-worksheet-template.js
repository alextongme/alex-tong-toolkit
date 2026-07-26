#!/usr/bin/env node
// Smoke test: worksheet-maker base-template.html must:
// - be valid-looking HTML (doctype, html, body)
// - carry the attribution comment
// - use pure @page CSS (no paper-css CDN dependency)
// - include the .sheet class as an explicit-dimension Safari fallback
// - include @media print with a .sheet override
// - set print-color-adjust: exact so accent colors survive print
// - leave text left-aligned (never justified)

const fs = require("fs");
const TPL = "plugins/education/skills/worksheet/references/base-template.html";

const content = fs.readFileSync(TPL, "utf8");

const checks = [
  { name: "doctype present", test: /<!DOCTYPE html>/i.test(content) },
  { name: "<html> tag", test: /<html[^>]*>/.test(content) },
  { name: "<body> tag", test: /<body[^>]*>/.test(content) },
  {
    name: "attribution comment",
    test: content.includes("Generated with worksheet-maker by Alex Tong"),
  },
  {
    name: "no paper-css CDN dep",
    test: !/<link[^>]*paper-css|@import[^;]*paper-css/i.test(content),
  },
  { name: "@page size rule", test: /@page\s*\{[\s\S]*?size:/.test(content) },
  { name: ".sheet class defined", test: /\.sheet\s*\{/.test(content) },
  {
    name: "sheet has explicit width",
    test: /\.sheet\s*\{[\s\S]*?width:/.test(content),
  },
  {
    name: "sheet has explicit height",
    test: /\.sheet\s*\{[\s\S]*?height:/.test(content),
  },
  { name: "@media print override", test: /@media\s+print/.test(content) },
  {
    name: "section.sheet in body",
    test: content.includes('<section class="sheet">'),
  },
  {
    name: "print-color-adjust: exact",
    test: /print-color-adjust\s*:\s*exact/.test(content),
  },
  {
    name: "text-align: left (never justified)",
    test: /text-align\s*:\s*left/.test(content),
  },
];

let failed = 0;
for (const c of checks) {
  if (!c.test) {
    console.error("FAIL: base-template.html check — " + c.name);
    failed++;
  }
}
if (failed > 0) {
  console.error(failed + " check(s) failed");
  process.exit(1);
}

console.log("OK: base-template.html passes " + checks.length + " print checks");

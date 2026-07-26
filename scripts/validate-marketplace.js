#!/usr/bin/env node
// Validates .claude-plugin/marketplace.json against the expected schema
// and cross-checks every plugin's own plugin.json for name/version alignment.

const fs = require("fs");
const path = require("path");

const MARKETPLACE_PATH = ".claude-plugin/marketplace.json";

function fail(msg) {
  console.error("FAIL: " + msg);
  process.exit(1);
}

if (!fs.existsSync(MARKETPLACE_PATH)) {
  fail("missing " + MARKETPLACE_PATH);
}

let marketplace;
try {
  marketplace = JSON.parse(fs.readFileSync(MARKETPLACE_PATH, "utf8"));
} catch (err) {
  fail(MARKETPLACE_PATH + " is not valid JSON: " + err.message);
}

if (!marketplace.name) fail("marketplace.json missing 'name'");
if (!marketplace.owner || !marketplace.owner.name) {
  fail("marketplace.json missing 'owner.name'");
}
if (!Array.isArray(marketplace.plugins)) {
  fail("marketplace.json missing 'plugins' array");
}

const seen = new Set();
for (const plugin of marketplace.plugins) {
  if (!plugin.name) fail("plugin entry missing 'name'");
  if (seen.has(plugin.name)) fail("duplicate plugin name: " + plugin.name);
  seen.add(plugin.name);

  if (!plugin.source) fail("plugin missing 'source': " + plugin.name);
  if (!plugin.version) fail("plugin missing 'version': " + plugin.name);

  const sourceDir = plugin.source.replace(/^\.\//, "");
  const pluginJsonPath = path.join(sourceDir, ".claude-plugin", "plugin.json");
  if (!fs.existsSync(pluginJsonPath)) {
    fail("plugin.json not found at " + pluginJsonPath);
  }

  let pluginJson;
  try {
    pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, "utf8"));
  } catch (err) {
    fail(pluginJsonPath + " is not valid JSON: " + err.message);
  }

  if (pluginJson.name !== plugin.name) {
    fail(
      "name mismatch: marketplace=" +
        plugin.name +
        " plugin.json=" +
        pluginJson.name,
    );
  }
  if (pluginJson.version !== plugin.version) {
    fail(
      "version mismatch for " +
        plugin.name +
        ": marketplace=" +
        plugin.version +
        " plugin.json=" +
        pluginJson.version,
    );
  }
}

console.log("OK: " + marketplace.plugins.length + " plugins validated");

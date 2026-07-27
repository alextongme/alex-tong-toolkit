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

  // A hooks file with the wrong shape is the worst failure mode in this repo:
  // the plugin installs, validates, and reports healthy while its hook never
  // registers. The event map must be nested under a top-level "hooks" key —
  // `{ "hooks": { "PreToolUse": [...] } }`, not `{ "PreToolUse": [...] }`.
  const hooksPath = path.join(sourceDir, "hooks", "hooks.json");
  if (fs.existsSync(hooksPath)) {
    let hooks;
    try {
      hooks = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
    } catch (err) {
      fail(hooksPath + " is not valid JSON: " + err.message);
    }
    if (!hooks.hooks || typeof hooks.hooks !== "object") {
      fail(
        hooksPath +
          ' must nest its event map under a top-level "hooks" key — ' +
          'got { "' +
          Object.keys(hooks).join('", "') +
          '" }. Without the wrapper the hook silently never registers.',
      );
    }
  }
}

// Every plugin directory on disk must be accounted for. An unlisted plugin is
// invisible to installers; a listed-but-missing one breaks the marketplace.
// Neither is caught by the per-entry checks above.
const PLUGIN_ROOT = "plugins";
if (fs.existsSync(PLUGIN_ROOT)) {
  const onDisk = fs
    .readdirSync(PLUGIN_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const listed = new Set(
    marketplace.plugins.map((p) => p.source.replace(/^\.\/plugins\//, "")),
  );
  for (const dir of onDisk) {
    if (!listed.has(dir)) {
      fail(
        "plugins/" +
          dir +
          " exists on disk but is not in marketplace.json — it ships in the repo " +
          "but no one can install it. List it, or move it to in-progress/.",
      );
    }
  }
}

// renames maps old plugin name -> current plugin name. A typo here silently
// strands everyone who has the old plugin installed.
const names = new Set(marketplace.plugins.map((p) => p.name));
for (const [from, to] of Object.entries(marketplace.renames || {})) {
  if (!names.has(to)) {
    fail(
      'renames["' +
        from +
        '"] points at "' +
        to +
        '", which is not a plugin in this marketplace',
    );
  }
  if (names.has(from)) {
    fail(
      'renames["' +
        from +
        '"] is also a live plugin name — a plugin cannot be both current and renamed away',
    );
  }
}

console.log(
  "OK: " +
    marketplace.plugins.length +
    " plugins validated, " +
    Object.keys(marketplace.renames || {}).length +
    " renames checked",
);

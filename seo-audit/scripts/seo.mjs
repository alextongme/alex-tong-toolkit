#!/usr/bin/env node
// seo.mjs — freeze every measurable search signal for one site into one dated
// folder, so the same command run weeks later produces a directly comparable
// folder and the difference between the two is a fact rather than a feeling.
//
// Nothing here phones home. Every request goes to the site named in your own
// config, or to an API you configured with your own credentials. The outbound
// hosts are listed in the plugin README.
//
// Commands, in the order they are usually needed
//   init      write a seo.config.json for this project, by asking the filesystem first
//   robots    which AI crawlers can read this site — no credentials, runs anywhere
//   canary    ask every configured source a question whose answer is already known
//   onpage    crawl every sitemap URL once and write the result to a file
//   capture   a full dated snapshot: on-page always, plus whatever is unlocked
//   compare   diff two snapshots
//   list      what has been captured so far
//   doctor    are the credentials present AND alive
//
// Usage
//   node seo.mjs robots --site https://example.com
//   node seo.mjs canary
//   node seo.mjs capture --label baseline
//   node seo.mjs capture --label t1 --until 2026-10-17
//   node seo.mjs onpage --base http://localhost:3311 --out before.json
//   node seo.mjs compare baseline t1
//
// Configuration
//   Every command reads ./seo.config.json (or --config <path>). Flags win over
//   the config file. `robots` and `onpage` need nothing but a URL, so the first
//   useful run needs no config and no credentials at all.
//
// Credentials, all optional, all the user's own
//   Search Console  a Google service-account JSON key, path in the config or
//                   in GSC_SA_KEY_FILE. Read-only scope. Never printed.
//   PSI_API_KEY     PageSpeed Insights, read from the macOS keychain (or env).
//   BING_WMT_API_KEY  Bing Webmaster Tools, same.
//   A value is never echoed: `doctor` reports only whether a key was found and
//   whether it still works.

import { execFileSync } from "node:child_process";
import { createHash, createSign } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync,
} from "node:fs";
import { homedir, userInfo } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------- config
//
// Everything this script knows about a site comes from one file. There is no
// site baked into the code: a hard-coded domain is the difference between a
// tool and one person's script.

const CONFIG_NAME = "seo.config.json";

const DEFAULT_CONFIG = {
  site: null,
  searchConsole: { properties: [], keyFile: null },
  snapshotDir: "seo-snapshots",
  psi: { urls: [] },
  bing: { enabled: true },
  changeBoundary: null,
};

// `~` is expanded here rather than left to the shell, because these paths
// arrive from a JSON file where no shell ever sees them.
function expandHome(p) {
  if (!p) return p;
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

// Where a site with no code project keeps its config and its snapshots. Most
// people auditing a site do not have its source: Squarespace, Wix, Shopify and
// hosted WordPress give you a URL and nothing to `cd` into. One folder per
// host, so the second run finds the first run's baseline without being told
// where it went.
const AUDIT_HOME = join(homedir(), "seo-audits");

function auditHomeFor(site) {
  const host = String(site).replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/[^a-z0-9.-]/gi, "-");
  return join(AUDIT_HOME, host);
}

const PROJECT_MARKERS = [
  ".git", "package.json", "astro.config.mjs", "astro.config.js", "next.config.js",
  "next.config.mjs", "gatsby-config.js", "hugo.toml", "_config.yml", "Gemfile", "index.html",
];
const looksLikeProject = (dir) => PROJECT_MARKERS.some((m) => existsSync(join(dir, m)));

function findConfigPath(flags = {}) {
  const explicit = flags.config;
  if (explicit && explicit !== true) return expandHome(explicit);
  // Walk up from the working directory so the script works from a subfolder.
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, CONFIG_NAME);
    if (existsSync(candidate)) return candidate;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  // Nothing here and nothing above: this may be a site with no code, set up
  // by `init` under ~/seo-audits/<host>/.
  if (!existsSync(AUDIT_HOME)) return null;
  if (flags.site && flags.site !== true) {
    const byHost = join(auditHomeFor(flags.site), CONFIG_NAME);
    return existsSync(byHost) ? byHost : null;
  }
  const homes = readdirSync(AUDIT_HOME, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(AUDIT_HOME, e.name, CONFIG_NAME)))
    .map((e) => join(AUDIT_HOME, e.name, CONFIG_NAME));
  if (homes.length === 1) return homes[0];
  if (homes.length > 1) {
    // Same rule as an ambiguous snapshot label: a guess here would silently
    // audit somebody else's site.
    throw new Error(
      `No ${CONFIG_NAME} here, and ${homes.length} sites are set up in ${AUDIT_HOME}:\n  ` +
      `${homes.join("\n  ")}\nPass --site <url>, or --config <path>.`,
    );
  }
  return null;
}

function loadConfig(flags = {}) {
  const path = findConfigPath(flags);
  let raw = {};
  if (path) {
    try {
      raw = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      throw new Error(`${path} is not valid JSON: ${err.message}`);
    }
  }
  const cfg = {
    ...DEFAULT_CONFIG,
    ...raw,
    searchConsole: { ...DEFAULT_CONFIG.searchConsole, ...(raw.searchConsole || {}) },
    psi: { ...DEFAULT_CONFIG.psi, ...(raw.psi || {}) },
    bing: { ...DEFAULT_CONFIG.bing, ...(raw.bing || {}) },
    _path: path,
    _dir: path ? dirname(path) : process.cwd(),
  };

  // A flag always wins over the file, so one config can serve a local build,
  // a staging host and production without being edited.
  if (flags.site && flags.site !== true) cfg.site = String(flags.site);
  if (cfg.site) cfg.site = cfg.site.replace(/\/+$/, "");

  cfg.keyFile = expandHome(
    process.env.GSC_SA_KEY_FILE ||
    cfg.searchConsole.keyFile ||
    join(homedir(), ".config", "seo-audit", "gsc-service-account.json"),
  );
  cfg.properties = cfg.searchConsole.properties || [];
  cfg.snapRoot = expandHome(
    flags.snapshots && flags.snapshots !== true ? flags.snapshots
      : isAbsolute(cfg.snapshotDir) ? cfg.snapshotDir
      : join(cfg._dir, cfg.snapshotDir),
  );
  return cfg;
}

function requireSite(cfg) {
  if (cfg.site) return cfg.site;
  throw new Error(
    `No site. Pass --site https://example.com, or run \`node seo.mjs init\` to write a ${CONFIG_NAME}.`,
  );
}

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};
const paint = (s, c) => `${c}${s}${C.reset}`;
const ok = (s) => paint(s, C.green);
const warn = (s) => paint(s, C.yellow);
const bad = (s) => paint(s, C.red);

// ---------------------------------------------------------------- utilities

function parseFlags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { out[key] = next; i++; }
      else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

const iso = (d) => d.toISOString().slice(0, 10);
function daysAgo(n, from) {
  const d = from ? new Date(`${from}T12:00:00Z`) : new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return iso(d);
}

// A snapshot holds a site's Search Console queries, which are that owner's
// private data even though the site is public. Written 0600, never world-readable.
function writeJSON(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
  try { chmodSync(path, 0o600); } catch { /* best effort; a failed chmod is not a failed capture */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// padEnd on a coloured string pads the escape bytes too, so a column lines up
// only while every label happens to be the same length. Pad on what is visible.
const plain = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, "");
const padVisible = (s, w) => s + " ".repeat(Math.max(0, w - plain(s).length));

// API keys live in the macOS keychain, never in a file, and never on a command
// line where they would land in shell history. The value is returned to the
// caller and never logged; `doctor` only ever reports whether it is set.
const secretCache = new Map();
function secret(name) {
  if (process.env[name]) return process.env[name];
  if (secretCache.has(name)) return secretCache.get(name);
  let value = null;
  try {
    value = execFileSync(
      "security",
      ["find-generic-password", "-a", userInfo().username, "-s", name, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim() || null;
  } catch {
    value = null; // not in the keychain; the caller decides whether that matters
  }
  secretCache.set(name, value);
  return value;
}

// ------------------------------------------------------------- url safety
//
// The crawler follows a sitemap, and a sitemap is a list of URLs somebody else
// wrote. Auditing your own site, that is your own list; auditing a client's, it
// is not. An unchecked crawler pointed at `http://169.254.169.254/` or at a
// service on localhost will fetch it and put what came back in a report.
//
// This is the small version of the guard on purpose. It refuses non-HTTP
// schemes and any host that resolves to a non-public address, and it re-checks
// after every redirect, because a public hostname may redirect to a private
// one. It does not pin DNS: that defends against a name resolving differently
// between the check and the connection, which is a real attack on a hosted
// service and not a meaningful one for a tool running on the auditor's laptop.

const BLOCKED_HOSTNAMES = new Set([
  "localhost", "metadata", "metadata.google.internal",
  "instance-data", "169.254.169.254", "[::1]", "::1",
]);

function isPublicAddress(ip) {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return false;          // this network, private, loopback
    if (a === 169 && b === 254) return false;                     // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;            // private
    if (a === 192 && b === 168) return false;                     // private
    if (a === 100 && b >= 64 && b <= 127) return false;           // carrier-grade NAT
    if (a === 192 && b === 0) return false;                       // IETF protocol assignments
    if (a >= 224) return false;                                   // multicast and reserved
    return true;
  }
  if (v === 6) {
    const ip6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
    if (ip6 === "::" || ip6 === "::1") return false;
    if (ip6.startsWith("fe8") || ip6.startsWith("fe9") ||
        ip6.startsWith("fea") || ip6.startsWith("feb")) return false; // link-local
    if (ip6.startsWith("fc") || ip6.startsWith("fd")) return false;   // unique local
    if (ip6.startsWith("ff")) return false;                           // multicast
    if (ip6.startsWith("::ffff:")) return isPublicAddress(ip6.slice(7)); // v4-mapped
    return true;
  }
  return false;
}

// One verdict per hostname per run. Without this the check costs a DNS lookup
// on every URL in a sitemap, which on a large site is the slowest thing here.
const hostVerdicts = new Map();

// Throws rather than returning false: a URL that cannot be shown to be safe is
// never fetched, and the reason reaches the report instead of a silent skip.
async function assertPublicUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error(`not a URL: ${url}`); }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`refusing ${u.protocol} URL: ${url}`);
  }
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost")) {
    throw new Error(`refusing blocked host: ${host}`);
  }
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new Error(`refusing non-public address: ${host}`);
    return u;
  }
  if (hostVerdicts.has(host)) {
    const verdict = hostVerdicts.get(host);
    if (verdict) throw new Error(verdict);
    return u;
  }
  let addrs;
  try {
    addrs = await lookup(host, { all: true });
  } catch (err) {
    // A name that does not resolve is a dead URL, not an unsafe one. It is
    // left to the fetch so the page is reported as an error with the real
    // reason rather than as a refusal.
    hostVerdicts.set(host, null);
    return u;
  }
  // Every A/AAAA record has to pass. One private answer among public ones is
  // still a private answer the connection might use.
  for (const a of addrs) {
    if (!isPublicAddress(a.address)) {
      const why = `refusing ${host}: resolves to non-public ${a.address}`;
      hostVerdicts.set(host, why);
      throw new Error(why);
    }
  }
  hostVerdicts.set(host, null);
  return u;
}

// How a fetch resolved, as four values rather than ok/failed. A bot challenge
// and a dead page are opposite findings — one says the site has a broken page,
// the other says the site's own edge is turning crawlers away, which is the
// same thing the AI-crawler check looks for — and a single `failed` count
// cannot tell them apart.
const FETCH_CLASSES = ["ok", "blocked", "rate_limited", "error"];

function classifyResponse(res, body = "") {
  if (res.status === 429) return "rate_limited";
  if (res.status === 401 || res.status === 403) return "blocked";
  if (res.status === 503 && /cloudflare|just a moment|attention required|checking your browser/i.test(body)) {
    return "blocked";
  }
  // A 5xx that is not a challenge is the server failing, not a page to read.
  // It only became reachable here once fetchWithRetry stopped throwing on the
  // last attempt; before that it arrived as a caught exception and was classed
  // `error` on the way past.
  if (res.status >= 500) return "error";
  return "ok";
}

const MAX_REDIRECTS = 5;

// Redirects are followed by hand so every hop can be re-validated, and so the
// chain itself is recorded: `redirect: "follow"` hides both.
async function fetchPageSafely(url, options = {}, tries = 3) {
  const chain = [];
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // Each hop goes through fetchWithRetry, so each hop is re-validated: a
    // public hostname is allowed to redirect to a private one, and that is
    // the case a single up-front check misses.
    const res = await fetchWithRetry(current, { ...options, redirect: "manual" }, tries);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location"), current).toString();
      chain.push({ from: current, status: res.status, to: next });
      current = next;
      continue;
    }
    return { res, finalUrl: current, chain };
  }
  throw new Error(`more than ${MAX_REDIRECTS} redirects from ${url}`);
}

async function fetchWithRetry(url, options = {}, tries = 3) {
  // Every outbound request in this script passes through here — sitemap,
  // robots.txt, crawler probes, pages, and the configured APIs — so this is
  // where the URL guard belongs. It sat in `crawlPage` first, which left the
  // sitemap fetch, the very first request a crawl makes, unchecked.
  await assertPublicUrl(url);
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(60_000) });
      if (res.status === 429 || res.status >= 500) {
        // Out of attempts: hand the caller the real response rather than
        // throwing. Giving up here is what made `rate_limited` and a
        // Cloudflare 503 challenge unreachable — both arrived at the
        // classifier as a caught exception and were recorded as `error`,
        // which is the opposite finding. A request that never got an answer
        // at all still throws, below.
        if (i === tries - 1) return res;
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(3000 * 2 ** i); // 3s, 6s, 12s, 24s, 48s
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr;
}

// ------------------------------------------------- google service account auth

let cachedToken = null;

function haveKeyFile(cfg) {
  return Boolean(cfg.keyFile) && existsSync(cfg.keyFile);
}

async function getAccessToken(cfg) {
  if (cachedToken && cachedToken.exp > Date.now() / 1000 + 60) return cachedToken.token;
  if (!haveKeyFile(cfg)) {
    throw new Error(`No Search Console key at ${cfg.keyFile}. Run: node seo.mjs doctor`);
  }
  const key = JSON.parse(readFileSync(cfg.keyFile, "utf8"));
  if (!key.client_email || !key.private_key) {
    throw new Error(`${cfg.keyFile} is not a service-account key (no client_email/private_key).`);
  }
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "RS256", typ: "JWT" });
  const claim = b64({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp, iat,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${claim}`);
  const sig = signer.sign(key.private_key).toString("base64url");

  const res = await fetchWithRetry("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${claim}.${sig}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    // body.error_description can name the exact misconfiguration; it carries no secret.
    throw new Error(`Token request failed (${res.status}): ${body.error_description || body.error}`);
  }
  cachedToken = { token: body.access_token, exp };
  return body.access_token;
}

async function gscFetch(cfg, url, init = {}) {
  const token = await getAccessToken(cfg);
  const res = await fetchWithRetry(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function listProperties(cfg) {
  const body = await gscFetch(cfg, "https://www.googleapis.com/webmasters/v3/sites");
  return body.siteEntry || [];
}

async function searchAnalytics(cfg, property, { startDate, endDate, dimensions, rowLimit = 1000 }) {
  const url =
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}` +
    `/searchAnalytics/query`;
  const rows = [];
  let startRow = 0;
  // GSC caps a single response at 25k rows; page until it stops filling.
  for (;;) {
    const body = await gscFetch(cfg, url, {
      method: "POST",
      body: JSON.stringify({
        startDate, endDate, dimensions, rowLimit, startRow,
        type: "web",
        dataState: "all", // include the fresh, still-settling days and flag them
      }),
    });
    const got = body.rows || [];
    rows.push(...got);
    if (got.length < rowLimit) break;
    startRow += rowLimit;
    if (startRow >= 25_000) break;
  }
  return rows;
}

async function inspectUrl(cfg, property, inspectionUrl) {
  const body = await gscFetch(
    cfg,
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    {
      method: "POST",
      body: JSON.stringify({ inspectionUrl, siteUrl: property, languageCode: "en-US" }),
    },
  );
  return body.inspectionResult || {};
}

// ------------------------------------------------------------- on-page crawl

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

// Meta text arrives HTML-escaped (&#x27;, &amp;). Google decodes it before
// showing it, so the snapshot must too — otherwise an unchanged description
// that merely gained an apostrophe reads as a diff.
const ENTITIES = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&apos;": "'", "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–",
};
function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e);
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? decodeEntities((m[2] ?? m[3] ?? "").trim()) : null;
}

function metaContent(html, key, keyAttr = "name") {
  const re = new RegExp(`<meta[^>]*${keyAttr}\\s*=\\s*["']${key}["'][^>]*>`, "i");
  const m = html.match(re);
  return m ? attr(m[0], "content") : null;
}

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : parsed["@graph"] || [parsed];
      for (const item of items) out.push(item);
    } catch {
      out.push({ "@type": "__unparseable__" });
    }
  }
  return out;
}

// Walk a parsed JSON-LD tree, not just its top level.
//
// Both of the readers below used to look only at the root of each block, and on
// a real site that is where the answer usually is not. On a typical blog, every
// post declares `BlogPosting` at the root and nests `Person` (author),
// `Organization` (publisher) and `ImageObject` inside it. The crawler reported
// `BlogPosting` and nothing else, so a pre-call hand-check that found the
// nested entities looked like it disagreed with the tool — the tool was simply
// not looking.
//
// This matters most for `sameAs`, which is the single most load-bearing field
// in the entity graph and which is conventionally attached to the nested
// `author` or `publisher` rather than to the root. A plugin whose whole subject
// is "can an assistant tell who this is" must not miss the field that says so.
function walkJsonLd(node, visit, seen = new Set()) {
  if (!node || typeof node !== "object") return;
  // Cheap cycle guard: JSON.parse cannot produce one, but @graph documents get
  // re-entered through shared references often enough to be worth the set.
  if (seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const v of node) walkJsonLd(v, visit, seen);
    return;
  }
  visit(node);
  for (const v of Object.values(node)) walkJsonLd(v, visit, seen);
}

function jsonLdTypesDeep(blocks) {
  const types = new Set();
  walkJsonLd(blocks, (node) => {
    const t = node["@type"];
    if (!t) return;
    for (const one of Array.isArray(t) ? t : [t]) if (one) types.add(String(one));
  });
  return [...types].sort();
}

// `disambiguatingDescription` is schema.org's dedicated field for separating an
// entity from OTHERS THAT SHARE ITS NAME, and on a personal site it is the one
// lever that targets the same-name problem directly.
//
// Added 2026-09-21 after an AI-visibility probe of alextong.me measured the
// failure this field exists for: asked "who is Alex Tong" with no other context,
// 3 of the 4 assistants that answered described a DIFFERENT person, and one
// never mentioned the site's owner at all. Add any credential to the same
// question and all four resolve correctly. The entity was legible; the NAME was
// not distinctive. `sameAs` does not help here — it consolidates the profiles
// you own, and says nothing about the stranger you are confused with.
//
// ⚠️ Reported as a finding, never auto-filled. What belongs in it is a claim
// about a real person, and a tool that guesses one is inventing a biography.
function jsonLdDisambiguationDeep(blocks) {
  const out = [];
  walkJsonLd(blocks, (node) => {
    const t = [node["@type"]].flat().filter(Boolean).map(String);
    if (!t.some((x) => x === "Person" || x === "Organization" || x === "LocalBusiness")) return;
    out.push({
      type: t.join(","),
      name: node.name ? String(node.name) : null,
      hasDisambiguatingDescription: Boolean(node.disambiguatingDescription),
      hasAlternateName: Boolean(node.alternateName),
    });
  });
  return out;
}

// The picture a Person says they look like, and whether that
// picture is actually rendered on the page.
//
// Added 2026-09-22 after a Google search for "alex tong" showed an Images row
// of three other Alex Tongs and not the site's owner. The Person JSON-LD named
// a headshot that only rendered at 56px with empty alt on /contact, while the
// large portrait on / and /about was named nowhere in the schema. Google trusts
// a structured-data image more when the same picture is visible on the page,
// and the name-search image row is filled from the pages that rank for the name.
//
// Matching is by path, so `/_next/image?url=%2Fportrait.png`, a srcset entry and
// an absolute URL all count as the same picture. `null` = could not tell.
function entityImageUrls(node) {
  const out = [];
  for (const one of [node.image].flat()) {
    if (!one) continue;
    if (typeof one === "string") out.push(one);
    else if (typeof one === "object") out.push(one.url || one.contentUrl);
  }
  return out.filter(Boolean).map(String);
}

function imagePath(u, base) {
  try {
    const url = new URL(u, base);
    const inner = url.searchParams.get("url");
    if (inner && /\/_next\/image|\/_vercel\/image|\/cdn-cgi\/image/.test(url.pathname)) return imagePath(inner, base);
    return decodeURIComponent(url.pathname);
  } catch { return null; }
}

function jsonLdEntityImages(blocks, imgTags, base) {
  const shown = new Set();
  for (const tag of imgTags) {
    const srcs = [attr(tag, "src"), ...String(attr(tag, "srcset") || "").split(",").map((x) => x.trim().split(/\s+/)[0])];
    for (const src of srcs) {
      if (!src) continue;
      const p = imagePath(src.replace(/&amp;/g, "&"), base);
      if (p) shown.add(p);
    }
  }
  const out = [];
  walkJsonLd(blocks, (node) => {
    const t = [node["@type"]].flat().filter(Boolean).map(String);
    // Person only: an Organization's `image` is usually a logo or share card
    // that is never meant to render in the page body, and flagging it is noise.
    if (!t.includes("Person")) return;
    for (const image of entityImageUrls(node)) {
      const p = imagePath(image, base);
      out.push({ type: t.join(","), name: node.name ? String(node.name) : null, image, shownOnPage: p ? shown.has(p) : null });
    }
  });
  return out;
}

// The page's own dates and author, read the way an assistant reads them: from the
// JSON-LD node that describes THIS page (Article, BlogPosting, WebPage, Course…),
// with `article:published_time` as the fallback. An author given only as
// {"@id": "…#author"} is resolved against the block's @graph.
//
// Added 2026-09-24 after a free report on a large WordPress site. The snapshot
// carried no publish dates, so ageing 123 orphan pages meant fetching all 123
// again; and the finding that 387 posts named a Person that was really an agency account (an agency
// account with a placeholder avatar) as their author had to be reconstructed from
// Gravatar URLs. Both are things a report about "who does this site say it is"
// should read off the snapshot.
const PAGE_LEVEL_TYPES = new Set([
  "Article", "BlogPosting", "NewsArticle", "TechArticle", "Report", "WebPage", "CollectionPage",
  "ProfilePage", "AboutPage", "ContactPage", "FAQPage", "ItemPage", "QAPage", "Product", "Course",
  "Event", "VideoObject", "Recipe", "HowTo", "Service", "LocalBusiness", "Organization", "Person",
]);
function jsonLdPageMeta(blocks, html) {
  const byId = new Map();
  walkJsonLd(blocks, (node) => { if (node["@id"]) byId.set(String(node["@id"]), node); });
  let datePublished = null, dateModified = null, author = null;
  // Yoast writes the author as {"name": "…", "@id": "…#/schema/person/…"} and keeps
  // the @type on the graph node, so the reference and the node are merged: the
  // node supplies what the reference left out, the reference wins where both speak.
  const resolve = (n) => {
    if (!n || typeof n !== "object" || !n["@id"]) return n;
    const node = byId.get(String(n["@id"]));
    return node && node !== n ? { ...node, ...n } : n;
  };
  walkJsonLd(blocks, (node) => {
    const t = [node["@type"]].flat().filter(Boolean).map(String);
    if (!t.some((x) => PAGE_LEVEL_TYPES.has(x))) return;
    if (!datePublished && node.datePublished) datePublished = String(node.datePublished);
    if (!dateModified && node.dateModified) dateModified = String(node.dateModified);
    if (!author && node.author) {
      const a = resolve([node.author].flat()[0]);
      if (a && typeof a === "object") {
        author = {
          name: a.name ? String(a.name) : null,
          type: [a["@type"]].flat().filter(Boolean).map(String).join(",") || null,
        };
      } else if (typeof a === "string") {
        author = { name: a, type: null };
      }
    }
  });
  if (!datePublished) datePublished = metaContent(html, "article:published_time", "property");
  if (!dateModified) dateModified = metaContent(html, "article:modified_time", "property");
  return { datePublished, dateModified, author };
}

function jsonLdSameAsDeep(blocks) {
  const urls = new Set();
  walkJsonLd(blocks, (node) => {
    const s = node.sameAs;
    if (!s) return;
    for (const one of Array.isArray(s) ? s : [s]) if (one) urls.add(String(one));
  });
  return [...urls].sort();
}

// One spelling per page, so the inbound-link graph does not treat `/about`,
// `/about/` and `/about#team` as three different pages.
function normalizeLink(href, from) {
  try {
    const u = new URL(href, from);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.toLowerCase();
    let out = u.toString();
    if (out.endsWith("/") && u.pathname !== "/") out = out.slice(0, -1);
    return out;
  } catch { return null; }
}

// Text that talks to an assistant instead of to a reader. This is not a
// prompt-injection defence — nothing here is ever executed — it is a finding
// about the site: somebody has been trying to instruct assistants through this
// domain's content, which gets sites penalised and which the owner may not
// know about. The patterns are deliberately narrow. A missed instruction costs
// one finding; a false one accuses the owner of gaming, so the snippet is
// stored for a human to read rather than reported as a verdict.
const ASSISTANT_ADDRESSED = [
  /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|preceding)\s+instructions?/i,
  /(?:disregard|override|forget)\s+(?:your|all|any|the)\s+(?:previous\s+)?(?:instructions?|system\s+prompt|guidelines?|rules?)/i,
  /\bif\s+you(?:'re|\s+are)\s+(?:an?\s+)?(?:ai|a\s+language\s+model|an?\s+assistant|a\s+chatbot|an?\s+llm)\b/i,
  /\b(?:attention|note|instructions?|prompt)\s*[:,-]\s*(?:ai|llm|language\s+model|assistants?|chatgpt|claude|gemini|perplexity|copilot)\b/i,
  /\b(?:ai|llm|language\s+model|assistants?|chatgpt|claude|gemini|perplexity|copilot)s?\s*[,:]?\s*(?:please\s+)?(?:always\s+)?(?:recommend|cite|rank|mention|prioriti[sz]e|prefer)\s+(?:this|our|us\b)/i,
  /\bwhen\s+(?:asked|answering|recommending)\b[^.<]{0,80}\b(?:recommend|cite|mention)\s+(?:this|our|us)\b/i,
];

function findAssistantAddressed(...texts) {
  const out = [];
  for (const text of texts) {
    if (!text) continue;
    for (const re of ASSISTANT_ADDRESSED) {
      const m = text.match(re);
      if (!m) continue;
      const at = m.index ?? 0;
      // Enough either side that the reporter can see what it is attached to.
      const snippet = text.slice(Math.max(0, at - 80), at + m[0].length + 120).replace(/\s+/g, " ").trim();
      if (!out.includes(snippet)) out.push(snippet);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

// Server headers worth freezing. Nothing in v1.0 reads these beyond
// X-Robots-Tag: they are here because a baseline taken without them can never
// show that a site was replatformed, and a snapshot cannot be taken
// retroactively.
const CAPTURED_HEADERS = [
  "server", "x-powered-by", "x-generator", "via", "content-encoding",
  "strict-transport-security", "cf-cache-status", "x-shopify-stage",
  "x-wix-request-id", "x-vercel-id", "x-served-by", "x-github-request-id",
];

async function crawlPage(url, base, site = base) {
  const started = Date.now();
  let res, finalUrl, chain;
  try {
    ({ res, finalUrl, chain } = await fetchPageSafely(url, {
      headers: { "user-agent": "seo-audit-snapshot/1 (+https://github.com/alextongme/alex-tong-toolkit)" },
    }));
  } catch (err) {
    // A refusal by the URL guard is a finding about the sitemap, not a network
    // blip, so it is reported with the reason rather than as a bare failure.
    return { url, error: String(err.message || err), fetchClass: "error" };
  }
  const ms = Date.now() - started;
  // Reading the body is a second place the network can fail, and it used to sit
  // outside every try in this function. undici throws a bare `TypeError:
  // terminated` when a response body stream dies mid-read — a routine flake on
  // a big site — and that exception escaped crawlPage, rejected the whole
  // Promise batch in crawlSite, and threw away every page already fetched. One
  // dropped connection at page 84 of 133 lost the other 83 and wrote no
  // onpage.json at all. A page whose body cannot be read is an UNKNOWN, exactly
  // like a page whose headers could not be fetched.
  let html;
  try {
    html = await res.text();
  } catch (err) {
    return { url, finalUrl, status: res.status, error: `body: ${String(err.message || err)}`, fetchClass: "error" };
  }
  const fetchClass = classifyResponse(res, html.slice(0, 2000));

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : null;
  const canonicalTag = html.match(/<link[^>]*rel\s*=\s*["']canonical["'][^>]*>/i);
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]));
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1]));

  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgsNoAlt = imgs.filter((t) => attr(t, "alt") === null).length;

  const hrefs = [...html.matchAll(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')/gi)]
    .map((m) => (m[2] ?? m[3] ?? "").trim())
    .filter((h) => h && !h.startsWith("#") && !h.startsWith("mailto:") && !h.startsWith("tel:"));
  const internal = hrefs.filter((h) => h.startsWith("/") || h.startsWith(base) || h.startsWith(site));
  // Kept, not just counted: the inbound-link graph is built from these, and it
  // is what answers "is this page linked from a real page" — the doorway check.
  const internalTargets = [...new Set(internal.map((h) => normalizeLink(h, res.url || url)).filter(Boolean))];
  const external = hrefs.filter((h) => /^https?:\/\//i.test(h) && !h.startsWith(base) && !h.startsWith(site));
  const externalHosts = [...new Set(external.map((h) => { try { return new URL(h).host; } catch { return "?"; } }))].sort();

  const ld = jsonLdBlocks(html);
  const text = stripTags(html);
  // Comments are included because an instruction aimed at a crawler is more
  // often hidden than printed.
  const comments = [...html.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]).join(" ");
  const assistantAddressed = findAssistantAddressed(text, comments, JSON.stringify(ld));
  const pageMeta = jsonLdPageMeta(ld, html);

  return {
    url,
    finalUrl,
    status: res.status,
    redirected: finalUrl !== url,
    // The chain, not just the fact of one. Two hops to reach a sitemap URL is
    // a finding; `redirected: true` is not.
    redirectChain: chain,
    fetchClass,
    responseMs: ms,
    bytes: Buffer.byteLength(html),
    lang: (html.match(/<html[^>]*>/i)?.[0] && attr(html.match(/<html[^>]*>/i)[0], "lang")) || null,
    title,
    titleLength: title ? title.length : 0,
    description: metaContent(html, "description"),
    descriptionLength: (metaContent(html, "description") || "").length,
    robots: metaContent(html, "robots"),
    // The header form of the same directive. A page can be meta-indexable and
    // header-noindexed at once, and the more restrictive of the two is what
    // applies — Google's rule is "in the case of conflicting robots rules, the
    // more restrictive rule applies", not that the header outranks the tag. The
    // header is not privileged, it is just the half nobody reads, because it was
    // unreachable until this crawler started reading response headers at all.
    xRobotsTag: res.headers.get("x-robots-tag"),
    contentType: res.headers.get("content-type"),
    headers: Object.fromEntries(
      CAPTURED_HEADERS.map((h) => [h, res.headers.get(h)]).filter(([, v]) => v != null),
    ),
    // Names the CMS on WordPress, Ghost, Hugo, Drupal and some Squarespace
    // templates. Captured now, read by seo-plan later.
    generator: metaContent(html, "generator"),
    canonical: canonicalTag ? attr(canonicalTag[0], "href") : null,
    og: {
      title: metaContent(html, "og:title", "property"),
      description: metaContent(html, "og:description", "property"),
      image: metaContent(html, "og:image", "property"),
      type: metaContent(html, "og:type", "property"),
      url: metaContent(html, "og:url", "property"),
    },
    twitterCard: metaContent(html, "twitter:card"),
    h1: h1s,
    h1Count: h1s.length,
    h2Count: h2s.length,
    wordCount: text ? text.split(/\s+/).length : 0,
    images: imgs.length,
    imagesMissingAlt: imgsNoAlt,
    internalLinks: internal.length,
    internalTargets,
    externalLinks: external.length,
    externalHosts,
    jsonLdTypes: jsonLdTypesDeep(ld),
    // Only the types declared at the top of a block, kept separately because
    // "this page is a BlogPosting" and "a Person appears somewhere inside it"
    // are different statements and a report should not conflate them.
    jsonLdTopTypes: ld.map((x) => x["@type"]).flat().filter(Boolean),
    // sameAs is the entity graph; it is the single most load-bearing field in
    // the "is this the right Alex Tong" question, so it is captured verbatim.
    sameAs: jsonLdSameAsDeep(ld),
    // Named entities on the page and whether each one says which entity it is.
    // The same-name problem is invisible to every other check in this file.
    namedEntities: jsonLdDisambiguationDeep(ld),
    // The picture each entity claims, and whether this page renders it. What
    // fills the Images row on a search for the person's name.
    entityImages: jsonLdEntityImages(ld, imgs, res.url || url),
    // Candidate snippets, never a verdict: the reporter reads them before
    // quoting one. Empty on almost every page, and that is the expected case.
    assistantAddressed,
    // What the page says about itself: when it was published and changed, and
    // who wrote it, as {name, type}. `type: "Person"` with a company or agency
    // name in `name` is the finding jsonLdPageMeta was written for.
    datePublished: pageMeta.datePublished,
    dateModified: pageMeta.dateModified,
    author: pageMeta.author,
  };
}

// ------------------------------------------------------------- ai crawlers

// The bots that decide whether an assistant can quote this site at all. Split
// by operator so a report can say *who* is blocked, not just "something is".
const AI_CRAWLERS = [
  { name: "GPTBot", operator: "OpenAI", purpose: "training" },
  { name: "OAI-SearchBot", operator: "OpenAI", purpose: "search index" },
  { name: "ChatGPT-User", operator: "OpenAI", purpose: "live fetch on a user's behalf" },
  { name: "ClaudeBot", operator: "Anthropic", purpose: "training" },
  { name: "Claude-User", operator: "Anthropic", purpose: "live fetch on a user's behalf" },
  { name: "Claude-SearchBot", operator: "Anthropic", purpose: "search index" },
  { name: "PerplexityBot", operator: "Perplexity", purpose: "search index" },
  { name: "Perplexity-User", operator: "Perplexity", purpose: "live fetch on a user's behalf" },
  { name: "Google-Extended", operator: "Google", purpose: "Gemini / AI Overviews training" },
  { name: "Applebot-Extended", operator: "Apple", purpose: "training" },
  { name: "CCBot", operator: "Common Crawl", purpose: "corpus many models train on" },
];

// robots.txt groups: one or more consecutive User-agent lines, then the rules
// that apply to all of them. A blank line ends the group. Comments and unknown
// directives (Sitemap, Host) are ignored rather than dropped into the rule
// list, because only Allow/Disallow decide access.
//
// Crawl-delay is the exception: it decides nothing about access, but it is the
// site telling us how fast it is willing to be read, and this crawler arrives
// as an unverified bot on hosting the owner is often paying $5/month for. It
// is kept on the group so crawlSite can obey it.
function parseRobots(text) {
  const groups = [];
  let current = null;
  let sawRule = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) { current = null; sawRule = false; continue; }
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();

    if (field === "user-agent") {
      // Consecutive agents share one group; an agent after a rule starts a new one.
      if (!current || sawRule) { current = { agents: [], rules: [] }; groups.push(current); sawRule = false; }
      current.agents.push(value.toLowerCase());
    } else if (field === "allow" || field === "disallow") {
      if (!current) continue; // a rule with no preceding User-agent binds to nothing
      current.rules.push({ type: field, path: value });
      sawRule = true;
    } else if (field === "crawl-delay") {
      if (!current) continue;
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) current.crawlDelay = n;
      // Not a rule: a Crawl-delay between two Allow lines must not split the
      // group, so `sawRule` is deliberately left alone.
    }
  }
  return groups;
}

// What delay does this site ask of *us*? This crawler is unverified and has no
// group of its own anywhere, so in practice this is always the `*` group — but
// look up the real UA first, because a site that has bothered to name us is
// the one whose answer matters most.
function crawlDelayFor(groups, ua) {
  const name = ua.toLowerCase();
  const own = groups.find((g) => g.agents.some((a) => name.includes(a) && a !== "*"));
  const wild = groups.find((g) => g.agents.includes("*"));
  return (own || wild)?.crawlDelay ?? null;
}

// Most-specific-group-wins: a bot obeys its own group if it has one and ignores
// `*` entirely. That distinction matters in a report — an explicit block is a
// decision somebody made, a `*` block is usually collateral.
function robotsVerdict(groups, botName) {
  const bot = botName.toLowerCase();
  const own = groups.find((g) => g.agents.includes(bot));
  const wild = groups.find((g) => g.agents.includes("*"));
  const group = own || wild;
  if (!group) return { state: "allowed", via: "no matching group" };

  const via = own ? `User-agent: ${botName}` : "User-agent: *";
  const disallows = group.rules.filter((r) => r.type === "disallow" && r.path !== "");
  const allows = group.rules.filter((r) => r.type === "allow");
  if (!disallows.length) return { state: "allowed", via };
  if (disallows.some((r) => r.path === "/")) {
    // Two shapes share the name `partial` and they are inverses of each other,
    // so they must not share a rendering.
    //
    //   Disallow: /wp-admin/        <- open site, one room locked
    //   Disallow: /  + Allow: /x/   <- locked site, one room open
    //
    // Both are "not fully blocked". Only the first is anything like a yes. A
    // publisher writing `Allow: /sponsored/` above `Disallow: /` has closed the
    // entire editorial site to that bot, and reporting it as a yes with a
    // footnote is the same lie as reporting a dead API key as a zero — the
    // exact trap this tool exists to refuse. `closed` marks which shape it is
    // and every caller reads it before choosing a word.
    if (!allows.length) return { state: "blocked", via };
    return { state: "partial", via, closed: true, allowPaths: allows.map((r) => r.path) };
  }
  return { state: "partial", via, paths: disallows.map((r) => r.path) };
}

// robots.txt states an intention. The edge decides. Cloudflare's managed AI-bot
// blocking (now on by default for new zones) never appears in robots.txt, so a
// clean file and an open site are different facts — the same presence-vs-liveness
// trap that let a dead Bing key report as healthy. One live probe per operator,
// which is cheap and is the only half of this check that touches the world.
//
// 🔴 And it is a weak instrument, which is the whole reason this comment is
// long. The request presents another operator's crawler name from a laptop
// that is not on that operator's published address list, which is exactly the
// pattern bot management challenges. A refusal therefore measures whether the
// edge refuses *impersonators*, and the real GPTBot may be walking straight
// in. So: a 200 is an `allowed`. Everything else is UNKNOWN, reported as what
// was sent and what came back, and it never produces a blocked verdict on its
// own — only robots.txt can do that.
async function probeAiCrawler(base, botName) {
  const ua = `Mozilla/5.0 (compatible; ${botName}/1.0; +https://example.com/bot)`;
  const sent = `User-agent: ${ua}`;
  try {
    // Through the guard like every other request, and with retries off: a 429
    // is the answer here, not a reason to back off and ask again.
    const { res } = await fetchPageSafely(base, { headers: { "user-agent": ua } }, 1);
    const body = await res.text().catch(() => "");
    return {
      bot: botName,
      sent,
      status: res.status,
      fetchClass: classifyResponse(res, body.slice(0, 2000)),
      state: res.status === 200 ? "allowed" : "unknown",
      note: res.status === 200
        ? `the edge served a request presenting as ${botName} from this machine`
        : `the edge answered ${res.status} to a request presenting as ${botName} from this machine — ` +
          `that may be a block on ${botName}, or a block on anything impersonating it. This probe cannot tell them apart`,
    };
  } catch (err) {
    return {
      bot: botName,
      sent,
      state: "unknown",
      error: String(err.message || err),
      note: "the probe never got an answer, which says nothing about the crawler",
    };
  }
}

async function checkAiCrawlers(base, robotsText, robotsStatus) {
  // An unreachable robots.txt is not an open door. Report it as unknown, never
  // as allowed — a silently broken fetch and a permissive site look identical
  // from inside a single request.
  if (robotsText == null) {
    return {
      robotsTxt: robotsStatus ? `unreadable (HTTP ${robotsStatus})` : "unreachable",
      verdict: "unknown",
      note: "robots.txt could not be read; crawler access is undetermined, not open",
      bots: {},
      probes: [],
    };
  }

  const groups = parseRobots(robotsText);
  const bots = {};
  for (const c of AI_CRAWLERS) {
    bots[c.name] = { ...robotsVerdict(groups, c.name), operator: c.operator, purpose: c.purpose };
  }

  // Three independent probes and one llms.txt check, all at once. They were
  // sequential and none of them depends on another.
  const [probes, llmsTxt] = await Promise.all([
    Promise.all(["GPTBot", "ClaudeBot", "PerplexityBot"].map((n) => probeAiCrawler(base, n))),
    checkLlmsTxt(base),
  ]);

  const blocked = Object.entries(bots).filter(([, v]) => v.state === "blocked").map(([k]) => k);
  // Kept separate from `blocked` so a snapshot taken before this existed still
  // diffs cleanly, but it counts toward the verdict: a bot allowed only into
  // /sponsored/ cannot read the site any more than a blocked one can.
  const closedExcept = Object.entries(bots)
    .filter(([, v]) => v.closed)
    .map(([k, v]) => `${k} (except ${v.allowPaths.join(" ")})`);
  // The verdict is robots.txt's alone. A probe that was refused is an UNKNOWN
  // about an instrument, and an unknown never hardens into a finding.
  const probeUnknown = probes.filter((p) => p.state !== "allowed").map((p) => p.bot);
  return {
    robotsTxt: "read",
    verdict: blocked.length || closedExcept.length ? "blocked" : "allowed",
    verdictFrom: "robots.txt",
    blocked,
    closedExcept,
    probeUnknown,
    bots,
    probes,
    llmsTxt,
  };
}

// Does the site serve a real `llms.txt`?
//
// It is reported, never graded, and never turned into a finding on its own. No
// major assistant has committed to reading it, so "missing" is not a defect and
// saying otherwise would be selling a fix for a problem nobody has. It is here
// because its presence is a fact about the site an owner should know, and
// because a site that has one usually got it from a previous SEO engagement —
// which is worth asking about.
//
// The control matters more than the check. A 200 proves nothing on its own:
// Wix and WordPress both serve valid-looking pages at invented paths, so a
// naive fetch reports `llms.txt` on every site that has a catch-all. A known-
// absent path is fetched alongside it, and the file only counts as real if the
// control 404s and the content type is actually text.
async function checkLlmsTxt(base) {
  const control = `/zzz-seo-audit-control-${Date.now().toString(36)}`;
  const [hit, miss] = await Promise.all([
    fetchWithRetry(`${base}/llms.txt`, {}, 1).catch(() => null),
    fetchWithRetry(`${base}${control}`, {}, 1).catch(() => null),
  ]);
  if (!hit) return { state: "unknown", note: "llms.txt could not be fetched" };
  const type = hit.headers.get("content-type") || "";
  if (!hit.ok) return { state: "absent", status: hit.status };
  if (miss && miss.ok) {
    return {
      state: "unknown",
      status: hit.status,
      note: `control path ${control} also returned ${miss.status}; this host answers 200 at invented paths, so a 200 here proves nothing`,
    };
  }
  if (!/text\/plain|text\/markdown/i.test(type)) {
    return { state: "unknown", status: hit.status, contentType: type, note: "served, but not as text" };
  }
  const body = await hit.text().catch(() => "");
  return { state: "present", status: hit.status, contentType: type, bytes: body.length };
}

function reportAiCrawlers(ai) {
  if (!ai) return;
  console.log(paint("\nAI crawlers", C.cyan));
  if (ai.verdict === "unknown") {
    console.log(`  ${warn("unknown")} — ${ai.note}`);
    return;
  }
  const label = { blocked: bad("blocked"), partial: warn("partial"), allowed: ok("allowed") };
  for (const [name, v] of Object.entries(ai.bots)) {
    // A closed site with a carve-out gets the blocked colour and names the one
    // open path. Reading `partial` in warning yellow next to a bot that cannot
    // touch a single article is how a reader walks away with the wrong answer.
    const state = v.closed ? bad(`blocked except ${v.allowPaths.join(" ")}`) : label[v.state];
    const paths = v.paths ? paint(`  ${v.paths.join(" ")}`, C.dim) : "";
    console.log(`  ${name.padEnd(20)} ${padVisible(state, 28)}${paths}  ${paint(`(${v.operator} — ${v.purpose}; via ${v.via})`, C.dim)}`);
  }
  if (ai.probes?.length) {
    console.log(paint("\n  Live probe — what the edge did with a request carrying each bot's name", C.dim));
    for (const pr of ai.probes) {
      const verdict = pr.state === "allowed" ? ok(`allowed (HTTP ${pr.status})`)
        : warn(pr.error ? `UNKNOWN (${pr.error})` : `UNKNOWN (HTTP ${pr.status})`);
      console.log(`  ${paint("probe", C.dim)} ${pr.bot.padEnd(16)} ${verdict}`);
      console.log(`        ${paint(`sent ${pr.sent}`, C.dim)}`);
      console.log(`        ${paint(pr.note, C.dim)}`);
    }
    console.log(paint(
      "  An UNKNOWN here is not a blocked crawler. This machine is not on any of these\n" +
      "  operators' published address lists, so a refusal may be aimed at impersonators.\n" +
      "  Only the robots.txt table above states whether a bot is blocked.", C.dim));
  }
  if (ai.llmsTxt) {
    const l = ai.llmsTxt;
    const line = l.state === "present" ? ok(`present (${l.bytes} bytes, ${l.contentType})`)
      : l.state === "absent" ? paint(`absent (HTTP ${l.status})`, C.dim)
      : warn(`UNKNOWN — ${l.note}`);
    console.log(`\n  ${"llms.txt".padEnd(20)} ${line}`);
    console.log(paint(
      "  Reported, not graded. No major assistant has committed to reading llms.txt,\n" +
      "  so its absence is not a finding and nobody should be sold a fix for it.", C.dim));
  }
  if (ai.verdict === "blocked") {
    if (ai.blocked?.length) console.log(bad(`  → robots.txt blocks ${ai.blocked.join(", ")}.`));
    if (ai.closedExcept?.length) {
      console.log(bad(`  → robots.txt closes the whole site to ${ai.closedExcept.join(", ")}.`));
    }
  }
}

// ----------------------------------------------------------------- sitemaps
//
// A crawl is only ever as honest as the list it starts from, and
// `${base}/sitemap.xml` is the wrong list on most of the web. Checked against
// live sites on 2026-09-19: Yoast declares `/sitemap_index.xml` in robots.txt,
// WordPress core serves `/wp-sitemap.xml`, and Shopify, Jetpack and WordPress
// core all serve a **`<sitemapindex>`** — a list of sitemaps — at the path a
// naive crawler reads as a list of pages.
//
// That last one is the dangerous case, because it does not fail. The `<loc>`
// entries in an index point at child sitemaps, so the crawl fetches five XML
// files and files them as pages with no title, no H1 and no schema, and the
// canary passes on the way in. A wrong answer produced confidently in the
// first request is worse than no answer.
//
// So: read the `Sitemap:` lines out of robots.txt (already fetched), fall back
// to a short path list, and follow exactly one level of index.

const SITEMAP_FALLBACK_PATHS = ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"];
const MAX_CHILD_SITEMAPS = 50;
// Two levels, not one, and the second level was bought with a live check
// rather than reasoned about: ma.tt (Jetpack) serves index → index → urlset,
// so stopping at one level reads 9 URLs of a site with thousands — a clean
// 100% coverage figure over the wrong denominator. Anything deeper than this
// is recorded as not followed, because an undercount that says so is a gap
// and an undercount that does not is a lie.
const MAX_SITEMAP_DEPTH = 2;

// The status code lies in both directions here, so the body is the test:
// make.wordpress.org serves a valid sitemap index under HTTP 404, and a
// WordPress 404 page is served as HTML at every path you guess.
const looksLikeSitemap = (xml) => /<(sitemapindex|urlset)\b/i.test(xml);
const isSitemapIndex = (xml) => /<sitemapindex\b/i.test(xml);
const locsIn = (xml) =>
  [...xml.matchAll(/<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1].trim()));

// Every `Sitemap:` line, in order. A site may declare several — a WordPress
// multisite declares dozens — and by spec the value is an absolute URL.
function sitemapLinesFrom(robotsText) {
  if (!robotsText) return [];
  return [...robotsText.matchAll(/^[ \t]*sitemap[ \t]*:[ \t]*(\S+)/gim)].map((m) => m[1].trim());
}

async function fetchSitemapDoc(url) {
  const { res, finalUrl } = await fetchPageSafely(url, {
    headers: { "user-agent": "seo-audit-snapshot/1 (+https://github.com/alextongme/alex-tong-toolkit)" },
  });
  const xml = await res.text();
  return { url, finalUrl, status: res.status, xml, isSitemap: looksLikeSitemap(xml) };
}

// Returns the URLs *and how they were found*, because "which sitemap did you
// actually read" is itself a finding, and the canary has to be able to print
// it rather than a bare count.
async function discoverSitemap(base, { robotsText } = {}) {
  let robots = robotsText;
  if (robots === undefined) {
    const res = await fetchWithRetry(`${base}/robots.txt`).catch(() => null);
    robots = res && res.ok ? await res.text() : null;
  }

  const tried = [];
  const roots = [];
  const consider = async (url, via) => {
    let doc;
    try {
      doc = await fetchSitemapDoc(url);
    } catch (err) {
      tried.push({ url, via, error: String(err.message || err) });
      return null;
    }
    tried.push({ url: doc.finalUrl, via, status: doc.status, isSitemap: doc.isSitemap });
    return doc.isSitemap ? { ...doc, via } : null;
  };

  // A declared sitemap beats a guessed one outright: it is what the site says
  // about itself, and guessing is only ever a fallback.
  for (const url of sitemapLinesFrom(robots).slice(0, MAX_CHILD_SITEMAPS)) {
    const doc = await consider(url, "robots.txt Sitemap:");
    if (doc) roots.push(doc);
  }
  if (!roots.length) {
    for (const path of SITEMAP_FALLBACK_PATHS) {
      const doc = await consider(`${base}${path}`, "fallback path");
      if (doc) { roots.push(doc); break; }
    }
  }

  const urls = [];
  const pageSeen = new Set();
  const push = (locs) => {
    for (const u of locs) if (!pageSeen.has(u)) { pageSeen.add(u); urls.push(u); }
  };
  const fetched = new Set(roots.map((r) => r.finalUrl));
  const children = [];
  const notFollowed = [];

  const pending = roots.map((doc) => ({ doc, depth: 0 }));
  while (pending.length) {
    const { doc, depth } = pending.shift();
    if (!isSitemapIndex(doc.xml)) { push(locsIn(doc.xml)); continue; }
    for (const childUrl of locsIn(doc.xml)) {
      if (fetched.has(childUrl)) continue;
      if (depth + 1 > MAX_SITEMAP_DEPTH) {
        notFollowed.push({ url: childUrl, why: `nested more than ${MAX_SITEMAP_DEPTH} levels deep` });
        continue;
      }
      if (children.length >= MAX_CHILD_SITEMAPS) {
        notFollowed.push({ url: childUrl, why: `more than ${MAX_CHILD_SITEMAPS} sitemaps already read` });
        continue;
      }
      fetched.add(childUrl);
      let child;
      try {
        child = await fetchSitemapDoc(childUrl);
      } catch (err) {
        notFollowed.push({ url: childUrl, why: String(err.message || err) });
        continue;
      }
      if (!child.isSitemap) {
        notFollowed.push({ url: childUrl, why: `HTTP ${child.status}, and the body is not a sitemap` });
        continue;
      }
      const index = isSitemapIndex(child.xml);
      children.push({ url: child.finalUrl, depth: depth + 1, index, urls: index ? null : locsIn(child.xml).length });
      pending.push({ doc: child, depth: depth + 1 });
    }
  }

  return {
    base,
    urls,
    roots: roots.map((r) => ({ url: r.finalUrl, via: r.via, status: r.status, index: isSitemapIndex(r.xml) })),
    children,
    notFollowed,
    tried,
  };
}

async function fetchSitemapUrls(base, opts) {
  return (await discoverSitemap(base, opts)).urls;
}

// concurrency 8 is a deliberate ceiling, not a tuning knob left at its maximum.
// This crawler identifies as an unverified bot against sites it does not own,
// and a crawl that trips rate limiting produces `rate_limited` pages, which are
// UNKNOWNs that lower coverage — going faster can literally measure less. 8
// halves the wall-clock of a 133-page run against a CDN-backed host without
// getting challenged. Lower it with --concurrency on a small or strict origin.
// The crawler's own name, in one place, because the politeness check has to
// look itself up in robots.txt the way any other bot would.
const CRAWLER_UA = "seo-audit-snapshot/1 (+https://github.com/alextongme/alex-tong-toolkit)";

// A ceiling, not a tuning knob. Nothing bounded the page list before this: the
// sitemap said how many pages to fetch and the crawl fetched them, which on a
// large site means tens of thousands of requests at somebody else's expense.
// A site over the ceiling is not sampled silently — silence would hand back
// `graded 100%` for 0.7% of a site, which is the wrong-list failure this tool
// warns about everywhere else. It refuses and makes the sample a choice.
const MAX_CRAWL_PAGES = 2000;

// How a sample is drawn when --max-pages is below the sitemap total. It used to
// be the first N URLs in sitemap order, which on a sectioned site is the first
// section and nothing else: on a large sectioned site (2026-09-24) the first
// 2,000 URLs were the hub pages and the start of the first section, and four of
// its five sections were never fetched at all. Now:
//   - URLs are grouped by first path segment (/usc/26/61 -> /usc). Single-segment
//     pages (/about, /usc itself) share one "top level" group, so a site whose
//     posts live at /<slug>/ is one group rather than thousands of one-page ones.
//   - every group gets a floor, then the rest is split by group size;
//   - within a group, URLs are taken in order of a hash of their path, so a
//     re-run in 30 days picks the same pages and `compare` has pairs to diff.
function sectionOf(url) {
  let segs;
  try { segs = new URL(url).pathname.split("/").filter(Boolean); } catch { return "(top level)"; }
  return segs.length >= 2 ? `/${segs[0]}` : "(top level)";
}
function stableRank(url) {
  let path;
  try { const u = new URL(url); path = u.pathname + u.search; } catch { path = url; }
  return createHash("sha1").update(path).digest("hex");
}
function stratifiedSample(all, n) {
  const groups = new Map();
  for (const u of all) {
    const k = sectionOf(u);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(u);
  }
  const list = [...groups.entries()].map(([section, urls]) => ({ section, urls, take: 0 }))
    .sort((a, b) => b.urls.length - a.urls.length);
  if (list.length > n) {
    // More groups than pages to spend: one each from the largest groups.
    list.forEach((g, i) => { g.take = i < n ? 1 : 0; });
  } else {
    const floor = Math.max(1, Math.min(10, Math.floor(n / (list.length * 2))));
    for (const g of list) g.take = Math.min(g.urls.length, floor);
    let left = n - list.reduce((s, g) => s + g.take, 0);
    const cap = (g) => g.urls.length - g.take;
    const totalCap = list.reduce((s, g) => s + cap(g), 0);
    if (left > 0 && totalCap > 0) {
      const shares = list.map((g) => {
        const exact = (left * cap(g)) / totalCap;
        return { g, whole: Math.min(cap(g), Math.floor(exact)), frac: exact % 1 };
      });
      for (const s of shares) { s.g.take += s.whole; left -= s.whole; }
      for (const s of shares.sort((a, b) => b.frac - a.frac)) {
        if (left <= 0) break;
        if (cap(s.g) > 0) { s.g.take += 1; left -= 1; }
      }
    }
  }
  const urls = [];
  const strata = [];
  for (const g of list) {
    const picked = g.urls.map((u) => [stableRank(u), u]).sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(0, g.take).map(([, u]) => u);
    urls.push(...picked);
    strata.push({ section: g.section, inSitemap: g.urls.length, sampled: picked.length });
  }
  return { urls, strata };
}

async function crawlSite(base, { concurrency = 8, site = base, maxPages } = {}) {
  // robots.txt first. It was already being fetched — just after the crawl that
  // needed it — and it is where a site declares where its real sitemap lives.
  const robotsRes = await fetchWithRetry(`${base}/robots.txt`).catch(() => null);
  const robots = robotsRes && robotsRes.ok ? await robotsRes.text() : null;

  const sitemap = await discoverSitemap(base, { robotsText: robots });
  const sitemapUrls = sitemap.urls;
  // A snapshot taken against a local build must compare like-for-like with the
  // production one, so rewrite sitemap hosts onto whatever base we were given.
  const all = sitemapUrls.map((u) => (base === site ? u : u.replace(site, base)));

  // Refuse only when nobody chose a sample size. Comparing against the ceiling
  // instead (fixed 2026-09-24) refused an explicit `--max-pages 2000`, because
  // the number typed was the ceiling itself.
  if (maxPages === undefined && all.length > MAX_CRAWL_PAGES) {
    throw new Error(
      `${all.length} URLs in the sitemap, above the ${MAX_CRAWL_PAGES}-page ceiling.\n` +
      `  Re-run with --max-pages <n> to crawl a sample. The report will say it was a sample,\n` +
      `  and its findings will describe those pages rather than the site.`
    );
  }
  const sampled = maxPages !== undefined && all.length > maxPages;
  const sample = sampled ? stratifiedSample(all, maxPages) : null;
  const urls = sampled ? sample.urls : all;
  if (sampled) {
    console.log(warn(`  sampling ${urls.length} of ${all.length} sitemap URLs across ${sample.strata.length} section(s) — findings describe the sample, not the site`));
  }

  // How fast is this site willing to be read? Answering it costs one line and
  // not answering it means arriving eight-wide at a one-person site on shared
  // hosting. Sequential plus the declared pause is slow and is what was asked
  // for; an audit that degrades the site it is measuring has no defence.
  const crawlDelay = crawlDelayFor(parseRobots(robots || ""), CRAWLER_UA);
  if (crawlDelay) {
    const secs = crawlDelay * urls.length;
    const eta = secs < 90 ? `${Math.round(secs)}s` : `${Math.ceil(secs / 60)} min`;
    console.log(paint(
      `  robots.txt asks for ${crawlDelay}s between requests — dropping to 1 at a time` +
      ` (${urls.length} pages ≈ ${eta})`, C.dim));
    concurrency = 1;
  }

  // A worker pool, not lock-step batches. The old loop waited for all four
  // fetches in a batch before starting the next four, so every batch cost the
  // slowest page in it — on a site with a few slow pages that idles most of the
  // workers most of the time. Workers pull from a shared cursor instead, so a
  // slow page blocks one worker rather than the whole crawl.
  //
  // Each result is also individually guarded. crawlPage is written not to
  // throw, but "written not to throw" is what was believed before a body-stream
  // error took out a 133-page run. An unexpected throw must cost one page, not
  // the snapshot.
  const pages = new Array(urls.length);
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= urls.length) return;
      try {
        pages[i] = await crawlPage(urls[i], base, site);
      } catch (err) {
        pages[i] = { url: urls[i], error: `crawl: ${String(err.message || err)}`, fetchClass: "error" };
      }
      // After the fetch, not before, so the pause is between requests rather
      // than tacked onto the front of the run.
      if (crawlDelay) await sleep(crawlDelay * 1000);
      done += 1;
      if (done % 4 === 0 || done === urls.length) {
        process.stdout.write(`\r  crawled ${done}/${urls.length}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  process.stdout.write("\n");

  const aiCrawlers = await checkAiCrawlers(base, robots, robotsRes?.status ?? null);

  // Coverage and health are separate numbers and must never be mixed. A page
  // that failed to fetch is an UNKNOWN: it lowers how much of the site was
  // measured, and it says nothing about the site's health. Counting it as
  // "missing a title" turns "I could not look" into "your page is broken",
  // which is the single most common way an audit tool lies.
  const fetched = pages.filter((p) => !p.error);
  const failed = pages.filter((p) => p.error);

  // The inbound-link graph, built from links already collected. A page that
  // nothing links to is reachable only from the sitemap, which is the doorway
  // pattern — and it is the check that would have failed four pages every
  // on-page rule passed.
  const inbound = new Map();
  for (const page of fetched) {
    const self = normalizeLink(page.finalUrl || page.url, base);
    for (const target of page.internalTargets || []) {
      if (target === self) continue;
      if (!inbound.has(target)) inbound.set(target, new Set());
      inbound.get(target).add(self);
    }
  }
  for (const page of fetched) {
    const self = normalizeLink(page.finalUrl || page.url, base);
    // On a sample the link graph only covers the sampled pages, so a count here
    // would call nearly every page an orphan. Unknown, not zero.
    page.inboundLinks = sampled ? null : inbound.get(self)?.size ?? 0;
  }
  // De-duplicated: a sitemap URL that 301s to another sitemap URL used to list the
  // destination twice (seen 2026-09-24: 124 entries for 123 pages).
  const orphans = sampled ? null : [...new Set(fetched
    .filter((p) => p.inboundLinks === 0 && (p.finalUrl || p.url) !== base && (p.finalUrl || p.url) !== `${base}/`)
    .map((p) => p.finalUrl || p.url))];

  // The inverse of an orphan: linked from the site's own pages, absent from the
  // sitemap. The crawl only fetches sitemap URLs, so these are pages it never
  // saw — a header-nav catalog page nobody added to the sitemap (seen 2026-09-24)
  // — and the inbound graph is the only place they
  // surface. Assets and CMS plumbing are dropped; what is left is a page list.
  // Against the whole sitemap, not the sample: a page the sample skipped is
  // still in the sitemap.
  const inSitemap = new Set(all.map((u) => normalizeLink(u, base)));
  const ASSET_RE = /\.(png|jpe?g|gif|svg|webp|avif|ico|pdf|css|js|mjs|json|xml|txt|mp4|mp3|zip|woff2?)$/i;
  const linkedNotInSitemap = [...inbound.entries()]
    .filter(([t]) => t.startsWith(base) && !inSitemap.has(t) && !ASSET_RE.test(t)
      && !/\/(wp-json|feed|wp-content|wp-includes|wp-admin|wp-login\.php|cdn-cgi|_next|xmlrpc\.php)\b/.test(t)
      // Date archives and pagination are generated, not authored; a sitemap is
      // right to leave them out, so they are not a finding here either.
      && !/\/\d{4}(\/\d{2})?(\/\d{2})?\/?$/.test(t) && !/\/page\/\d+\/?$/.test(t))
    .map(([t, from]) => ({ url: t, linkedFrom: from.size }))
    .sort((a, b) => b.linkedFrom - a.linkedFrom)
    .slice(0, 100);

  // Why a page was not read, not just that it was not. A WAF challenge and a
  // dead URL both used to land in one `failed` bucket.
  const byClass = Object.fromEntries(FETCH_CLASSES.map((c) => [c, 0]));
  for (const page of pages) byClass[page.fetchClass || "error"] += 1;

  const titles = new Map();
  const descs = new Map();
  for (const p of fetched) {
    if (p.title) titles.set(p.title, (titles.get(p.title) || 0) + 1);
    if (p.description) descs.set(p.description, (descs.get(p.description) || 0) + 1);
  }

  return {
    base,
    capturedAt: new Date().toISOString(),
    sitemapUrlCount: urls.length,
    // Which sitemap was read, how it was found, and what was left unread. A
    // page count means nothing without the list it was counted from.
    sitemap: {
      roots: sitemap.roots,
      children: sitemap.children,
      notFollowed: sitemap.notFollowed,
      tried: sitemap.tried,
      // `total` is the list; `sitemapUrlCount` above is how much of it was
      // crawled. When `sampled` is true those differ, coverage grades the
      // sample, and no figure in this snapshot describes the whole site.
      total: all.length,
      sampled,
      // How the sample was drawn and how much of each section it holds. null
      // when the whole list was crawled.
      sampleMethod: sampled ? "stratified by first path segment, hash-ordered within each section" : null,
      strata: sampled ? sample.strata : null,
      crawlDelay,
    },
    robots,
    // Whether the assistants are allowed in at all. Captured with every crawl so
    // it lands in each snapshot and shows up in a diff the day it changes —
    // a site can start blocking them without anyone having decided to.
    aiCrawlers,
    // How much of the site was actually measured. Every health figure below is
    // computed over `fetched` only, and is a statement about that subset.
    coverage: {
      attempted: pages.length,
      fetched: fetched.length,
      failed: failed.length,
      failedUrls: failed.map((p) => ({ url: p.url, error: p.error })),
      pct: pages.length ? Math.round((fetched.length / pages.length) * 100) : 0,
      // 80+ is a graded report, 60-79 is provisional and must say so on every
      // figure, below 60 no summary verdict may be presented at all.
      //
      // `sampled` outranks all three, because the other grades answer "how
      // much of the list did we read" and a sample fails the question before
      // it: the list itself was cut down. 300 of 300 fetched really is 100%,
      // and printing `graded 100%` for 5% of a site is the wrong-list failure
      // this tool warns about everywhere else. Like `insufficient`, it carries
      // no site-wide verdict.
      grade: !pages.length ? "none"
        : sampled ? "sampled"
        : fetched.length / pages.length >= 0.8 ? "graded"
        : fetched.length / pages.length >= 0.6 ? "provisional"
        : "insufficient",
      // Read this before reading the grade: low coverage because the site
      // blocked the crawler is a finding about the site's edge, not about its
      // pages, and the two get opposite recommendations.
      byClass,
    },
    summary: {
      pages: fetched.length,
      errors: failed.length,
      non200: fetched.filter((p) => p.status && p.status !== 200).length,
      redirected: fetched.filter((p) => p.redirected).length,
      missingTitle: fetched.filter((p) => !p.title).length,
      missingDescription: fetched.filter((p) => !p.description).length,
      missingCanonical: fetched.filter((p) => !p.canonical).length,
      noindex: fetched.filter((p) => (p.robots || "").includes("noindex")).map((p) => p.url),
      duplicateTitles: [...titles].filter(([, n]) => n > 1).map(([t, n]) => ({ title: t, count: n })),
      duplicateDescriptions: [...descs].filter(([, n]) => n > 1).map(([d, n]) => ({ description: d, count: n })),
      // Not "too long": Google has no character limit, it truncates to the
      // width available on the reader's device. Sixty is a display estimate
      // and the field name now says exactly that much and no more.
      titleOver60Chars: fetched.filter((p) => p.titleLength > 60).map((p) => ({ url: p.url, length: p.titleLength })),
      // Same status as the title count above, for the same reason: Google says
      // there is no limit on a description's length and truncates to the device
      // width. A display estimate, never a defect. The field name says that much
      // and no more.
      descriptionOutside70to160: fetched
        .filter((p) => p.description && (p.descriptionLength < 70 || p.descriptionLength > 160))
        .map((p) => ({ url: p.url, length: p.descriptionLength })),
      // Recorded as structure, not as a defect. Google's starter guide lists it
      // among the things not to focus on — "there's no ideal number or order of
      // headings required" — so a page with two h1s is not a finding. The next
      // line is: an h1 that exists and is empty is a real one, at any count.
      multipleH1: fetched.filter((p) => p.h1Count > 1).map((p) => p.url),
      emptyH1: fetched.filter((p) => p.h1Count > 0 && p.h1.every((h) => !h)).map((p) => p.url),
      totalImagesMissingAlt: fetched.reduce((n, p) => n + (p.imagesMissingAlt || 0), 0),
      // A Person image that no page declaring it actually renders.
      // The name-search Images row draws on visible pictures, so a schema-only
      // headshot is a picture Google has little reason to attribute to the
      // person. See entityImageUrls for the incident.
      entityImagesNotShown: (() => {
        const byImage = new Map();
        for (const p of fetched) for (const e of p.entityImages || []) {
          const row = byImage.get(e.image) || { image: e.image, entity: e.name, declaredOn: 0, shownOn: 0 };
          row.declaredOn += 1;
          if (e.shownOnPage) row.shownOn += 1;
          byImage.set(e.image, row);
        }
        return [...byImage.values()].filter((r) => r.shownOn === 0);
      })(),
      totalWords: fetched.reduce((n, p) => n + (p.wordCount || 0), 0),
      // In the sitemap, reachable from no other page on the site.
      orphanPages: orphans,
      // The inverse: linked from the site's own pages, missing from the sitemap.
      // See the note above the computation.
      linkedNotInSitemap,
      // Sitemap URLs that redirect. The sitemap should list the destination,
      // not the door; each one here is a URL to remove or replace.
      sitemapRedirects: fetched
        .filter((p) => p.redirected)
        .map((p) => ({ url: p.url, to: p.finalUrl, status: p.redirectChain?.[0]?.status ?? null })),
      // Who the pages say wrote them, aggregated across the crawl. A `Person`
      // whose name is a company or an agency account (one such account was the declared
      // author of 249 posts on one site, 2026-09-24) is a finding a reader can act on. Reported, never judged here.
      authorEntities: (() => {
        const by = new Map();
        for (const p of fetched) {
          if (!p.author || !p.author.name) continue;
          const k = `${p.author.type || "?"}|${p.author.name}`;
          const row = by.get(k) || { name: p.author.name, type: p.author.type, pages: 0 };
          row.pages += 1;
          by.set(k, row);
        }
        return [...by.values()].sort((a, b) => b.pages - a.pages);
      })(),
      // Publish years from the pages' own JSON-LD (or article:published_time),
      // so ageing a section never needs a second crawl. `unknown` counts pages
      // that declare no date; that is a fact about the site, not a zero.
      publishedByYear: (() => {
        const by = {};
        for (const p of fetched) {
          const y = p.datePublished && /^\d{4}/.test(p.datePublished) ? p.datePublished.slice(0, 4) : "unknown";
          by[y] = (by[y] || 0) + 1;
        }
        return Object.fromEntries(Object.entries(by).sort(([a], [b]) => a.localeCompare(b)));
      })(),
      headerNoindex: fetched
        .filter((p) => (p.xRobotsTag || "").includes("noindex"))
        .map((p) => p.finalUrl || p.url),
      redirectChains: fetched
        .filter((p) => (p.redirectChain || []).length > 1)
        .map((p) => ({ url: p.url, hops: p.redirectChain.length })),
      // Pages carrying text that addresses an AI assistant. Candidates for a
      // human to read, never a verdict — see the note on ASSISTANT_ADDRESSED.
      assistantAddressed: fetched
        .filter((p) => (p.assistantAddressed || []).length)
        .map((p) => ({ url: p.finalUrl || p.url, snippets: p.assistantAddressed })),
    },
    pages,
  };
}

// --------------------------------------------------------- pagespeed insights

async function runPsi(url, strategy) {
  const params = new URLSearchParams({ url, strategy });
  for (const c of ["performance", "seo", "accessibility", "best-practices"]) params.append("category", c);
  const psiKey = secret("PSI_API_KEY");
  if (psiKey) params.set("key", psiKey);

  // Keyless PSI throttles hard and unpredictably. A throttled page is a gap in
  // the snapshot, never a reason to lose the rest of it, so this always returns.
  let res;
  try {
    res = await fetchWithRetry(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
      {},
      psiKey ? 3 : 5,
    );
  } catch (err) {
    return { url, strategy, error: `${err.message || err} (add PSI_API_KEY to the keychain to avoid throttling)` };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { url, strategy, error: body?.error?.message || `HTTP ${res.status}` };

  const lh = body.lighthouseResult || {};
  const audits = lh.audits || {};
  const pick = (id) => audits[id]?.numericValue ?? null;
  const field = body.loadingExperience?.metrics || {};
  const fieldOf = (k) => (field[k] ? { p75: field[k].percentile, category: field[k].category } : null);

  return {
    url, strategy,
    fetchedAt: lh.fetchTime || new Date().toISOString(),
    scores: Object.fromEntries(
      Object.entries(lh.categories || {}).map(([k, v]) => [k, v.score == null ? null : Math.round(v.score * 100)]),
    ),
    lab: {
      lcpMs: pick("largest-contentful-paint"),
      clsScore: audits["cumulative-layout-shift"]?.numericValue ?? null,
      tbtMs: pick("total-blocking-time"),
      fcpMs: pick("first-contentful-paint"),
      speedIndexMs: pick("speed-index"),
    },
    // CrUX field data is a rolling 28-day window of real visits, which is why a
    // reading taken today still mostly describes the pre-change site.
    field: {
      overall: body.loadingExperience?.overall_category || null,
      lcp: fieldOf("LARGEST_CONTENTFUL_PAINT_MS"),
      inp: fieldOf("INTERACTION_TO_NEXT_PAINT"),
      cls: fieldOf("CUMULATIVE_LAYOUT_SHIFT_SCORE"),
      ttfb: fieldOf("EXPERIMENTAL_TIME_TO_FIRST_BYTE"),
    },
    failedSeoAudits: Object.values(audits)
      .filter((a) => a.score !== null && a.score < 1 && a.id && lh.categories?.seo?.auditRefs?.some((r) => r.id === a.id))
      .map((a) => ({ id: a.id, title: a.title })),
  };
}

// ---------------------------------------------------------------------- bing

// Bing serialises dates as `/Date(1758240000000)/`. Printed raw in a report that
// is meant to tell you how old a property is, that is useless.
function bingDate(v) {
  const m = /\/Date\((\d+)\)\//.exec(String(v || ""));
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : String(v ?? "unknown");
}

async function captureBing(site) {
  const key = secret("BING_WMT_API_KEY");
  if (!key) return { skipped: "BING_WMT_API_KEY not in the keychain or environment" };
  const base = "https://ssl.bing.com/webmaster/api.svc/json";
  const siteUrl = encodeURIComponent(site);
  const out = {};

  // THE BINDING CONTROL, added 2026-09-21. Every Bing stats endpoint answers
  // HTTP 200 with an empty `d: []` when the siteUrl is not a property this key
  // can see — no error, no warning. So a typo'd domain, a property that was
  // never verified, and a verified property with genuinely no data are
  // IDENTICAL in the output. GetUserSites is the one call that must return
  // something if the key is bound to anything at all, so it is what turns an
  // empty series into evidence.
  //
  // Found on alextong.me: every endpoint returned "ok" with zero rows and the
  // snapshot recorded `failed: []`. It took a sibling property in the same
  // account returning 15 rows through the same code path to show the key and
  // the transport were fine. That control now ships instead of being improvised.
  //
  // ⚠️ Bing registers properties WITH a trailing slash ("https://alextong.me/").
  // Measured 2026-09-21: querying with and without the slash returns identical
  // results, so this does NOT normalise the URL — it only reports the exact
  // registered form, so nobody "fixes" a slash that was never the problem.
  try {
    const res = await fetchWithRetry(`${base}/GetUserSites?apikey=${key}`);
    const sites = (await res.json())?.d;
    if (Array.isArray(sites)) {
      const norm = (u) => String(u || "").replace(/\/+$/, "").toLowerCase();
      const match = sites.find((x) => norm(x.Url) === norm(site));
      out.binding = {
        siteQueried: site,
        verifiedProperties: sites.map((x) => x.Url),
        matched: Boolean(match),
        registeredAs: match?.Url ?? null,
        isVerified: match?.IsVerified ?? null,
      };
    } else {
      out.binding = { siteQueried: site, error: "GetUserSites returned no list" };
    }
  } catch (err) {
    out.binding = { siteQueried: site, error: String(err.message || err) };
  }
  // GetUrlTrafficInfo takes a `url` on TOP of `siteUrl` and 400s without it.
  // Its error says `SiteUriSchemeIsNotSupported`, which points at the scheme
  // rather than the missing argument, which is why this went unnoticed until
  // the key was first exercised on 2026-09-19. The other three take siteUrl alone.
  for (const [name, path, extra] of [
    ["rankAndTraffic", "GetRankAndTrafficStats", ""],
    ["queryStats", "GetQueryStats", ""],
    ["pageStats", "GetPageStats", ""],
    ["urlCounts", "GetUrlTrafficInfo", `&url=${siteUrl}`],
    // Sitemap submission + last-crawled date. Captured 2026-09-21 because it is
    // the cheapest proxy for HOW OLD the property is, and property age is what
    // decides whether an empty series means "broken" or "too new". Bing is not
    // retroactive: a property verified two days ago reports zero for the same
    // reason Search Console does, and no amount of debugging changes that.
    ["feeds", "GetFeeds", ""],
  ]) {
    try {
      const res = await fetchWithRetry(`${base}/${path}?apikey=${key}&siteUrl=${siteUrl}${extra}`);
      out[name] = await res.json();
    } catch (err) {
      out[name] = { error: String(err.message || err) };
    }
  }
  // Which of the endpoints actually answered. Writing a file is not the
  // same as capturing data: on 2026-09-19 all four returned
  // `{ErrorCode: 14, Message: "ERROR!!! NotAuthorized"}`, bing.json was written,
  // and the run printed a green "bing captured" — the plugin committing its own
  // "presence is not liveness" error, on camera, one line below a canary that
  // had correctly called Bing UNKNOWN.
  out.endpoints = Object.fromEntries(
    Object.entries(out)
      .filter(([k]) => k !== "endpoints" && k !== "binding")
      .map(([k, v]) => [k, v && (v.ErrorCode || v.error) ? String(v.Message || v.error) : "ok"]),
  );
  out.failed = Object.entries(out.endpoints).filter(([, v]) => v !== "ok").map(([k]) => k);

  // "ok" MEANT "the request did not error", which is not the same as "we got
  // data", and the difference is the whole reason this file exists. Separated
  // 2026-09-21 after a snapshot recorded `failed: []` for a run in which every
  // series came back empty. A reader skimming that file would reasonably
  // conclude Bing had been measured and the answer was zero. It had not been.
  const series = ["rankAndTraffic", "queryStats", "pageStats"];
  out.empty = series.filter((k) => Array.isArray(out[k]?.d) && out[k].d.length === 0);
  out.dataStatus =
    out.failed.length ? "error"
    : out.binding && out.binding.matched === false ? "not-a-verified-property"
    : out.empty.length === series.length ? "authorised-but-no-data"
    : "ok";
  // A one-line verdict so nobody has to reconstruct the above from raw JSON.
  out.readAs = {
    error: "Bing FAILED. Do not read any zero below as a measurement.",
    "not-a-verified-property":
      "The key works but is NOT bound to this siteUrl, so every zero below is an artifact. "
      + "Check `binding.verifiedProperties` for the exact registered form.",
    "authorised-but-no-data":
      "Property is verified and the transport is fine; Bing simply holds no rows for this window. "
      + "Usually means the property is too NEW (Bing is not retroactive) — check `feeds` for the "
      + "sitemap submission date. This is UNAVAILABLE, never zero.",
    ok: "Bing returned real rows.",
  }[out.dataStatus];
  return out;
}

// ------------------------------------------------------------------- capture

async function capture(cfg, flags) {
  const site = requireSite(cfg);
  const label = flags.label || "snapshot";
  const until = flags.until && flags.until !== true ? flags.until : iso(new Date());
  const days = Number(flags.days || 90);
  const from = flags.from && flags.from !== true ? flags.from : daysAgo(days, until);
  const base = flags.base && flags.base !== true ? flags.base : site;
  const skip = String(flags.skip || "").split(",").map((s) => s.trim()).filter(Boolean);
  // Named for the end of the window, not for today, so a backfilled snapshot
  // (--until 2026-09-17) files itself under the date it actually describes.
  const dir = join(cfg.snapRoot, `${until}-${label}`);
  mkdirSync(dir, { recursive: true });

  const manifest = {
    label,
    capturedAt: new Date().toISOString(),
    window: { from, until },
    site,
    base,
    tool: "seo-audit/seo.mjs",
    // If the config names the commit the changes started from, it travels with
    // the snapshot, so a later reader knows exactly what "before" meant without
    // re-deriving it from the log.
    changeBoundary: cfg.changeBoundary || null,
    captured: [],
    skipped: [],
  };

  console.log(paint(`\nSEO snapshot: ${label}`, C.bold));
  console.log(`  window ${from} .. ${until}`);
  console.log(`  into   ${dir}\n`);

  // --- Search Console -------------------------------------------------------
  if (!skip.includes("gsc")) {
    if (!haveKeyFile(cfg)) {
      console.log(warn("  gsc        locked — no service-account key. `node seo.mjs doctor` walks through it."));
      manifest.skipped.push({ source: "gsc", reason: `no key at ${cfg.keyFile}` });
    } else if (!cfg.properties.length) {
      console.log(warn("  gsc        locked — no searchConsole.properties in the config"));
      manifest.skipped.push({ source: "gsc", reason: "no properties configured" });
    } else {
      for (const property of cfg.properties) {
        const slug = property.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "");
        console.log(`  gsc        ${property}`);
        const cuts = {
          daily: ["date"],
          queries: ["query"],
          pages: ["page"],
          queryByPage: ["query", "page"],
          countries: ["country"],
          devices: ["device"],
          appearance: ["searchAppearance"],
        };
        const result = { property, window: { from, until }, cuts: {} };
        for (const [name, dimensions] of Object.entries(cuts)) {
          try {
            const rows = await searchAnalytics(cfg, property, {
              startDate: from, endDate: until, dimensions,
            });
            result.cuts[name] = rows.map((r) => ({
              keys: r.keys,
              clicks: r.clicks,
              impressions: r.impressions,
              ctr: r.ctr,
              position: r.position,
            }));
            console.log(`    ${name.padEnd(12)} ${ok(String(rows.length).padStart(5))} rows`);
          } catch (err) {
            result.cuts[name] = { error: String(err.message || err) };
            console.log(`    ${name.padEnd(12)} ${bad(String(err.message || err))}`);
          }
        }
        result.totals = totalsOf(result.cuts.daily);
        writeJSON(join(dir, "gsc", `${slug}.json`), result);
        manifest.captured.push(`gsc/${slug}.json`);
      }
    }
  } else manifest.skipped.push({ source: "gsc", reason: "--skip" });

  // --- URL inspection -------------------------------------------------------
  if (!skip.includes("inspection") && haveKeyFile(cfg) && cfg.properties.length) {
    console.log(`  inspect    every sitemap URL`);
    try {
      const urls = await fetchSitemapUrls(base);
      const property = cfg.properties[0];
      const results = [];
      for (const url of urls) {
        try {
          const r = await inspectUrl(cfg, property, url.replace(base, site));
          const idx = r.indexStatusResult || {};
          results.push({
            url,
            verdict: idx.verdict || null,
            coverageState: idx.coverageState || null,
            robotsTxtState: idx.robotsTxtState || null,
            indexingState: idx.indexingState || null,
            googleCanonical: idx.googleCanonical || null,
            userCanonical: idx.userCanonical || null,
            lastCrawlTime: idx.lastCrawlTime || null,
            crawledAs: idx.crawledAs || null,
            sitemaps: idx.sitemap || [],
            referringUrls: idx.referringUrls || [],
            richResults: r.richResultsResult?.verdict || null,
            mobileUsability: r.mobileUsabilityResult?.verdict || null,
          });
          process.stdout.write(`\r    ${results.length}/${urls.length}`);
        } catch (err) {
          results.push({ url, error: String(err.message || err) });
        }
        await sleep(250); // stay well inside the 600/min quota
      }
      process.stdout.write("\n");
      const indexed = results.filter((r) => r.coverageState?.startsWith("Submitted and indexed") || r.verdict === "PASS").length;
      console.log(`    ${ok(`${indexed}/${results.length}`)} pass URL inspection`);
      writeJSON(join(dir, "inspection", "sitemap-urls.json"), {
        property, capturedAt: new Date().toISOString(),
        summary: { total: results.length, passing: indexed },
        results,
      });
      manifest.captured.push("inspection/sitemap-urls.json");
    } catch (err) {
      console.log(bad(`    ${err.message || err}`));
      manifest.skipped.push({ source: "inspection", reason: String(err.message || err) });
    }
  } else if (skip.includes("inspection")) {
    manifest.skipped.push({ source: "inspection", reason: "--skip" });
  } else {
    manifest.skipped.push({ source: "inspection", reason: "Search Console not connected" });
  }

  // --- on-page crawl --------------------------------------------------------
  if (!skip.includes("onpage")) {
    console.log(`  onpage     crawling ${base}`);
    try {
      const crawl = await crawlSite(base, { site, ...concurrencyOf(flags) });
      writeJSON(join(dir, "onpage.json"), crawl);
      manifest.captured.push("onpage.json");
      manifest.coverage = crawl.coverage;
      // On a sample the headline number is the one thing a reader takes away,
      // so it says so here rather than only in a notice further up the scroll.
      const scope = crawl.sitemap.sampled
        ? warn(`sample of ${crawl.coverage.attempted} from ${crawl.sitemap.total} — no site-wide verdict`)
        : `${crawl.coverage.pct}% of ${crawl.coverage.attempted} fetched, ${crawl.coverage.grade}`;
      console.log(
        `    ${ok(`${crawl.summary.pages} pages`)} ` +
        `(${scope}), ` +
        `${crawl.summary.missingDescription} missing description, ` +
        `${crawl.summary.duplicateTitles.length} duplicate titles`,
      );
      reportAiCrawlers(crawl.aiCrawlers);
    } catch (err) {
      console.log(bad(`    ${err.message || err}`));
      manifest.skipped.push({ source: "onpage", reason: String(err.message || err) });
    }
  } else manifest.skipped.push({ source: "onpage", reason: "--skip" });

  // --- pagespeed ------------------------------------------------------------
  if (!skip.includes("psi")) {
    const configured = (flags.psiUrls && flags.psiUrls !== true
      ? String(flags.psiUrls).split(",")
      : cfg.psi.urls.length ? cfg.psi.urls : ["/"])
      .map((u) => (/^https?:/i.test(u) ? u : `${site}${u.startsWith("/") ? "" : "/"}${u}`));
    // Keyless PageSpeed is throttled hard and unpredictably. Rather than spend
    // two minutes collecting gaps on the first run, take one reading and say so.
    const hasKey = Boolean(secret("PSI_API_KEY"));
    const targets = hasKey ? configured : configured.slice(0, 1);
    const strategies = hasKey ? ["mobile", "desktop"] : ["mobile"];
    if (!hasKey && (configured.length > 1 || targets.length < configured.length)) {
      console.log(warn(`  psi        no PSI_API_KEY — capped at ${targets.length} url, mobile only`));
      manifest.skipped.push({
        source: "psi",
        reason: `no PSI_API_KEY; captured ${targets.length}/${configured.length} urls, mobile only`,
      });
    }
    console.log(`  psi        ${targets.length} url(s) x ${strategies.length} strateg${strategies.length > 1 ? "ies" : "y"}`);
    // Each PSI call is a real Lighthouse run on Google's side and takes 20-30
    // seconds, so the wall-clock here is dominated by waiting, not by work. Run
    // them in a small pool instead of strictly one after another: a keyed
    // project gets 240 queries/minute, and two concurrent runs are nowhere near
    // it. Keyless stays at one in flight, because there the throttling *is* the
    // constraint and going wider collects gaps faster, not data faster.
    //
    // The stagger also stops being paid after the final run. It used to sleep
    // once more on the way out, which bought nothing and simply made every
    // snapshot longer.
    const jobs = targets.flatMap((url) => strategies.map((strategy) => ({ url, strategy })));
    const psiPool = hasKey ? 2 : 1;
    const runs = new Array(jobs.length);
    let psiCursor = 0;
    const psiWorker = async (slot) => {
      // Offset each worker's start so two Lighthouse runs do not land on the
      // same instant; after that the pool self-staggers naturally.
      if (slot) await sleep(hasKey ? 1200 : 6000);
      for (;;) {
        const i = psiCursor++;
        if (i >= jobs.length) return;
        const { url, strategy } = jobs[i];
        const r = await runPsi(url, strategy);
        runs[i] = r;
        const s = r.scores ? `perf ${r.scores.performance} seo ${r.scores.seo}` : bad(r.error);
        console.log(`    ${strategy.padEnd(8)} ${(url.replace(site, "") || "/").padEnd(34)} ${s}`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(psiPool, jobs.length) }, (_, slot) => psiWorker(slot)));
    writeJSON(join(dir, "psi", "runs.json"), { capturedAt: new Date().toISOString(), runs });
    manifest.captured.push("psi/runs.json");
  } else manifest.skipped.push({ source: "psi", reason: "--skip" });

  // --- bing -----------------------------------------------------------------
  if (!skip.includes("bing") && cfg.bing.enabled !== false) {
    const bing = await captureBing(site);
    writeJSON(join(dir, "bing.json"), bing);
    if (bing.skipped) {
      console.log(warn(`  bing       skipped (${bing.skipped})`));
      manifest.skipped.push({ source: "bing", reason: bing.skipped });
    } else if (bing.failed?.length && bing.failed.length === Object.keys(bing.endpoints).length) {
      // Every endpoint refused. The file exists and holds nothing usable, so it
      // is a gap in coverage, never a zero — and the manifest has to say so,
      // because a later compare reads the manifest, not the console.
      const why = bing.endpoints.rankAndTraffic;
      const n = bing.failed.length;
      console.log(warn(`  bing       unavailable — all ${n} endpoints refused (${why})`));
      manifest.skipped.push({ source: "bing", reason: `all ${n} endpoints refused: ${why}` });
      manifest.captured.push("bing.json");
    } else if (bing.failed?.length) {
      const n = Object.keys(bing.endpoints).length;
      console.log(warn(`  bing       partial — ${n - bing.failed.length}/${n} endpoints (failed: ${bing.failed.join(", ")})`));
      manifest.captured.push("bing.json");
    } else {
      const n = Object.keys(bing.endpoints).length;
      console.log(ok(`  bing       captured (${n}/${n} endpoints)`));
      manifest.captured.push("bing.json");
    }
  }

  // A baseline without its crawl is not a baseline. On 2026-09-24 the crawl
  // refused a sitemap far over the ceiling, psi and bing still ran, and the run ended on
  // a green "Snapshot written" over a folder with no onpage.json in it. Say it
  // in the manifest (compare reads that, not the console) and in the last line.
  const onpageFailed = manifest.skipped.find((s) => s.source === "onpage" && s.reason !== "--skip");
  manifest.complete = !onpageFailed;
  writeJSON(join(dir, "manifest.json"), manifest);
  if (onpageFailed) {
    console.log(`\n${bad("Snapshot INCOMPLETE — no on-page crawl")} → ${dir}`);
    console.log(bad(`  ${onpageFailed.reason.split("\n")[0]}`));
    console.log(warn(`  Fix that and re-run with the same --label; the folder is overwritten.\n`));
    process.exitCode = 1;
  } else {
    console.log(`\n${ok("Snapshot written")} → ${dir}\n`);
  }
  return dir;
}

function totalsOf(dailyRows) {
  if (!Array.isArray(dailyRows)) return null;
  const clicks = dailyRows.reduce((n, r) => n + (r.clicks || 0), 0);
  const impressions = dailyRows.reduce((n, r) => n + (r.impressions || 0), 0);
  const weighted = dailyRows.reduce((n, r) => n + (r.position || 0) * (r.impressions || 0), 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weighted / impressions : null,
    days: dailyRows.length,
  };
}

// ------------------------------------------------------------------- compare

// An exact label always wins. Substring matching is a convenience, and it used
// to take the LAST match after sorting — so `2026-09-17-pre-change` silently
// resolved to `2026-09-17-pre-change-28d`, a snapshot with no onpage.json, and
// the comparison quietly skipped every on-page section. It printed the name it
// substituted and never errored. An ambiguous label is now a question, not a
// guess: the caller gets told which snapshots matched.
function findSnapshot(root, label) {
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();

  if (dirs.includes(label)) return join(root, label);

  const matches = dirs.filter((d) => d.includes(label));
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous snapshot label "${label}" — matches ${matches.length}:\n  ${matches.join("\n  ")}\n` +
      `Pass one of them exactly.`,
    );
  }
  return matches.length ? join(root, matches[0]) : null;
}

function readIf(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function delta(a, b, { digits = 0, invert = false } = {}) {
  if (a == null || b == null) return paint("—", C.dim);
  const d = b - a;
  const s = `${d > 0 ? "+" : ""}${d.toFixed(digits)}`;
  if (Math.abs(d) < Number(`1e-${digits + 1}`)) return paint(s, C.dim);
  const good = invert ? d < 0 : d > 0;
  return paint(s, good ? C.green : C.red);
}

// Changes on Google's side that moved Search Console numbers for nearly every
// site at once. A compare whose windows sit on both sides of one is measuring
// Google, not the site. Add to this list; never remove from it, because old
// snapshots keep getting compared.
const GOOGLE_REPORTING_EVENTS = [
  {
    date: "2025-09-10",
    what: "Google stopped honouring the &num=100 results parameter (reported between "
      + "2025-09-10 and 09-12). Impressions and average position fell for most sites "
      + "while clicks held, because rank trackers' deep-page views stopped counting. "
      + "Compare clicks across it, not impressions or position.",
  },
];

function compare(cfg, labelA, labelB) {
  const root = cfg.snapRoot;
  const dirA = findSnapshot(root, labelA);
  const dirB = findSnapshot(root, labelB);
  if (!dirA || !dirB) {
    console.error(bad(`Could not find snapshots for "${labelA}" and "${labelB}".`));
    console.error(`Available: ${existsSync(root) ? readdirSync(root).join(", ") : "none"}`);
    process.exit(1);
  }
  const lines = [];
  const say = (s = "") => { console.log(s); lines.push(s.replace(/\x1b\[[0-9;]*m/g, "")); };

  const mA = readIf(join(dirA, "manifest.json"));
  const mB = readIf(join(dirB, "manifest.json"));
  say(paint(`\nSEO snapshot comparison`, C.bold));
  say(`  A  ${mA?.label} — window ${mA?.window.from} .. ${mA?.window.until}`);
  say(`  B  ${mB?.label} — window ${mB?.window.from} .. ${mB?.window.until}\n`);

  // Two snapshots taken with different tool versions or against different
  // hosts are not a measurement of the site. Say so rather than diffing them.
  if (mA?.base && mB?.base && mA.base !== mB.base) {
    say(warn(`  ⚠ different crawl bases: ${mA.base} vs ${mB.base} — on-page diffs below compare two different servers`));
  }
  for (const [label, m] of [["A", mA], ["B", mB]]) {
    if (m?.coverage && m.coverage.grade !== "graded") {
      say(warn(`  ⚠ snapshot ${label} measured only ${m.coverage.pct}% of its pages (${m.coverage.grade}) — every on-page delta below is provisional`));
    }
  }
  if (mA?.skipped?.length || mB?.skipped?.length) {
    const names = [...new Set([...(mA?.skipped || []), ...(mB?.skipped || [])].map((x) => x.source))];
    say(paint(`  sources missing from one or both snapshots: ${names.join(", ")}`, C.dim));
  }
  // Totals from windows of different lengths are not comparable, and nothing
  // below can fix that after the fact. Say it before any number is printed.
  const days = (m) => m?.window?.from && m?.window?.until
    ? Math.round((Date.parse(m.window.until) - Date.parse(m.window.from)) / 86400000) + 1
    : null;
  const [daysA, daysB] = [days(mA), days(mB)];
  const sameLength = daysA != null && daysB != null && Math.abs(daysA - daysB) <= Math.max(1, 0.1 * Math.max(daysA, daysB));
  if (daysA != null && daysB != null && !sameLength) {
    say(warn(`  ⚠ the windows are different lengths (${daysA} vs ${daysB} days): compare clicks per day, not the totals below`));
  }
  const spanFrom = [mA?.window?.from, mB?.window?.from].filter(Boolean).sort()[0];
  const spanUntil = [mA?.window?.until, mB?.window?.until].filter(Boolean).sort().at(-1);
  for (const ev of GOOGLE_REPORTING_EVENTS) {
    if (spanFrom && spanUntil && spanFrom < ev.date && ev.date <= spanUntil) {
      say(warn(`  ⚠ these windows span ${ev.date}, a change on Google's side: ${ev.what}`));
    }
  }
  say("");

  // Search Console totals
  const properties = cfg.properties.length
    ? cfg.properties
    // A compare must still work when it is run without a config — read the
    // property names out of the snapshots themselves.
    : [...new Set([mA, mB].flatMap((m) => (m?.captured || [])
        .filter((f) => f.startsWith("gsc/"))
        .map((f) => f.slice(4, -5))))];
  for (const property of properties) {
    const slug = property.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "");
    const a = readIf(join(dirA, "gsc", `${slug}.json`));
    const b = readIf(join(dirB, "gsc", `${slug}.json`));
    if (!a || !b) continue;
    say(paint(`Search Console — ${property}`, C.cyan));
    const ta = a.totals, tb = b.totals;
    if (ta && tb) {
      say(`  clicks        ${String(ta.clicks).padStart(7)} → ${String(tb.clicks).padStart(7)}   ${delta(ta.clicks, tb.clicks)}`);
      // Chance alone moves a count of N by about ±2√N. Real traffic is burstier
      // than that (weekdays, one shared link), so this is the LEAST a move has to
      // clear before it is a change, not proof that a bigger one is. On a site
      // with 100 clicks a month it is ±20%, which is why a small site's 30-day
      // compare usually shows no change even when the fix landed.
      if (ta.clicks > 0 && sameLength) {
        const band = Math.round(2 * Math.sqrt(ta.clicks));
        const inside = Math.abs(tb.clicks - ta.clicks) <= band;
        say(paint(`  chance alone  ±${band} clicks (2√${ta.clicks}); ${inside ? "this move is inside it: no measurable change yet" : "this move is outside it"}`, C.dim));
      }
      say(`  impressions   ${String(ta.impressions).padStart(7)} → ${String(tb.impressions).padStart(7)}   ${delta(ta.impressions, tb.impressions)}`);
      say(`  ctr           ${(ta.ctr * 100).toFixed(2).padStart(6)}% → ${(tb.ctr * 100).toFixed(2).padStart(6)}%   ${delta(ta.ctr * 100, tb.ctr * 100, { digits: 2 })}`);
      say(`  avg position  ${ta.position?.toFixed(2).padStart(7)} → ${tb.position?.toFixed(2).padStart(7)}   ${delta(ta.position, tb.position, { digits: 2, invert: true })} ${paint("(lower is better)", C.dim)}`);
    }

    // Per-query movement, ranked by impression volume in the later snapshot.
    const mapOf = (snap) => new Map((snap.cuts.queries || []).map((r) => [r.keys[0], r]));
    const qa = mapOf(a), qb = mapOf(b);
    const keys = [...new Set([...qa.keys(), ...qb.keys()])]
      .sort((x, y) => (qb.get(y)?.impressions || 0) - (qb.get(x)?.impressions || 0))
      .slice(0, 20);
    say(`\n  ${"query".padEnd(38)} ${"impr".padStart(12)}  ${"position".padStart(16)}`);
    for (const k of keys) {
      const x = qa.get(k), y = qb.get(k);
      const impr = `${String(x?.impressions ?? "–").padStart(5)} → ${String(y?.impressions ?? "–").padStart(5)}`;
      const pos = `${(x?.position?.toFixed(1) ?? "–").padStart(5)} → ${(y?.position?.toFixed(1) ?? "–").padStart(5)}`;
      const move = x && y ? delta(x.position, y.position, { digits: 1, invert: true }) : paint(y && !x ? "new" : "gone", C.dim);
      say(`  ${k.slice(0, 38).padEnd(38)} ${impr}  ${pos} ${move}`);
    }
    say("");
  }

  // Indexation
  const iA = readIf(join(dirA, "inspection", "sitemap-urls.json"));
  const iB = readIf(join(dirB, "inspection", "sitemap-urls.json"));
  if (iA && iB) {
    say(paint("Indexation (URL Inspection)", C.cyan));
    say(`  passing       ${String(iA.summary.passing).padStart(7)} → ${String(iB.summary.passing).padStart(7)}   ${delta(iA.summary.passing, iB.summary.passing)}`);
    const stateA = new Map(iA.results.map((r) => [r.url, r.coverageState]));
    for (const r of iB.results) {
      const before = stateA.get(r.url);
      if (before !== r.coverageState) say(`  ${paint("changed", C.yellow)} ${r.url}\n      ${before || "—"} → ${r.coverageState || "—"}`);
    }
    say("");
  }

  // On-page
  const oA = readIf(join(dirA, "onpage.json"));
  const oB = readIf(join(dirB, "onpage.json"));
  if (oA && oB) {
    say(paint("On-page", C.cyan));
    const rows = [
      ["pages in sitemap", oA.sitemapUrlCount, oB.sitemapUrlCount, false],
      ["missing description", oA.summary.missingDescription, oB.summary.missingDescription, true],
      ["duplicate titles", oA.summary.duplicateTitles.length, oB.summary.duplicateTitles.length, true],
      ["images missing alt", oA.summary.totalImagesMissingAlt, oB.summary.totalImagesMissingAlt, true],
      ["total words", oA.summary.totalWords, oB.summary.totalWords, false],
    ];
    for (const [name, x, y, invert] of rows) {
      say(`  ${name.padEnd(22)} ${String(x).padStart(7)} → ${String(y).padStart(7)}   ${delta(x, y, { invert })}`);
    }
    // Per-URL drift. A total that moved tells you something changed; it does
    // not tell you which page broke, and the page that broke is the whole
    // reason for keeping a baseline. Each rule names one transition and what
    // it costs, so the reader is not left diffing two numbers by eye.
    // Two samples are two lists, not one site at two dates. A page in one sample
    // and not the other says nothing about whether it still exists, so on a
    // sample only the pages both snapshots hold are diffed.
    const eitherSampled = Boolean(oA.sitemap?.sampled || oB.sitemap?.sampled);
    if (eitherSampled) say(warn("  sampled snapshot: totals describe the samples; per-URL rules run only on pages in both"));
    const byUrlA = new Map(oA.pages.map((p) => [p.url.replace(oA.base, ""), p]));
    const seenB = new Set();
    const findings = [];
    const add = (sev, rule, key, detail) => findings.push({ sev, rule, key: key || "/", detail });
    const noindexed = (p) => `${p.robots || ""} ${p.xRobotsTag || ""}`.includes("noindex");
    const types = (p) => new Set(p.jsonLdTypes || []);

    for (const p of oB.pages) {
      const key = p.url.replace(oB.base, "");
      seenB.add(key);
      const a = byUrlA.get(key);
      if (!a) { if (!eitherSampled) add("info", "page added", key); continue; }
      if (a.error || p.error) continue; // a page we could not read is not a page that changed

      if (a.status === 200 && p.status !== 200) add("critical", "status regressed", key, `${a.status} → ${p.status}`);
      if (!noindexed(a) && noindexed(p)) add("critical", "noindex added", key, p.xRobotsTag ? "via X-Robots-Tag" : "via meta robots");
      if (a.canonical && !p.canonical) add("critical", "canonical removed", key);
      else if (a.canonical && p.canonical && a.canonical !== p.canonical) add("warning", "canonical changed", key, `${a.canonical} → ${p.canonical}`);
      if (a.h1Count > 0 && a.h1.some(Boolean) && (p.h1Count === 0 || !p.h1.some(Boolean))) add("critical", "h1 removed", key);
      if (a.title && !p.title) add("critical", "title removed", key);
      if (a.og?.image && !p.og?.image) add("warning", "og:image removed", key);

      const lost = [...types(a)].filter((t) => !types(p).has(t));
      if (lost.length) add("warning", "schema type removed", key, lost.join(", "));

      if ((a.inboundLinks ?? null) !== null && a.inboundLinks > 0 && p.inboundLinks === 0) {
        add("warning", "became orphan", key, "nothing on the site links here any more");
      }
      if (a.title && p.title && a.title !== p.title) add("info", "title changed", key, `${a.title} → ${p.title}`);
      if (a.description && p.description && a.description !== p.description) add("info", "description changed", key);
    }
    if (!eitherSampled) for (const [key] of byUrlA) if (!seenB.has(key)) add("critical", "page gone", key, "in the earlier sitemap, absent now");

    if (findings.length) {
      const order = { critical: 0, warning: 1, info: 2 };
      const colour = { critical: C.red, warning: C.yellow, info: C.dim };
      findings.sort((x, y) => order[x.sev] - order[y.sev] || x.rule.localeCompare(y.rule));
      say("");
      for (const f of findings.slice(0, 40)) {
        say(`  ${paint(f.rule.padEnd(20), colour[f.sev])} ${f.key}${f.detail ? paint(`  ${f.detail}`, C.dim) : ""}`);
      }
      if (findings.length > 40) say(paint(`  …and ${findings.length - 40} more`, C.dim));
      const crit = findings.filter((f) => f.sev === "critical").length;
      say(crit
        ? bad(`  ${crit} regression${crit === 1 ? "" : "s"} that can cost indexing — fix these first`)
        : ok("  no indexing-critical regressions"));
    } else {
      say(`  ${paint("no per-page changes", C.dim)}`);
    }
    const sameA = new Set(oA.pages.flatMap((p) => p.sameAs));
    const sameB = new Set(oB.pages.flatMap((p) => p.sameAs));
    const added = [...sameB].filter((x) => !sameA.has(x));
    const removed = [...sameA].filter((x) => !sameB.has(x));
    if (added.length) say(`  ${paint("sameAs added", C.green)}   ${added.join(", ")}`);
    if (removed.length) say(`  ${paint("sameAs removed", C.red)} ${removed.join(", ")}`);

    // A snapshot older than this check has no aiCrawlers block. Say that
    // plainly rather than printing "no change" — an absent field and an
    // unchanged one are different facts.
    if (!oA.aiCrawlers || !oB.aiCrawlers) {
      say(`  ${paint("ai crawlers", C.dim)} ${paint("not captured in both snapshots — no comparison", C.dim)}`);
    } else {
      const states = (o) => Object.fromEntries(Object.entries(o.aiCrawlers.bots || {}).map(([k, v]) => [k, v.state]));
      const a = states(oA), b = states(oB);
      const changed = Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
      if (changed.length) {
        for (const k of changed) say(`  ${paint("ai crawler", C.red)} ${k} ${a[k] ?? "—"} → ${b[k] ?? "—"}`);
      } else {
        say(`  ${paint("ai crawlers", C.dim)} ${oB.aiCrawlers.verdict === "allowed" ? ok("unchanged, allowed") : warn(`unchanged, ${oB.aiCrawlers.verdict}`)}`);
      }
    }
    say("");
  }

  // PageSpeed
  const pA = readIf(join(dirA, "psi", "runs.json"));
  const pB = readIf(join(dirB, "psi", "runs.json"));
  if (pA && pB) {
    say(paint("PageSpeed", C.cyan));
    const key = (r) => `${r.url}|${r.strategy}`;
    const mapB = new Map(pB.runs.map((r) => [key(r), r]));
    for (const a of pA.runs) {
      const b = mapB.get(key(a));
      if (!b || !a.scores || !b.scores) continue;
      say(`  ${a.strategy.padEnd(8)} ${(a.url.replace(mB?.site || "", "") || "/").padEnd(34)} ` +
        `perf ${String(a.scores.performance).padStart(3)} → ${String(b.scores.performance).padStart(3)} ${delta(a.scores.performance, b.scores.performance)}  ` +
        `seo ${String(a.scores.seo).padStart(3)} → ${String(b.scores.seo).padStart(3)} ${delta(a.scores.seo, b.scores.seo)}`);
    }
    say("");
  }

  const out = join(root, `compare-${mA?.label}-vs-${mB?.label}.txt`);
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(paint(`Report saved → ${out}\n`, C.dim));
}

// ---------------------------------------------------------------------- init
//
// The config is written by looking, not by asking. Every field this can infer
// from the filesystem is inferred, and the user only ever confirms the rest.

function guessSite(dir) {
  // A site URL is usually already written down somewhere in the project.
  const tries = [
    ["package.json", (t) => JSON.parse(t).homepage],
    ["site.config.json", (t) => JSON.parse(t).url || JSON.parse(t).site],
    ["astro.config.mjs", (t) => t.match(/site\s*:\s*["'`]([^"'`]+)/)?.[1]],
    ["next.config.js", (t) => t.match(/siteUrl\s*:\s*["'`]([^"'`]+)/)?.[1]],
    ["next-sitemap.config.js", (t) => t.match(/siteUrl\s*:\s*["'`]([^"'`]+)/)?.[1]],
    ["gatsby-config.js", (t) => t.match(/siteUrl\s*:\s*["'`]([^"'`]+)/)?.[1]],
    ["public/CNAME", (t) => `https://${t.trim()}`],
  ];
  for (const [file, extract] of tries) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    try {
      const value = extract(readFileSync(path, "utf8"));
      if (value && /^https?:\/\//.test(value)) return { site: value.replace(/\/+$/, ""), from: file };
    } catch { /* an unparseable config is not a site; keep looking */ }
  }
  return null;
}

function init(cfg, flags) {
  const cwd = process.cwd();
  const guessed = guessSite(cwd);
  const site = (flags.site && flags.site !== true ? String(flags.site).replace(/\/+$/, "") : guessed?.site) || null;

  // A config in the working directory is right when the working directory is
  // the project, and litter when it is not. No code here means the site is on
  // a platform, so everything for it — config and snapshots — goes in one
  // folder under ~/seo-audits/<host>/. `--here` forces the current directory.
  const inProject = Boolean(flags.here) || looksLikeProject(cwd) || existsSync(join(cwd, CONFIG_NAME));
  if (!inProject && !site) {
    throw new Error(
      `No project in ${cwd} and no site to name a folder after.\n` +
      `Pass --site https://example.com (no code project is needed — a URL is enough), ` +
      `or --here to write ${CONFIG_NAME} in this directory anyway.`,
    );
  }
  const dir = inProject ? cwd : auditHomeFor(site);
  const target = join(dir, CONFIG_NAME);

  if (existsSync(target) && !flags.force) {
    console.log(warn(`\n${target} already exists. Pass --force to overwrite it.\n`));
    return;
  }
  mkdirSync(dir, { recursive: true });

  const out = {
    site,
    searchConsole: {
      // Both property kinds are worth keeping: a domain property sees every
      // subdomain and protocol, a URL-prefix property usually holds the longer
      // history. `doctor` prints the exact strings once a key is in place.
      properties: site ? [`sc-domain:${site.replace(/^https?:\/\//, "").replace(/^www\./, "")}`, `${site}/`] : [],
      keyFile: "~/.config/seo-audit/gsc-service-account.json",
    },
    snapshotDir: "seo-snapshots",
    psi: { urls: ["/"] },
    bing: { enabled: true },
    changeBoundary: null,
  };
  writeFileSync(target, JSON.stringify(out, null, 2) + "\n");

  console.log(paint(`\nWrote ${target}`, C.bold));
  if (guessed && !flags.site) console.log(`  site       ${ok(site)} ${paint(`(read from ${guessed.from})`, C.dim)}`);
  else if (site) console.log(`  site       ${ok(site)}`);
  else console.log(`  site       ${bad("not found")} — set it by hand, or re-run with --site https://example.com`);
  console.log(`  snapshots  ${join(dir, out.snapshotDir)}/`);
  if (!inProject) {
    console.log(paint(`
  No code project here, which is the normal case: a Squarespace, Wix, Shopify
  or hosted-WordPress site is audited over HTTP and there is nothing to check
  out. Everything for this site lives in ${dir} and the
  other commands find it from anywhere. Use --here to keep it in this folder
  instead.`, C.dim));
  }
  console.log(`
  Nothing above needs a credential. Next:
    node seo.mjs robots     which AI crawlers can read this site
    node seo.mjs capture --label baseline
`);
}

// -------------------------------------------------------------------- robots
//
// The AI-crawler check, on its own, because it needs no credentials, takes one
// request, and is the finding most often missing from an audit entirely.

// Which bot governs which claim. Getting this wrong is the difference between
// a correct audit and a confidently wrong one: GPTBot is training, and blocking
// it says nothing about whether ChatGPT Search can cite the site — that is
// OAI-SearchBot. The same split exists for Anthropic and for Google.
const CLAIM_MAP = [
  ["Can ChatGPT cite this site in Search?", "OAI-SearchBot"],
  ["Can ChatGPT fetch a link a user pasted?", "ChatGPT-User"],
  ["Is this site in OpenAI's training corpus?", "GPTBot"],
  ["Can Claude cite this site in Search?", "Claude-SearchBot"],
  ["Can Claude fetch a link a user pasted?", "Claude-User"],
  ["Is this site in Anthropic's training corpus?", "ClaudeBot"],
  ["Can Perplexity cite this site?", "PerplexityBot"],
  ["Can Google use this site in AI Overviews / Gemini?", "Google-Extended"],
];

async function robots(cfg, flags) {
  const site = requireSite(cfg);
  console.log(paint(`\nAI crawler access — ${site}\n`, C.bold));

  const res = await fetchWithRetry(`${site}/robots.txt`).catch(() => null);
  const text = res && res.ok ? await res.text() : null;
  const ai = await checkAiCrawlers(site, text, res?.status ?? null);
  reportAiCrawlers(ai);

  if (ai.verdict !== "unknown") {
    console.log(paint("\nWhat each answer actually means", C.cyan));
    for (const [claim, bot] of CLAIM_MAP) {
      const entry = ai.bots[bot] || {};
      // A `Disallow: /api/` is not an answer to "can this site be cited". Say
      // which paths are closed rather than downgrading the whole answer — an
      // audit that cries partial at every site teaches the reader to ignore it.
      //
      // But `Disallow: /` with a carve-out is the opposite case and the answer
      // there is not yes. It is "only this one path", and it is closer to no.
      const label = entry.state === "blocked" ? bad("no")
        : entry.closed ? bad(`only ${entry.allowPaths.join(" ")}`)
        : ok("yes");
      const except = entry.state === "partial" && entry.paths?.length
        ? paint(`  except ${entry.paths.join(" ")}`, C.dim)
        : "";
      console.log(`  ${padVisible(label, 18)} ${claim} ${paint(`(${bot})`, C.dim)}${except}`);
    }
  }

  // robots.txt states an intention; an edge rule can contradict it silently.
  // Reporting is the whole job here — some owners block these bots on purpose,
  // and changing that without asking makes a policy decision on their behalf.
  console.log(paint(`
  This reports; it never changes anything. If a bot is blocked and you meant to
  block it, that is a decision, not a finding.
`, C.dim));

  if (flags.out && flags.out !== true) {
    writeJSON(flags.out, { site, checkedAt: new Date().toISOString(), ...ai });
    console.log(`${ok("Written")} → ${flags.out}\n`);
  }
  return ai;
}

// -------------------------------------------------------------------- canary
//
// Ask every source a question whose answer is already known, before believing
// anything it says about the site. An empty result and a broken instrument look
// identical from inside a single query, and a zero that is really a failure
// flatters every number in the report around it.
//
// Four values, never two: PASS, FAIL, UNKNOWN, N/A. An UNKNOWN reduces how much
// of the report is covered. It never improves the site's health.

const CANARY_CONTROL_PAGE = "https://example.com/";
const CANARY_CONTROL_ROBOTS = "https://www.google.com/robots.txt";

async function canary(cfg, flags) {
  const site = cfg.site;
  console.log(paint("\nCanary — known-answer checks before any result is believed\n", C.bold));
  const checks = [];
  const add = (source, question, expected, state, detail) =>
    checks.push({ source, question, expected, state, detail });

  // 1. The extractor itself. If it cannot read a page whose contents have been
  //    the same for twenty years, nothing it says about your pages is evidence.
  try {
    const page = await crawlPage(CANARY_CONTROL_PAGE, "https://example.com");
    const gotTitle = (page.title || "").toLowerCase().includes("example domain");
    add("crawler", `parse ${CANARY_CONTROL_PAGE}`, 'title contains "Example Domain"',
      page.error ? "FAIL" : gotTitle ? "PASS" : "FAIL",
      page.error || `title: ${JSON.stringify(page.title)}`);
  } catch (err) {
    add("crawler", `parse ${CANARY_CONTROL_PAGE}`, 'title contains "Example Domain"', "FAIL", String(err.message || err));
  }

  // 2. The robots.txt fetch path, separately, because it has its own failure mode.
  try {
    const res = await fetchWithRetry(CANARY_CONTROL_ROBOTS);
    const text = await res.text();
    const groups = parseRobots(text);
    add("robots", `fetch and parse ${CANARY_CONTROL_ROBOTS}`, "at least one User-agent group",
      groups.length ? "PASS" : "FAIL", `${groups.length} groups parsed`);
  } catch (err) {
    add("robots", `fetch ${CANARY_CONTROL_ROBOTS}`, "HTTP 200", "FAIL", String(err.message || err));
  }

  // 3. The site's own sitemap. Zero URLs is a real possibility and a real
  //    problem, but an unreachable sitemap is a different fact and must not be
  //    reported as an empty one.
  if (site) {
    try {
      // The same discovery the crawl uses, or this control measures a path
      // the crawl does not take. A PASS on a sitemap index — five child
      // sitemaps counted as five pages — is the failure this rewrite exists
      // to stop, so the detail names the file that was actually read.
      const found = await discoverSitemap(site);
      const root = found.roots[0];
      const where = root
        ? `${root.url} (${root.via}${root.index ? `, a sitemap index; ${found.children.length} child sitemap(s) read` : ""})`
        : `nothing that parses as a sitemap — tried ${found.tried.map((t) => t.url).join(", ") || "nothing"}`;
      const skipped = found.notFollowed.length
        ? `; ${found.notFollowed.length} sitemap(s) NOT followed, so this list is incomplete — see sitemap.notFollowed`
        : "";
      add("sitemap", `discover a sitemap for ${site}`, "at least one page URL in a <urlset>",
        found.urls.length ? "PASS" : "FAIL",
        found.urls.length
          ? `${found.urls.length} page urls from ${where}${skipped}`
          : root
            ? `read ${where} but it yielded no page URLs — the crawl will measure nothing${skipped}`
            : where);
    } catch (err) {
      add("sitemap", `discover a sitemap for ${site}`, "at least one page URL in a <urlset>", "FAIL", String(err.message || err));
    }
  } else {
    add("sitemap", "site sitemap", "at least one page URL in a <urlset>", "N/A", "no site configured");
  }

  // 4. Search Console. The control is "can this identity see any property at
  //    all" — because zero rows from a property you cannot see and zero rows
  //    from a property with no traffic are the same JSON.
  if (!haveKeyFile(cfg)) {
    add("search-console", "list properties", "at least one property", "N/A", "not connected");
  } else {
    try {
      const props = await listProperties(cfg);
      const names = props.map((p) => p.siteUrl);
      const missing = cfg.properties.filter((w) => !names.includes(w));
      add("search-console", "list properties", "at least one property",
        props.length ? (missing.length ? "UNKNOWN" : "PASS") : "FAIL",
        props.length
          ? (missing.length ? `visible: ${names.join(", ")}; configured but NOT visible: ${missing.join(", ")}` : `${props.length} visible`)
          : "the key works but sees no properties — it has not been added as an Owner yet");
    } catch (err) {
      add("search-console", "list properties", "at least one property", "FAIL", String(err.message || err));
    }
  }

  // 5. PageSpeed. Control target rather than the user's site, so a throttle is
  //    distinguishable from a slow page.
  if (!secret("PSI_API_KEY")) {
    add("pagespeed", `score ${CANARY_CONTROL_PAGE}`, "a performance score", "N/A", "no PSI_API_KEY — runs unkeyed and throttled");
  } else {
    const r = await runPsi(CANARY_CONTROL_PAGE, "mobile");
    add("pagespeed", `score ${CANARY_CONTROL_PAGE}`, "a performance score",
      r.scores?.performance != null ? "PASS" : "FAIL", r.error || `performance ${r.scores?.performance}`);
  }

  // 6. Bing. An endpoint that returns an empty array for a site with pages is
  //    the exact failure this whole command exists for.
  if (!secret("BING_WMT_API_KEY")) {
    add("bing", "rank and traffic stats", "a non-empty series", "N/A", "no BING_WMT_API_KEY");
  } else if (!site) {
    add("bing", "rank and traffic stats", "a non-empty series", "N/A", "no site configured");
  } else {
    const b = await captureBing(site);
    const series = b.rankAndTraffic?.d;
    // The binding check runs FIRST, because if the key is not bound to this
    // property then the series check below is measuring nothing and a clean
    // "0 rows" would read as a finding (2026-09-21).
    add("bing", "key is bound to this property", "siteUrl in GetUserSites",
      b.binding?.error ? "FAIL" : b.binding?.matched ? "PASS" : "FAIL",
      b.binding?.error
        || (b.binding?.matched
          ? `registered as ${b.binding.registeredAs}${b.binding.isVerified ? ", verified" : ", NOT VERIFIED"}`
          : `NOT in this key's properties — it can see: ${(b.binding?.verifiedProperties || []).join(", ") || "none"}`));
    const feed = Array.isArray(b.feeds?.d) ? b.feeds.d[0] : null;
    if (feed) {
      add("bing", "sitemap known to Bing", "submitted and crawled", "PASS",
        `${feed.Url} submitted ${bingDate(feed.Submitted)}, last crawled ${bingDate(feed.LastCrawled)}, ${feed.UrlCount} urls`);
    }
    add("bing", "rank and traffic stats", "a non-empty series",
      b.rankAndTraffic?.error ? "FAIL" : Array.isArray(series) && series.length ? "PASS" : "UNKNOWN",
      b.rankAndTraffic?.error || (Array.isArray(series) && series.length ? `${series.length} rows` : b.readAs || "no series in the response — treat any Bing zero below as unavailable, not as zero"));
  }

  const mark = { PASS: ok("PASS"), FAIL: bad("FAIL"), UNKNOWN: warn("UNKN"), "N/A": paint("n/a ", C.dim) };
  for (const c of checks) {
    console.log(`  ${mark[c.state]}  ${c.source.padEnd(16)} ${c.question}`);
    console.log(`        ${paint(`expected ${c.expected} — ${c.detail}`, C.dim)}`);
  }

  const live = checks.filter((c) => c.state !== "N/A");
  const passed = live.filter((c) => c.state === "PASS").length;
  const pct = live.length ? Math.round((passed / live.length) * 100) : 0;
  const failed = checks.filter((c) => c.state === "FAIL");

  console.log(paint(`\n  ${passed}/${live.length} live sources answered correctly (${pct}%)`, C.bold));
  const notApplicable = checks.filter((c) => c.state === "N/A").map((c) => c.source);
  if (notApplicable.length) {
    console.log(paint(`  not connected: ${notApplicable.join(", ")} — these are gaps in coverage, not clean results`, C.dim));
  }
  const unknown = checks.filter((c) => c.state === "UNKNOWN");
  if (failed.length) {
    console.log(bad(`\n  Do not believe: ${failed.map((c) => c.source).join(", ")}.`));
    console.log(bad(`  A result from a source that failed its canary is unavailable, never empty.\n`));
  } else if (unknown.length) {
    console.log(warn(`\n  Treat as unavailable, not as zero: ${unknown.map((c) => c.source).join(", ")}.`));
    console.log(warn(`  These answered, but not with something only a working source could return.\n`));
  } else {
    console.log(ok(`\n  Every connected source answered a question it could not have faked.\n`));
  }

  if (flags.out && flags.out !== true) writeJSON(flags.out, { checkedAt: new Date().toISOString(), checks, passed, live: live.length, pct });
  // Non-zero on a real failure, so this can gate a capture in a script.
  if (failed.length) process.exitCode = 1;
  return checks;
}

// -------------------------------------------------------------------- doctor

async function doctor(cfg) {
  console.log(paint("\nseo-audit — readiness check\n", C.bold));

  console.log(`  config     ${cfg._path || bad("none found — run `node seo.mjs init`")}`);
  console.log(`  site       ${cfg.site ? ok(cfg.site) : bad("not set")}`);
  console.log(`  snapshots  ${cfg.snapRoot}`);
  console.log(`  key file   ${cfg.keyFile}`);

  if (!haveKeyFile(cfg)) {
    console.log(`             ${warn("missing — Search Console is locked")}\n`);
    console.log(paint("  Everything below is optional. The audit already works without it.", C.dim));
    console.log(paint("  Connecting Search Console adds index state, Google's chosen canonical, and query", C.dim));
    console.log(paint("  history — up to 16 months of it if this property is already verified. Verifying it", C.dim));
    console.log(paint("  today starts the history at zero: Search Console does not backfill.\n", C.dim));
    console.log(paint("  About 10 minutes of clicking, once:", C.bold));
    console.log(`
  1. console.cloud.google.com → create a project (any name).
  2. APIs & Services → Library → enable "Google Search Console API".
  3. APIs & Services → Credentials → Create credentials → Service account.
     Any name. No roles needed. Create.
  4. Open the service account → Keys → Add key → Create new key → JSON.
     A file downloads. Move it, do not open it:
       mkdir -p ~/.config/seo-audit
       mv ~/Downloads/<that-file>.json ${cfg.keyFile}
       chmod 600 ${cfg.keyFile}
  5. Copy the service account's email. It ends in .iam.gserviceaccount.com and is
     shown on the service account page — it is an identifier, not a secret.
  6. search.google.com/search-console → for EVERY property you listed in
     ${CONFIG_NAME}:
       Settings → Users and permissions → Add user
       → paste the email, Permission: Owner → Add.
     Owner, not Full: the URL Inspection API refuses anything less.

  Optional, and it removes the PageSpeed throttling that otherwise leaves gaps:
  7. Same Cloud project → enable "PageSpeed Insights API" → Credentials →
     Create credentials → API key. Then put it in the keychain:
       security add-generic-password -U -a "$USER" -s PSI_API_KEY -w
     The -w with no value prompts for the key, so it never reaches your shell
     history. This script reads it from the keychain on its own.

  Then re-run: node seo.mjs doctor
`);
    return;
  }

  console.log(`             ${ok("present")}`);
  console.log(`  psi key    ${secret("PSI_API_KEY") ? ok("in keychain") : warn("not set — PageSpeed is capped and may be throttled")}`);
  console.log(`  bing key   ${secret("BING_WMT_API_KEY") ? ok("in keychain") : warn("not set — Bing skipped")}`);

  try {
    const key = JSON.parse(readFileSync(cfg.keyFile, "utf8"));
    console.log(`  identity   ${key.client_email}`);
  } catch {
    console.log(`  identity   ${bad("unreadable JSON")}`);
    return;
  }

  // Presence is not liveness. A key that exists, a key that is revoked, and a
  // key that was never granted access all look the same on disk, and the only
  // difference that matters is whether it still works right now.
  try {
    await getAccessToken(cfg);
    console.log(`  token      ${ok("issued")}`);
  } catch (err) {
    console.log(`  token      ${bad(err.message)}`);
    return;
  }

  try {
    const props = await listProperties(cfg);
    if (!props.length) {
      console.log(`  properties ${bad("none visible")} — step 6 above has not been done yet`);
      return;
    }
    for (const p of props) console.log(`  property   ${ok(p.siteUrl)} (${p.permissionLevel})`);
    for (const want of cfg.properties) {
      if (!props.some((p) => p.siteUrl === want)) {
        console.log(`  ${warn("missing")}    ${want} — add the service account to it too`);
      }
    }
    if (!cfg.properties.length) {
      console.log(paint(`\n  Add these to searchConsole.properties in ${CONFIG_NAME}:`, C.dim));
      for (const p of props) console.log(paint(`    "${p.siteUrl}"`, C.dim));
    }
  } catch (err) {
    console.log(`  properties ${bad(err.message)}`);
  }
  console.log(paint("\n  Presence is not liveness: every key above was exercised, not just found.\n", C.dim));
}

// Parsed once, here, so an out-of-range value cannot quietly become NaN and
// collapse the worker pool to zero workers — which hangs rather than errors.
function concurrencyOf(flags) {
  const out = {};
  const n = Number(flags.concurrency);
  if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(Math.floor(n), 32);
  // Passing --max-pages is what turns the refusal into a sample. There is no
  // upper clamp: someone who types the number has said what they want, and
  // the honest response is to do it and label the result a sample.
  const m = Number(flags["max-pages"]);
  if (Number.isFinite(m) && m >= 1) out.maxPages = Math.floor(m);
  return out;
}

// ---------------------------------------------------------------------- main

const USAGE = `
seo.mjs — freeze a site's search signals into a dated folder you can diff later.

  init      write ${CONFIG_NAME} for this project
  robots    which AI crawlers can read this site        (no credentials)
  canary    ask every source a known-answer question    (no credentials)
  onpage    crawl every sitemap URL into one file       (no credentials)
  capture   a dated snapshot of everything unlocked
  compare   diff two snapshots
  list      what has been captured
  doctor    are the credentials present AND alive

  --config <path>   use a specific ${CONFIG_NAME}
  --site <url>      override the configured site
  --here            init: write ${CONFIG_NAME} in this directory, not ~/seo-audits/<host>/
  --out <path>      write machine-readable output (robots, canary, onpage)
  --concurrency <n> parallel page fetches while crawling (default 8)
  --max-pages <n>   crawl at most n sitemap URLs. Above 2000 the crawl refuses
                    until you pass this, and a truncated crawl is reported as
                    a sample of the site rather than as the site
  --help            print this and do nothing else

No code project is required. A URL is enough: "init --site <url>" from anywhere
sets up a folder under ~/seo-audits/<host>/ and every command finds it.

Examples
  node seo.mjs robots --site https://example.com
  node seo.mjs capture --label baseline
  node seo.mjs compare baseline t1
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  // `--help` used to fall through to the command itself, so `onpage --help`
  // crawled the whole site instead of explaining it. A help flag must never do
  // work, least of all network work against somebody else's server.
  if (flags.help || flags.h || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(USAGE);
    return;
  }

  const cfg = loadConfig(flags);

  switch (cmd) {
    case "init": return void init(cfg, flags);
    case "robots": return void (await robots(cfg, flags));
    case "canary": return void (await canary(cfg, flags));
    case "capture": return void (await capture(cfg, flags));
    case "compare": {
      const [a, b] = flags._;
      if (!a || !b) { console.error("Usage: compare <labelA> <labelB>"); process.exit(1); }
      return compare(cfg, a, b);
    }
    case "onpage": {
      const site = cfg.site;
      const base = flags.base && flags.base !== true ? flags.base : requireSite(cfg);
      const out = flags.out && flags.out !== true ? flags.out : join(cfg.snapRoot, "onpage-adhoc.json");
      console.log(`Crawling ${base}`);
      const crawl = await crawlSite(base, { site: site || base, ...concurrencyOf(flags) });
      writeJSON(out, crawl);
      reportAiCrawlers(crawl.aiCrawlers);
      console.log(
        `\n  ${crawl.coverage.fetched}/${crawl.coverage.attempted} pages fetched ` +
        `(${crawl.coverage.pct}%, ${crawl.coverage.grade})`,
      );
      if (crawl.coverage.grade === "insufficient") {
        console.log(bad("  Under 60% coverage — do not summarise this site's health from this crawl."));
      }
      console.log(`${ok("Written")} → ${out}`);
      return;
    }
    case "list": {
      if (!existsSync(cfg.snapRoot)) return console.log("No snapshots yet.");
      for (const d of readdirSync(cfg.snapRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
        const m = readIf(join(cfg.snapRoot, d, "manifest.json"));
        const skipped = m?.skipped?.map((s) => s.source).join(", ");
        console.log(
          `  ${d.padEnd(34)} ${m ? `${m.window.from} .. ${m.window.until}` : ""}` +
          (skipped ? paint(`   missing: ${skipped}`, C.dim) : ""),
        );
      }
      return;
    }
    case "doctor": return void (await doctor(cfg));
    default:
      console.log(USAGE);
  }
}

main().catch((err) => {
  // A stack trace is for a bug in this script. Most failures here are a wrong
  // label or an unreachable site, and burying that under ten frames of node
  // internals teaches the reader to stop reading the error.
  console.error(bad(`\n${err.message || err}\n`));
  if (process.env.SEO_DEBUG) console.error(err.stack);
  process.exit(1);
});

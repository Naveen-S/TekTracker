/**
 * Confluence vocabulary parsing for the security tracker (security-vulnerability-tracker.md
 * decision 8, (b) vocab.mjs). Pure — the fetch lives in lib/jira/confluence.js and the store in
 * vocab-refresh.js.
 *
 * Three pages, read in Confluence STORAGE format (XHTML):
 * - vulnerability labels and track labels: comma-separated lists in paragraphs, with dated
 *   change-log headings ("2026-08-17") that are skipped;
 * - service → track: a code macro whose CDATA holds `=== TRACK ===` headings followed by
 *   `- service` lines. `[also X]` / `[also has 1 X ticket…]` adds a second track, which makes the
 *   service AMBIGUOUS (flagged, never double-labelled).
 *
 * Bodies are DATA: parsed into plain strings, never rendered as HTML. Labels match EXACTLY
 * (case-insensitive) — the artifact's old substring rules counted misspellings as triaged.
 * The parsing rules are ported from the artifact (`parseLabelList`, `parseServiceMap`).
 */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rarr: "→", mdash: "—", ndash: "–" };

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/** Storage XHTML → plain lines. Headings become "# …" lines so the list parser can skip them. */
export function storageToText(storage) {
  return decodeEntities(
    String(storage ?? "")
      .replace(/<h[1-6][^>]*>/gi, "\n# ")
      .replace(/<\/(p|h[1-6]|li|div|tr)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

/** The CDATA of the first code macro, or null when the page has none. */
export function extractCodeBlock(storage) {
  const match = /<ac:structured-macro[^>]*ac:name="code"[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>/i.exec(
    String(storage ?? ""),
  );
  return match ? match[1] : null;
}

/** A comma/newline separated label list; "#" heading lines are skipped; first spelling wins. */
export function parseLabelList(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text ?? "").split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    for (const raw of line.split(",")) {
      const token = raw.replace(/\*/g, "").trim();
      if (/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(token) && !seen.has(token.toUpperCase())) {
        seen.add(token.toUpperCase());
        out.push(token);
      }
    }
  }
  return out;
}

/** `=== TRACK ===` + `- service [also X]` lines → { service(lowercase): [track, …] }. */
export function parseServiceMap(text) {
  const map = {};
  let current = null;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^===\s*([A-Za-z0-9_]+)\s*===/.exec(line);
    if (heading) {
      current = heading[1];
      continue;
    }
    const entry = /^-\s+([A-Za-z0-9][A-Za-z0-9_.-]*)(.*)$/.exec(line);
    if (!entry || !current) continue;
    const service = entry[1].toLowerCase();
    const tracks = map[service] ?? (map[service] = []);
    if (!tracks.includes(current)) tracks.push(current);
    const also = /\[also(?:\s+has\s+\d+)?\s+([A-Za-z0-9_]+)/i.exec(entry[2] ?? "");
    if (also && !tracks.includes(also[1])) tracks.push(also[1]);
  }
  return map;
}

/** Invert a TRACK → services table (the code snapshot's shape) into the parsed service map. */
export function serviceMapFromTracks(trackToServices) {
  const map = {};
  for (const [track, services] of Object.entries(trackToServices ?? {})) {
    for (const service of services) {
      const tracks = map[service.toLowerCase()] ?? (map[service.toLowerCase()] = []);
      if (!tracks.includes(track)) tracks.push(track);
    }
  }
  return map;
}

/** Minimum plausible sizes — below these a page "no longer parses" (layout changed). */
const MIN_SIZE = { vuln: 10, track: 3, service: 10 };

/**
 * Parse one page's storage body. Throws when the result is implausibly small, so the caller keeps
 * the previous list for that page and records why.
 * @param {"vuln" | "track" | "service"} kind
 * @param {string} storage
 */
export function parsePage(kind, storage) {
  if (kind === "service") {
    const map = parseServiceMap(extractCodeBlock(storage) ?? storageToText(storage));
    const size = Object.keys(map).length;
    if (size < MIN_SIZE.service) throw new Error(`the service→track page no longer parses (${size} services)`);
    return map;
  }
  const list = parseLabelList(storageToText(storage));
  if (list.length < MIN_SIZE[kind]) {
    throw new Error(`the ${kind === "vuln" ? "vulnerability" : "track"} label page no longer parses (${list.length} labels)`);
  }
  return list;
}

/**
 * The stored vocabulary JSON → lookup indexes. `stored` is `SecurityTrackerSettings.vocab`
 * ({ vuln, track, service, live }) or the code snapshot when nothing was ever fetched.
 */
export function buildVocab(stored, snapshot) {
  const source = stored ?? {
    vuln: snapshot.vuln,
    track: snapshot.track,
    service: serviceMapFromTracks(snapshot.service),
    live: { vuln: false, track: false, service: false },
  };
  const index = (list) => new Map(list.map((label) => [label.toUpperCase(), label]));
  return {
    vuln: source.vuln,
    track: source.track,
    service: source.service,
    live: source.live ?? { vuln: false, track: false, service: false },
    vulnIdx: index(source.vuln),
    trackIdx: index(source.track),
  };
}

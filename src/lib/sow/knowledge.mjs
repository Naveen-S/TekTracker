/**
 * StoryBoard's own copy of a SOW's primary Confluence pages (sow-tracker.md round 6). Pure:
 * storage-format HTML → plain-text sections, and picking the sections that match a question.
 * Ask StoryBoard answers from the picked sections, so a page works the day it is written — before
 * ORBIT DeepContext has indexed it — and without sending a 100 KB page with every question.
 *
 * Plain-Node loadable (`.mjs`, relative imports only).
 */

/** Per-section and per-page caps, so one runaway page cannot crowd out the rest. */
export const KNOWLEDGE_SECTION_MAX = 4000;
export const KNOWLEDGE_PAGE_MAX = 120_000;
/** How much page text one Ask question carries. */
export const KNOWLEDGE_ASK_BUDGET = 10_000;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rarr: "→", larr: "←", mdash: "—", ndash: "–", hellip: "…", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };

function decode(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/** Confluence storage HTML (one fragment) → readable plain text. Tables become "a | b" rows. */
function toText(html) {
  return decode(
    html
      // A table cell's paragraphs stay on the cell's line, so one row reads as one line.
      .replace(/<t([hd])([^>]*)>([\s\S]*?)<\/t\1>/gi, (_, cell, attrs, inner) => `<t${cell}${attrs}>${inner.replace(/<\/?p[^>]*>/gi, " ")}</t${cell}>`)
      // Code and preformatted macros keep their body (CDATA) as-is.
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, code) => `\n${code}\n`)
      .replace(/<ac:parameter[^>]*>[\s\S]*?<\/ac:parameter>/g, "")
      .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|tr|blockquote|pre|h[1-6])>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<\/t[hd]>/gi, " | ")
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `${label} (${href})`)
      .replace(/<ri:page [^>]*ri:content-title="([^"]+)"[^>]*\/?>/gi, " $1 ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Split a page into sections at its h1–h3 headings. Text before the first heading is "Overview".
 * @param {string} storage Confluence storage-format body
 * @returns {Array<{ heading: string, text: string }>}
 */
export function storageToSections(storage) {
  const parts = String(storage ?? "").split(/(<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>)/i);
  const sections = [];
  let heading = "Overview";
  let buffer = "";
  const flush = () => {
    const text = toText(buffer);
    if (text) sections.push({ heading, text: text.length > KNOWLEDGE_SECTION_MAX ? `${text.slice(0, KNOWLEDGE_SECTION_MAX)}…` : text });
  };
  for (const part of parts) {
    if (/^<h[1-3]/i.test(part)) {
      flush();
      heading = toText(part).replace(/\s+/g, " ").slice(0, 160) || "Section";
      buffer = "";
    } else {
      buffer += part;
    }
  }
  flush();
  // Keep the page within its cap, whole sections first-come.
  let total = 0;
  return sections.filter((section) => {
    total += section.heading.length + section.text.length;
    return total <= KNOWLEDGE_PAGE_MAX;
  });
}

/** The numeric page id in a Confluence page URL, or null. */
export function confluencePageId(url) {
  return /\/wiki\/spaces\/[^/]+\/pages\/(\d+)/.exec(url ?? "")?.[1] ?? null;
}

const STOPWORDS = new Set(
  "the a an and or of to in on for is are was were be been it its this that these those with by from at as what which who whom how why when where does do did can could should would will about into than then there their them they we our you your any all some not no yes per via vs".split(" "),
);

/** Lowercased content words of 3+ characters (and every word with a digit, e.g. "gm-10506"). */
export function terms(text) {
  return [...new Set(String(text ?? "").toLowerCase().match(/[a-z0-9][a-z0-9_.-]*/g) ?? [])].filter(
    (word) => /\d/.test(word) || (word.length >= 3 && !STOPWORDS.has(word)),
  );
}

/**
 * The sections of the stored pages that best match a question, within a character budget, plus
 * every page's table of contents so the model knows what else exists. A heading match counts
 * three times a body match. With no match at all, each page's opening section is sent.
 *
 * @param {Array<object>} knowledge `Sow.knowledge`
 * @param {string} question the question (and recent turns)
 */
export function selectKnowledge(knowledge, question, budget = KNOWLEDGE_ASK_BUDGET) {
  const pages = (Array.isArray(knowledge) ? knowledge : []).filter((page) => Array.isArray(page?.sections) && page.sections.length > 0);
  if (pages.length === 0) return null;
  const wanted = terms(question);
  const scored = pages.flatMap((page) =>
    page.sections.map((section, index) => {
      const heading = section.heading.toLowerCase();
      const body = section.text.toLowerCase();
      const score = wanted.reduce((sum, word) => sum + (heading.includes(word) ? 3 : 0) + (body.includes(word) ? 1 : 0), 0);
      return { page, section, index, score };
    }),
  );
  const ranked = scored.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen = ranked.length > 0 ? ranked : scored.filter((entry) => entry.index === 0);
  const sections = [];
  let used = 0;
  for (const entry of chosen) {
    const size = entry.section.heading.length + entry.section.text.length;
    if (used + size > budget) continue;
    used += size;
    sections.push({ page: entry.page.title, heading: entry.section.heading, text: entry.section.text });
  }
  return {
    pages: pages.map((page) => ({ title: page.title, url: page.url, readAt: page.fetchedAt, contents: page.sections.map((section) => section.heading) })),
    sections,
    note: "Sections of the SOW's primary Confluence pages that match this question, as StoryBoard last read them. Cite the page and section.",
  };
}

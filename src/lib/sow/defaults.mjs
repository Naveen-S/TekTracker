/**
 * SOW tracker constants (sow-tracker.md): ticket kinds, the default classification rules and
 * weights, the status vocabularies, the standard template and the Configurator AI seed.
 * Pure data — imported by the pure modules, the zod schemas, the seed and the UI.
 */

/** Ticket kinds, in display order. `EPIC` rolls up from its children and is never weighed. */
export const KINDS = ["EPIC", "STORY", "TECH", "RELB", "INTERNAL_BUG", "UAT_ISSUE", "EXTERNAL_BUG", "OTHER"];

export const KIND_LABELS = {
  EPIC: "Epics",
  STORY: "Stories",
  TECH: "Tech stories & tasks",
  RELB: "RELB",
  INTERNAL_BUG: "Internal bugs",
  UAT_ISSUE: "UAT issues",
  EXTERNAL_BUG: "External bugs",
  OTHER: "Unclassified",
};

export const KIND_SHORT = {
  EPIC: "Epic",
  STORY: "Story",
  TECH: "Tech",
  RELB: "RELB",
  INTERNAL_BUG: "Internal bug",
  UAT_ISSUE: "UAT issue",
  EXTERNAL_BUG: "External bug",
  OTHER: "Unclassified",
};

/** Planned scope: what the schedule health is judged on (decision 15). */
export const SCOPE_KINDS = ["STORY", "TECH"];
export const BUG_KINDS = ["INTERNAL_BUG", "UAT_ISSUE", "EXTERNAL_BUG"];
export const FALLBACK_KIND = "OTHER";

/** Decision 4 — first match wins; a rule's conditions AND together, values within one OR. */
export const DEFAULT_KIND_RULES = [
  { kind: "RELB", projects: ["RELB"] },
  { kind: "UAT_ISSUE", projects: ["GMDRP"] },
  { kind: "EXTERNAL_BUG", projects: ["ENG"] },
  { kind: "INTERNAL_BUG", issueTypes: ["Bug"] },
  { kind: "EPIC", issueTypes: ["Epic"] },
  { kind: "STORY", issueTypes: ["Story"] },
  { kind: "TECH", issueTypes: ["Tech Story", "Task", "Sub-task", "Subtask"] },
];

/** Decision 5 — stories carry the most, bugs the least, so a bug wave barely moves the headline. */
export const DEFAULT_KIND_WEIGHTS = {
  STORY: 5,
  TECH: 3,
  RELB: 2,
  INTERNAL_BUG: 1,
  UAT_ISSUE: 1,
  EXTERNAL_BUG: 1,
  OTHER: 1,
};

/** Fallback credit per Jira statusCategory key, for a status name the table below doesn't know. */
export const STATUS_CREDIT = { new: 0, indeterminate: 0.5, done: 1 };

/**
 * Credit per Jira status NAME (lowercased), checked before the category. Needed because Tekion's
 * workflow files "Groomed" under Jira's in-progress category (a groomed story has not started)
 * and treats Testing / UAT / Not Applicable as terminal (confirmed live for the board's
 * StatusStageMapping seed, 2026-07-27/28).
 */
export const STATUS_NAME_CREDIT = {
  backlog: 0,
  "to do": 0,
  open: 0,
  triaged: 0,
  groomed: 0,
  "ready for dev": 0,
  "in progress": 0.4,
  "dev in progress": 0.4,
  "in development": 0.4,
  "code review": 0.7,
  "in review": 0.7,
  "in qa": 0.85,
  testing: 1,
  uat: 1,
  "oem review": 1,
  "support validation": 1,
  "security validation": 1,
  "not applicable": 1,
  "close as duplicate": 1,
};

export const REFERENCE_KINDS = ["CONFLUENCE", "REPO", "LINK"];
export const REFERENCE_KIND_LABELS = { CONFLUENCE: "Confluence", REPO: "Repository", LINK: "Link" };

export const SOW_STATUSES = ["ACTIVE", "COMPLETED", "ARCHIVED"];
export const SOW_STATUS_LABELS = { ACTIVE: "Active", COMPLETED: "Completed", ARCHIVED: "Archived" };

export const ITEM_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "DONE", "AT_RISK"];
export const ITEM_STATUS_LABELS = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  AT_RISK: "At risk",
};

export const RISK_TYPES = ["RISK", "BLOCKER", "DECISION"];
export const RISK_TYPE_LABELS = { RISK: "Risk", BLOCKER: "Blocker", DECISION: "Decision" };
export const RISK_STATUSES = ["OPEN", "MITIGATED", "CLOSED"];
export const RISK_STATUS_LABELS = { OPEN: "Open", MITIGATED: "Mitigated", CLOSED: "Closed" };

/**
 * The standard SOW shape (decision 9). Offsets are days on a TEMPLATE_SPAN-day project and are
 * scaled to the real start → launch window by template.mjs. Taken from the Configurator AI plan,
 * since "most SOWs follow a similar pattern".
 */
export const TEMPLATE_SPAN = 111;

export const STANDARD_TEMPLATE = [
  {
    name: "Set-up",
    from: 0,
    to: 7,
    kinds: [],
    items: [
      { title: "Requirements / PRD sign-off", at: 7 },
      { title: "Legal review", at: 7 },
      { title: "Environment set-up", at: 7 },
    ],
  },
  {
    name: "Design & Analysis",
    from: 8,
    to: 29,
    kinds: [],
    items: [
      { title: "Architecture design", at: 29 },
      { title: "Finalize dependencies and data sources", at: 29 },
      { title: "Finalize timeline and deliverable scope", at: 29 },
    ],
  },
  {
    name: "Development",
    from: 30,
    to: 50,
    kinds: ["EPIC", "STORY", "TECH"],
    items: [{ title: "Dev complete", at: 50, isGate: true }],
  },
  {
    name: "Internal QA",
    from: 53,
    to: 64,
    kinds: ["INTERNAL_BUG"],
    items: [{ title: "Internal QA start", at: 53, isGate: true }],
  },
  {
    name: "UAT",
    from: 62,
    to: 70,
    kinds: ["UAT_ISSUE"],
    items: [{ title: "UAT start", at: 62, isGate: true }],
  },
  {
    name: "Private Prod",
    from: 78,
    to: 108,
    kinds: ["RELB", "EXTERNAL_BUG"],
    items: [
      { title: "1st Private Prod", at: 78, isGate: true },
      { title: "2nd Private Prod", at: 103, isGate: true },
    ],
  },
  {
    name: "Launch",
    from: 109,
    to: 111,
    kinds: [],
    items: [
      { title: "Go / No-Go", at: 109, isGate: true },
      { title: "Pilot launch", at: 111, isGate: true },
    ],
  },
];

/**
 * The first SOW (decision 10): Configurator AI, from the "Configurator ShopAssist — High Level
 * Project Plan" deck, Option 1 dates. Statuses are the deck's Milestone Tracker as of its
 * writing; admins keep them current on the page. The deck gives no start dates for Set-up and
 * Design, so Oct 1 / Oct 9 are placeholders.
 */
export const CONFIGURATOR_AI_SEED = {
  name: "Configurator AI",
  slug: "configurator-ai",
  description: "Configurator ShopAssist — AI chat in the GM configurator. Chevrolet MVP first; Cadillac, GMC and Buick follow.",
  ownerName: "Naveen S",
  programKey: "GM",
  sourceType: "JIRA_FILTER",
  jiraFilterId: "71390",
  homeProjectKeys: ["GM"],
  slackChannelId: "C0CE3GZ6JSD", // #config-ai-all — issues raised before the official QA hand-off
  // Read only for decisions and shared documents (round 4, Naveen 2026-11-11).
  feedChannels: [
    { id: "C0BQ6HUJHQE", name: "configurator-ai" },
    { id: "C0BREF9BP4N", name: "configurator_ai_oem_agentic_framework" },
  ],
  startDate: "2026-10-01",
  launchDate: "2027-01-20",
  phases: [
    {
      name: "Set-up",
      startDate: "2026-10-01",
      endDate: "2026-10-08",
      kinds: [],
      items: [
        { title: "PRD sign-off", status: "IN_PROGRESS", date: "2026-10-08", comment: "PRD updated 9/30; success-metric targets still TBD" },
      ],
    },
    {
      name: "Design & Analysis",
      startDate: "2026-10-09",
      endDate: "2026-10-30",
      kinds: [],
      items: [
        { title: "Architecture design", status: "DONE", date: "2026-10-30" },
        { title: "Environment set-up", status: "DONE", date: "2026-10-30" },
        { title: "Finalize dependencies", status: "DONE", date: "2026-10-30" },
        { title: "Finalize data sources (VCP, Inventory, GDL, Payments)", status: "DONE", date: "2026-10-30" },
        { title: "Finalize timeline and deliverable scope", status: "DONE", date: "2026-11-05" },
      ],
    },
    {
      name: "Development",
      startDate: "2026-10-31",
      endDate: "2026-11-20",
      kinds: ["EPIC", "STORY", "TECH"],
      items: [
        { title: "Establish connectivity", status: "NOT_STARTED", date: "2026-11-06" },
        { title: "AI/ML platform and guardrails evaluation & selection", status: "IN_PROGRESS", date: "2026-11-06" },
        { title: "Chat Foundation & Vehicle Discovery", status: "IN_PROGRESS", date: "2026-11-20", jiraKey: "GM-10506", comment: "UC1, UC2" },
        { title: "Configuration, Co-build & Comparison", status: "IN_PROGRESS", date: "2026-11-20", jiraKey: "GM-10507", comment: "UC3, UC4" },
        { title: "Pricing, Inventory & Dealer Discovery", status: "IN_PROGRESS", date: "2026-11-20", jiraKey: "GM-10508", comment: "UC5, UC6, UC7" },
        { title: "Lead Capture & Engagement Observability", status: "IN_PROGRESS", date: "2026-11-20", jiraKey: "GM-10509", comment: "UC8, success metrics" },
        { title: "Dev complete", status: "NOT_STARTED", date: "2026-11-20", isGate: true },
      ],
    },
    {
      name: "Internal QA",
      startDate: "2026-11-23",
      endDate: "2026-12-04",
      kinds: ["INTERNAL_BUG"],
      items: [{ title: "Internal Tekion QA start", status: "NOT_STARTED", date: "2026-11-23", isGate: true, comment: "2 weeks" }],
    },
    {
      name: "GM UAT",
      startDate: "2026-12-02",
      endDate: "2026-12-10",
      kinds: ["UAT_ISSUE"],
      items: [{ title: "GM UAT start (Pre Prod)", status: "NOT_STARTED", date: "2026-12-02", isGate: true, comment: "~1.5 weeks; starts during internal QA" }],
    },
    {
      name: "Private Prod",
      startDate: "2026-12-18",
      endDate: "2027-01-17",
      kinds: ["RELB", "EXTERNAL_BUG"],
      items: [
        { title: "1st Private Prod", status: "NOT_STARTED", date: "2026-12-18", isGate: true, comment: "Option 1; Option 2 would be Jan 5" },
        { title: "2nd Private Prod", status: "NOT_STARTED", date: "2027-01-12", isGate: true },
      ],
    },
    {
      name: "Launch",
      startDate: "2027-01-18",
      endDate: "2027-01-20",
      kinds: [],
      items: [
        { title: "Prod Go / No-Go", status: "NOT_STARTED", date: "2027-01-18", isGate: true, comment: "Estimated" },
        { title: "Major release", status: "NOT_STARTED", date: "2027-01-20", isGate: true, comment: "Chevrolet; Cadillac, GMC, Buick to follow" },
      ],
    },
  ],
  // The reading list for Perf, QA and anyone joining: the Confluence folder (40 pages as of
  // 2026-11-10) with a curated way in, led by the "Repositories, Services and Request Templates"
  // page (the primary source for Ask), and the 16 repositories from that page's inventory table
  // (2026-11-11), each with what it does, its Jira tickets and its people.
  references: [
    {"group": "Start here", "label": "Repositories, services and request templates", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6938984810/Configurator+AI+-+Repositories+Services+and+Request+Templates", "kind": "CONFLUENCE", "primary": true, "note": "The one page with every repository, what each service does, the call path, sample requests, request templates, environments, the Jira map and known gaps. Read this first."},
    {"group": "Start here", "label": "Configurator – An Overview", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/5191926081/Configurator+-+An+Overview", "kind": "CONFLUENCE", "primary": true, "note": "How the GM configurator itself works: architecture, each page (catalogue, line, model, options, summary, print/design), the API reference and cURL examples."},
    {"group": "Start here", "label": "All Configurator AI documents (Confluence folder)", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/folder/6782812368/Configurator-ai", "kind": "CONFLUENCE"},
    {"group": "Start here", "label": "Overall technical documentation", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6847791905/Overall+Technical+Documentation", "kind": "CONFLUENCE"},
    {"group": "Start here", "label": "Configurator ShopAssist — MVP scope (business edition)", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6894911830/Configurator+ShopAssist+MVP+-+Business_Edition", "kind": "CONFLUENCE"},
    {"group": "Environments", "label": "Stage — Chevrolet configurator", "url": "https://chevrolet-stage.aecloud.io/shopping/configurator?radius=501&zipCode=48243", "kind": "LINK", "note": "Live stage build of the configurator with ShopAssist (ZIP 48243)."},
    {"group": "Environments", "label": "Preprod — Chevrolet configurator", "url": "https://chevrolet-preprod.aecloud.io/shopping/configurator?radius=501&zipCode=48243", "kind": "LINK", "note": "Preprod build of the configurator (ZIP 48243)."},
    {"group": "Environments", "label": "Prod — chevrolet.com configurator", "url": "https://www.chevrolet.com/shopping/configurator?radius=100&zipCode=48243", "kind": "LINK", "note": "Production configurator on chevrolet.com (ZIP 48243)."},
    {"group": "Architecture & design", "label": "LangGraph orchestrator design", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6798475409/Langraph+orchestrator+design", "kind": "CONFLUENCE"},
    {"group": "Architecture & design", "label": "Intent classification", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6835702361/Configurator+ShopAssist+Intent+Classification", "kind": "CONFLUENCE"},
    {"group": "Architecture & design", "label": "Configurator RAG — design", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6848839794/Configurator+RAG+Design", "kind": "CONFLUENCE"},
    {"group": "Architecture & design", "label": "Configurator ingestion — architecture", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6843239133/Configurator+Ingestion+Architecture", "kind": "CONFLUENCE"},
    {"group": "Architecture & design", "label": "Available tools", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6890619002/Available+Tools", "kind": "CONFLUENCE"},
    {"group": "APIs & data", "label": "Configurator APIs for ingestion — API contract", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6839272854/Configurator+API+s+for+ingestion+API+contract", "kind": "CONFLUENCE"},
    {"group": "APIs & data", "label": "GM vehicle configurator APIs — quick reference", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6860211385/GM+Vehicle+Configurator+APIs+-+Quick+Reference+for+Chevrolet+and+GMC", "kind": "CONFLUENCE"},
    {"group": "APIs & data", "label": "Configurator discovery module", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6867419349/Configurator+Discovery+Module", "kind": "CONFLUENCE"},
    {"group": "APIs & data", "label": "Vehicle search data model", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6835866061/Vehicle+Search+Data+Model", "kind": "CONFLUENCE"},
    {"group": "Testing & performance", "label": "Configurator ingestion testing (stage)", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6902809580/Configurator+Ingestion+Testing", "kind": "CONFLUENCE"},
    {"group": "Testing & performance", "label": "Configurator RAG — evaluation", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6845531631/Configurator+RAG+Evaluation", "kind": "CONFLUENCE"},
    {"group": "Testing & performance", "label": "Vector store data throughput & cost", "url": "https://tekion.atlassian.net/wiki/spaces/DRP/pages/6860669104/Vector+store+Data+throughput+cost", "kind": "CONFLUENCE"},
    {"group": "Repositories", "label": "tekion-apps/tools-oem-agentic-frontend", "url": "https://github.com/tekion-apps/tools-oem-agentic-frontend", "kind": "REPO", "note": "Frontend. Chat widget (apps/chat-widget) and GenUI widgets: vehicle model card, matches card, lead form; widget registry generation. Jira: GM-10048, GM-10930, GM-10931. People: Narendra Reddy, Akshay Kumar Gupta."},
    {"group": "Repositories", "label": "tekion-apps/aec-ui-drp-cp-gm-frontend", "url": "https://github.com/tekion-apps/aec-ui-drp-cp-gm-frontend", "kind": "REPO", "note": "Frontend. GM DRP frontend; loads the chat widget script (DRP_AGENTIC_CHAT_SCRIPT_URL); configurator UI changes and chat container layout fixes. Jira: GM-10930, GM-10931. People: Akshay Kumar Gupta, Vivek Lambhi."},
    {"group": "Repositories", "label": "tekion-apps/aec-ui-cp-web", "url": "https://github.com/tekion-apps/aec-ui-cp-web", "kind": "REPO", "note": "Frontend. Configurator page context for the chat (page, build, pricing payload). Jira: GM-10930. People: Akshay Kumar Gupta."},
    {"group": "Repositories", "label": "tekion-apps/oem-ai-forge-config-dashboard", "url": "https://github.com/tekion-apps/oem-ai-forge-config-dashboard", "kind": "REPO", "note": "Frontend (AI Forge config dashboard). Dashboard for the agentic configs; FE components / widget registry tab. Jira: GM-10048. People: Narendra Reddy."},
    {"group": "Repositories", "label": "tekion-apps/tools-oem-agentic-framework", "url": "https://github.com/tekion-apps/tools-oem-agentic-framework", "kind": "REPO", "note": "Agentic platform (Python monorepo). 5 services: API gateway, core, config, context, data ingestion. Configurator configs and OpenAPI tool drafts on GM-10933. Jira: GM-8695, GM-10048, GM-10933, GM-11262, GM-11612. People: Vivek Lambhi, Ankur Kumar, Nirmesh Bansal, Narendra Reddy, Patel Sarthak."},
    {"group": "Repositories", "label": "tekion-apps/oem-agentic-api", "url": "https://github.com/tekion-apps/oem-agentic-api", "kind": "REPO", "note": "Agentic platform (Java). New in 2026. Java port of agentic_api_gateway (platform migration, not configurator-specific). Jira: GM-10532. People: Prathamesh P."},
    {"group": "Repositories", "label": "tekion-apps/oem-agentic-common", "url": "https://github.com/tekion-apps/oem-agentic-common", "kind": "REPO", "note": "Agentic platform (Java library). New in 2026. Shared library for the Java services (platform config client). Jira: GM-10532. People: Prathamesh P."},
    {"group": "Repositories", "label": "tekion-apps/oem-agentic-config", "url": "https://github.com/tekion-apps/oem-agentic-config", "kind": "REPO", "note": "Agentic platform (Java). New in 2026. Java port of agentic_config. Jira: GM-10532. People: Prathamesh P."},
    {"group": "Repositories", "label": "tekion-apps/oem-agentic-context", "url": "https://github.com/tekion-apps/oem-agentic-context", "kind": "REPO", "note": "Agentic platform (Java). New in 2026. Java port of agentic_context. Jira: GM-10532. People: Prathamesh P."},
    {"group": "Repositories", "label": "tekion-apps/aec-precheckout-aec-cp-configurator-gateway", "url": "https://github.com/tekion-apps/aec-precheckout-aec-cp-configurator-gateway", "kind": "REPO", "note": "Backend (public gateway). AI wrapper APIs that the MCP tools, enrichments and ingestion call. Jira: GM-10940, GM-11399, GM-11402. People: Vishnu Priya B, Prathamesh P."},
    {"group": "Repositories", "label": "tekion-apps/aec-precheckout-aec-cp-gm-configurator", "url": "https://github.com/tekion-apps/aec-precheckout-aec-cp-gm-configurator", "kind": "REPO", "note": "Backend (configurator core) + agentic configs. configurator-ai routes (lineup, ingestion APIs, vector search, discovery facets/search, design, locate dealers); configuratorConfigs/ holds the agentic…. Jira: GM-10940, GM-11399, GM-11400, GM-11402. People: Vishnu Priya B, Shivangshu Nag, Prathamesh P."},
    {"group": "Repositories", "label": "tekion-apps/aec-precheckout-aec-cp-discovery", "url": "https://github.com/tekion-apps/aec-precheckout-aec-cp-discovery", "kind": "REPO", "note": "Backend (search on Elasticsearch). Configurator search and facets: /restricted/v1/configurator/search and /facets with header client: CONFIGURATOR_AI. Jira: GM-10982. People: Rajat Wadhwa."},
    {"group": "Repositories", "label": "tekion-apps/aec-precheckout-aec-cp-discovery-apigateway", "url": "https://github.com/tekion-apps/aec-precheckout-aec-cp-discovery-apigateway", "kind": "REPO", "note": "Backend (gateway). GM-10982 changes; on stage it also exposes the ingestion run helpers for testing (/v1/test/configurator-ai/runs). Jira: GM-10982. People: Rajat Wadhwa."},
    {"group": "Repositories", "label": "tekion-apps/aec-precheckout-aec-cp-inventory-common-core", "url": "https://github.com/tekion-apps/aec-precheckout-aec-cp-inventory-common-core", "kind": "REPO", "note": "Backend (shared library). Shared DTOs used by discovery. Jira: GM-10982. People: Rajat Wadhwa."},
    {"group": "Repositories", "label": "tekion-apps/aec-precheckout-aec-cp-ims", "url": "https://github.com/tekion-apps/aec-precheckout-aec-cp-ims", "kind": "REPO", "note": "Backend (inventory). New IMS client for configurator AI (VIN details), consumed by the gateway as aec-cp-ims-clean-client. Jira: GM-11420. People: Rajat Wadhwa."},
    {"group": "Repositories", "label": "tekion-apps/aec-precheckout-aec-cp-configurator-ai-ingestion", "url": "https://github.com/tekion-apps/aec-precheckout-aec-cp-configurator-ai-ingestion", "kind": "REPO", "note": "Ingestion. New in 2026. Builds the Elasticsearch documents and the Qdrant chunks from the configurator ingestion APIs. Jira: GM-10979, GM-10939. People: Pankaj Tekle, Shreyash Acharya, Aaish Sindwani."},
  ],
  risks: [
    { type: "DECISION", title: "Confirm the Private Prod option (Dec 18 vs Jan 5) and the 2nd Private Prod date", status: "OPEN" },
    { type: "RISK", title: "PRD success-metric targets still TBD", status: "OPEN" },
  ],
};

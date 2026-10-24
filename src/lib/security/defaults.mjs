/**
 * Code defaults for the security vulnerability tracker (security-vulnerability-tracker.md (a)/(f)).
 * Shared by the seed (create-only) and the settings reader (a missing singleton row reads as these),
 * so an unseeded database still renders. Pure + relative-import-free: the seed imports it from Node.
 */

export const SECURITY_SETTINGS_ID = "default";

/** Sentinel snapshot key for the derived "All programs" rollup (keeps the unique key NULL-free). */
export const ALL_PROGRAMS_KEY = "__all__";

/**
 * Risk-register thresholds (spec "Risks & blockers", S1–S8). Admin-tunable JSON; every key has a
 * default here, so a partial admin edit falls back per key (see `resolveThresholds` in risks.mjs).
 */
export const DEFAULT_RISK_THRESHOLDS = Object.freeze({
  // S2 Past SLA (P0/P1): High if ≥ highP0 P0s or ≥ highP1 P1s past SLA, else Medium.
  pastSla: { highP0: 1, highP1: 10 },
  // S4 Overdue: High if ≥ high items, or any P0/P1 is overdue; else Medium.
  overdue: { high: 10 },
  // S5 No fix version: Medium; High when more than highPctOfOpen % of the open pipeline.
  noFixVersion: { highPctOfOpen: 10 },
  // S8 Stale: not updated in this many days.
  stale: { days: 30 },
});

export const SECURITY_SETTINGS_DEFAULTS = Object.freeze({
  openPipelineJql: "filter = 32995",
  // Verbatim from the artifact (`PRIO`) — priority ids 1–5, i.e. P0–P4.
  priorityJql: "(priority = 1 OR priority = 2 OR priority = 3 OR priority = 4 OR priority = 5)",
  vulnLabelsPageId: "6317540178",
  trackLabelsPageId: "6317671628",
  serviceTrackPageId: "6317179805",
  monthLabelPrefix: "DRP_SECURITY_",
  // Vulnerability Remediation Contract — calendar days from creation. P4 has no SLA (absent key).
  slaDays: { P0: 1, P1: 60, P2: 180, P3: 273 },
  dueSoonDays: 14,
  placeholderEstimateDays: [45, 110],
  storyPointsField: "customfield_14539",
  sprintField: "customfield_10003",
  subComponentField: "customfield_13108",
  workbenchUrl: null,
  riskThresholds: DEFAULT_RISK_THRESHOLDS,
  vocab: null,
  vocabFetchedAt: null,
  vocabError: null,
  lastRefreshedAt: null,
  lastRefreshedByEmail: null,
  lastRefreshError: null,
});

/** Settings columns an admin configures (the rest is refresh state, which starts empty). */
export const SECURITY_SETTINGS_CONFIG_KEYS = Object.freeze([
  "openPipelineJql", "priorityJql", "vulnLabelsPageId", "trackLabelsPageId", "serviceTrackPageId",
  "monthLabelPrefix", "slaDays", "dueSoonDays", "placeholderEstimateDays", "storyPointsField",
  "sprintField", "subComponentField", "workbenchUrl", "riskThresholds",
]);

/** The singleton's create payload: the code default for every configured column. */
export function settingsCreatePayload() {
  return {
    id: SECURITY_SETTINGS_ID,
    ...Object.fromEntries(SECURITY_SETTINGS_CONFIG_KEYS.map((key) => [key, SECURITY_SETTINGS_DEFAULTS[key]])),
  };
}

/**
 * The six programs (spec decision 2). DR_GM's progress universe is saved filter 68266 used
 * unscoped; NON_DR_GM is excluded everywhere (clarification C5) with the IS EMPTY guard, because a
 * bare `labels != X` silently drops unlabelled issues (GM-10529).
 */
export const DEFAULT_SECURITY_PROGRAMS = Object.freeze([
  {
    key: "DR_GM",
    name: "GM Digital Retail",
    component: "DR_GM",
    sortOrder: 0,
    progressJql: "filter = 68266",
    excludeLabel: "NON_DR_GM",
    trackBreached: true,
    usesTrackLabels: true,
    legacyLabel: "GMDRP_1.0_IGNORED",
  },
  {
    key: "DR_Honda",
    name: "Honda Digital Retail",
    component: "DR_Honda",
    sortOrder: 1,
    progressJql: "project IN (ENG, AHM) AND type IN (Vulnerability) AND component = DR_Honda",
  },
  {
    key: "AEPlatform",
    name: "AE Platform",
    component: "AEPlatform",
    sortOrder: 2,
    progressJql: "project IN (ENG, AEP) AND type IN (Vulnerability) AND component = AEPlatform",
  },
  {
    key: "Fleet_Honda",
    name: "Honda Fleet",
    component: "Fleet_Honda",
    sortOrder: 3,
    progressJql: "project IN (ENG, AHM) AND type IN (Vulnerability) AND component = Fleet_Honda",
  },
  {
    key: "DigitalRetailing",
    name: "Digital Retailing",
    component: "DigitalRetailing",
    sortOrder: 4,
    progressJql: "project IN (ENG, DGRT) AND type IN (Vulnerability) AND component = DigitalRetailing",
  },
  {
    key: "DR_Ford",
    name: "Ford Digital Retail",
    component: "DR_Ford",
    sortOrder: 5,
    progressJql: "project = ENG AND type IN (Vulnerability) AND component = DR_Ford",
  },
]);

/**
 * GMDRP 2026 release calendar (spec decision 6) — the ship DAY per month. Aug 24 and Sep 17 were
 * revised in flight. Months beyond the last entry reuse its day and are flagged "est." at read time.
 */
export const DEFAULT_RELEASE_CALENDAR = Object.freeze([
  ["2026-01", 21],
  ["2026-02", 18],
  ["2026-03", 18],
  ["2026-04", 15],
  ["2026-05", 13],
  ["2026-06", 10],
  ["2026-07", 15],
  ["2026-08", 24],
  ["2026-09", 17],
  ["2026-10", 7],
  ["2026-11", 4],
  ["2026-12", 9],
]);

/**
 * The artifact's 30 Sep 2026 snapshot of the three Confluence vocabulary pages (C9). Used only until
 * the first successful live fetch is stored. `service` is written TRACK → services for readability
 * (a service under two tracks is the page's "[also X]" case); vocab.mjs inverts it.
 */
export const VOCAB_SNAPSHOT = Object.freeze({
  asOf: "2026-09-30",
  vuln: [
    "NEXTJS_UPGRADE", "JACKSON_VULNA", "vulna-tomcat", "INTERCEPT_API_VULNA", "QS_VULNA", "RBAC_VULNA",
    "API_KEY_EXPOSE_VULNA", "BABEL_UPGRADE", "REQUEST_SMUGGLING_VULNA", "vulna-pii", "IFRAME_VULNA",
    "XSS_VULNA", "CPDoS_VULNA", "PATH_TO_REGEX_VULNA", "NPM_PUBLISH_VULNA", "PAYMENT_VULNA",
    "OPEN_REDIRECT", "PASSWORD_RESET_VULNA", "axios-vulna", "next16_upgrade", "postgres_vulna",
    "ip_vulna", "form_data_vulna", "nodemailer_vulna", "permission_vulna", "follow_redirect_vulna",
    "spring_web_vulna", "netty_vulna", "handlebars_vulna", "hapi_vulna", "AGENTIC_AI_VULNA",
    "SQL_INJECTION_VULNA", "SSRF_VULNA", "FILE_UPLOAD_VULNA", "PARAM_TAMPER_VULNA",
    "COOKIE_SECURITY_VULNA", "MOBILE_SECURITY_VULNA", "moment_vulna", "crlf_injection_vulna",
    "body_parser_vulna", "uuid_vulna", "DATA_LEAK_VULNA", "PROMPT_INJECTION_VULNA",
    "SERVICE_DECOMISSION", "vulna-postcss", "vulna-nanoid", "vulna-cassandra",
  ],
  track: [
    "PCX_VULNA", "SCX_VULNA", "INTEGRATION_VULNA", "infra_vulna", "DX_VULNA", "PLATFORM_VULNA",
    "PLATFORM_HORIZONTAL", "AEC_PLATFORM", "NON_DR_GM", "SERVICE_DECOMMISSIONING",
  ],
  service: {
    PCX_VULNA: [
      "aec-cp-fe-gmc-inventory-aecgm", "aec-cp-fe-gmc-configurator-aecgm",
      "aec-cp-fe-gmc-dealerbrandpage-aecgm", "aec-cp-fe-gmc-appointments-aecgm",
      "aec-cp-fe-cadillac-inventory-aecgm", "aec-cp-fe-cadillac-configurator-aecgm",
      "aec-cp-fe-cadillac-myaccount-aecgm", "aec-cp-fe-chevrolet-inventory-aecgm",
      "aec-cp-fe-chevrolet-dealerbrandpage-aecgm", "aec-cp-fe-chevrolet-appointments-aecgm",
      "aec-cp-fe-buick-configurator-aecgm", "aec-cp-fe-buick-inventory-aecgm",
      "aec-cp-fe-buick-myaccount-aecgm", "aec-cp-fe-buick-dealerbrandpage-aecgm",
      "aec-cp-fe-carbravo-myaccount-aecgm", "aec-cp-fe-carbravo-dealerbrandpage-aecgm",
      "aec-cp-fe-carbravo-appointments-aecgm", "aec-cp-fe-opex-aecgm",
      "aec-cp-frontend-doc-components-aecgm", "aec-cp-fe-gm-dwc-redirection",
      "cadillac-consumer-edge-ui-aeccad", "drp-api-gateway-aecgm", "drp-cp-frontend-gmc",
      "drp-cp-frontend-cadillac", "oem-sso-aecgm",
      "stage-gmdrp-aecgm-aec-cp-fe-gmc-inventory", "stage-gmdrp-aecgm-aec-cp-fe-gmc-configurator",
      "stage-gmdrp-aecgm-aec-cp-fe-gmc-dealerbrandpage", "stage-gmdrp-aecgm-aec-cp-fe-gmc-appointments",
      "stage-gmdrp-aecgm-aec-cp-fe-gmc-myaccount", "stage-gmdrp-aecgm-aec-cp-fe-cadillac-configurator",
      "stage-gmdrp-aecgm-aec-cp-fe-cadillac-inventory", "stage-gmdrp-aecgm-aec-cp-fe-cadillac-myaccount",
      "stage-gmdrp-aecgm-aec-cp-fe-cadillac-dealerbrandpage",
      "stage-gmdrp-aecgm-aec-cp-fe-cadillac-appointments",
      "stage-gmdrp-aecgm-aec-cp-fe-chevrolet-inventory",
      "stage-gmdrp-aecgm-aec-cp-fe-chevrolet-configurator",
      "stage-gmdrp-aecgm-aec-cp-fe-chevrolet-dealerbrandpage",
      "stage-gmdrp-aecgm-aec-cp-fe-chevrolet-myaccount",
      "stage-gmdrp-aecgm-aec-cp-fe-chevrolet-appointments",
      "stage-gmdrp-aecgm-aec-cp-fe-chevrolet-checkout", "stage-gmdrp-aecgm-aec-cp-fe-buick-configurator",
      "stage-gmdrp-aecgm-aec-cp-fe-buick-inventory", "stage-gmdrp-aecgm-aec-cp-fe-buick-dealerbrandpage",
      "stage-gmdrp-aecgm-aec-cp-fe-buick-myaccount", "stage-gmdrp-aecgm-aec-cp-fe-buick-appointments",
      "stage-gmdrp-aecgm-aec-cp-fe-carbravo-inventory",
      "stage-gmdrp-aecgm-aec-cp-fe-carbravo-dealerbrandpage",
      "stage-gmdrp-aecgm-aec-cp-fe-carbravo-myaccount",
      "stage-gmdrp-aecgm-aec-cp-fe-carbravo-appointments", "stage-gmdrp-aecgm-secure-checkout-2-0",
      "stage-gmdrp-dmsv2-drp-oem-app",
    ],
    INTEGRATION_VULNA: [
      "drp-api-gateway-bifrostint", "drp-api-gateway", "drp-api-gateway-int-aec",
      "drp-integrations-orchestrator-aecgmint-drp-int-v2",
      "drp-integrations-internal-api-gateway-aecgmint-drp-int-v2",
      "drp-integrations-internal-api-agent-int", "drp-integrations-master-data-web-aecgmint-drp-int-v2",
      "drp-integrations-auth-service-int", "drp-integrations-auth-service-aecgmint-drp-int-v2",
      "drp-integrations-onboarding-service-int", "drp-integrations-workflow-service-aecgmint-drp-int-v2",
      "bifrost-tin-auth-service-int", "bifrost-tin-auth-service-int-aec",
      "aec-integrations-internal-api-agent-int-aec", "aec-integrations-auth-service-int-aec",
      "drp-integrations-orchestrator-int", "bifrost-tin-internal-api-gateway-bifrostint",
    ],
    PLATFORM_VULNA: [
      "gm-internal-gateway-prod-dms-v2", "drp-consumer-internal-gateway-aecgm", "drp-dms-internal-gateway",
      "arcurlredirector-prod-dms-v2", "drp-urlredirector", "mediaservice-v3-prod-dms-v2", "configservice",
      "configservice-int-aec", "drp-pathpermissionservice", "drp-mediaupload",
    ],
    DX_VULNA: [
      "drp-api-gateway-prod-dms-v2", "drp-api-gateway", "drp-emailservice", "drp-emailservice-callbacks",
      "drp-digitalretailservice", "drp-textmessagingservice", "drp-calculationengine",
      "drp-api-accountingservice", "drp-clickstream-ingestor-salescloud", "drp-internal-edge-service",
      "drp-leadactivityservice", "drp-api-knowledgebase-service", "drp-oem-app-prod-dms-v2",
      "drp-oem-track", "drp-oem-track-crm", "drp-oem-portal-ic", "drp-cashier", "drp-dms-core",
      "drp-api-dealerlogin", "drp-api-vehicleinventoryservice", "drp-api-compliance-service",
      "drp-ruleengine", "drp-cp-frontend-dealer-app-2-0-prod-dms-v2", "oem-vehicle-inventory",
      "oem-analytics", "oem-deals", "oem-core", "oem-crm", "oem-template-builder", "dealer-app",
      "stage-gmdrp-dmsv2-drp-cp-frontend-dealer-app-2-0", "stage-gmdrp-dmsv1-dealer-analytics",
      "stage-gmdrp-dmsv1-dealer-accounting", "stage-gmdrp-dmsv1-dealer-app",
      "stage-gmdrp-dmsv1-oem-service", "stage-gmdrp-dmsv1-oem-analytics", "stage-gmdrp-dmsv1-oem-deals",
      "stage-gmdrp-dmsv1-oem-vehicle-inventory", "stage-gmdrp-dmsv1-oem-crm",
      "stage-gmdrp-dmsv1-drp-oem-track", "stage-gmdrp-dmsv1-drp-oem-forms",
      "stage-gmdrp-dmsv1-oem-template-builder",
    ],
    SCX_VULNA: [
      "drp-cp-frontend-commons", "stage-gmdrp-dmsv1-oem-template-builder",
      "stage-gmdrp-dmsv1-drp-oem-forms", "drp-cp-frontend-checkout-drp",
      "aec-cp-fe-chevrolet-checkout-2-0-aecgm",
    ],
  },
});

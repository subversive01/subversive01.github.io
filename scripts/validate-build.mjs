import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const dist = join(root, "dist");
const requiredFiles = [
  "index.html",
  "badge/index.html",
  "projects/index.html",
  "blog/index.html",
  "research/index.html",
  "research/daa/index.html",
  "assets/blog/research-log-og.png",
  "CNAME",
  ".nojekyll",
  "robots.txt",
  "sitemap.xml"
];
const failures = [];
const daaArticleSourcePath = join(root, "src/content/daa/article.md");
const daaIntegrityPath = join(root, "scripts/daa-publication-v6.4.3.integrity.json");
let daaIntegrity = null;

function normalizedArticleBody(source) {
  return source
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n*$/, "\n");
}

if (!existsSync(daaArticleSourcePath) || !existsSync(daaIntegrityPath)) {
  failures.push("DAA canonical article source or integrity record is missing");
} else {
  try {
    daaIntegrity = JSON.parse(readFileSync(daaIntegrityPath, "utf8"));
    const articleBody = normalizedArticleBody(readFileSync(daaArticleSourcePath, "utf8"));
    const articleBodyHash = createHash("sha256").update(articleBody).digest("hex");
    if (articleBodyHash !== daaIntegrity.articleBodySha256) {
      failures.push(
        `DAA canonical body drifted from ${daaIntegrity.paperVersion}: expected ${daaIntegrity.articleBodySha256}, found ${articleBodyHash}. ` +
        `Update the integrity record only after revalidating against canonical PDF ${daaIntegrity.canonicalPdfSha256}`
      );
    }
    const mainHeadings = [...articleBody.matchAll(/^## (?!#)(.+)$/gm)].map((match) => match[1]);
    if (JSON.stringify(mainHeadings) !== JSON.stringify(daaIntegrity.mainHeadings)) {
      failures.push(`DAA main-heading order changed: ${JSON.stringify(mainHeadings)}`);
    }
  } catch (error) {
    failures.push(`DAA integrity record could not be verified: ${error.message}`);
  }
}

for (const file of requiredFiles) {
  if (!existsSync(join(dist, file))) failures.push(`Missing build artifact: ${file}`);
}

if (existsSync(join(dist, "assets/research/daa/three-orthogonal-descriptors.png"))) {
  failures.push("Legacy raster Figure 1 must not ship after the native composition replacement");
}

if (existsSync(join(dist, "orbitaldeck"))) {
  failures.push("Removed OrbitalDeck route is still present in the build");
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = existsSync(dist) ? walk(dist) : [];
const htmlFiles = files.filter((file) => extname(file) === ".html");
const scriptFiles = files.filter((file) => extname(file) === ".js");
const documentFiles = files.filter((file) => [".doc", ".docx"].includes(extname(file).toLowerCase()));
for (const file of documentFiles) {
  failures.push(`editable source document must not be published: ${relative(dist, file)}`);
}
const macosMetadata = files.filter((file) => file.endsWith(".DS_Store"));
for (const file of macosMetadata) {
  failures.push(`macOS metadata must not be published: ${relative(dist, file)}`);
}
const cspRules = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'none'"
];
const publicationSourceHosts = new Set([
  "arxiv.org",
  "assets.anthropic.com",
  "attack.mitre.org",
  "cdn.openai.com",
  "cloud.google.com",
  "csrc.nist.gov",
  "doi.org",
  "dreamgroup.com",
  "gambit.security",
  "genai.owasp.org",
  "huggingface.co",
  "internationalaisafetyreport.org",
  "metr.org",
  "moda.gov.tw",
  "modelcontextprotocol.io",
  "openai.com",
  "opentelemetry.io",
  "research.checkpoint.com",
  "zenodo.org",
  "www.aisi.gov.uk",
  "www.anthropic.com",
  "www.cisa.gov",
  "www.fortinet.com",
  "www.hhs.gov",
  "www.ncsc.gov.uk",
  "www.nist.gov",
  "www.reuters.com"
]);

for (const file of htmlFiles) {
  const name = relative(dist, file);
  const html = readFileSync(file, "utf8");
  for (const rule of cspRules) {
    if (!html.includes(rule)) failures.push(`${name}: missing CSP rule ${rule}`);
  }
  if (!html.includes('name="referrer" content="no-referrer"')) {
    failures.push(`${name}: missing no-referrer policy`);
  }
  if (!html.includes('name="robots" content="index, follow, max-image-preview:large"')) {
    failures.push(`${name}: missing indexable robots policy`);
  }
  if (!html.includes('rel="sitemap" type="application/xml" href="/sitemap.xml"')) {
    failures.push(`${name}: missing sitemap discovery link`);
  }
  for (const metadata of [
    'name="description"',
    'name="author" content="Mario Oliva"',
    'property="og:locale" content="en_US"',
    'property="og:title"',
    'property="og:description"',
    'property="og:url"',
    'property="og:image"',
    'property="og:image:alt"',
    'name="twitter:card" content="summary_large_image"',
    'name="twitter:image:alt"',
    'rel="canonical"'
  ]) {
    if (!html.includes(metadata)) failures.push(`${name}: missing discoverability metadata ${metadata}`);
  }
  if (/<(?:form|iframe|object|embed)\b/i.test(html)) {
    failures.push(`${name}: forbidden active/embed element found`);
  }
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) {
    failures.push(`${name}: inline JavaScript is incompatible with the production CSP`);
  }
  if (/\bsrc="https?:\/\/(?!sbhcsecurity\.com)/i.test(html)) {
    failures.push(`${name}: third-party runtime asset or navigation found`);
  }
  const externalLinks = [...html.matchAll(/\bhref="(https?:\/\/[^\"]+)"/gi)].map((match) => match[1]);
  for (const href of externalLinks) {
    if (
      href.startsWith("https://sbhcsecurity.com") ||
      href === "https://github.com/subversive01/station562-badge" ||
      href === "https://github.com/subversive01/DAA-experimental-evaluation"
    ) continue;
    const sourceUrl = new URL(href);
    if (sourceUrl.protocol === "https:" && publicationSourceHosts.has(sourceUrl.hostname)) continue;
    failures.push(`${name}: external navigation is not allowlisted: ${href}`);
  }
  if (/\b(?:evidence\/|raw[_-]lock\/|api\.anthropic|amazonaws\.com)/i.test(html)) {
    failures.push(`${name}: custody or sensitive operational term leaked into publication output`);
  }
}

const robots = existsSync(join(dist, "robots.txt"))
  ? readFileSync(join(dist, "robots.txt"), "utf8")
  : "";
if (!robots.includes("User-agent: *") || !robots.includes("Allow: /")) {
  failures.push("robots.txt must allow public indexing");
}
if (!robots.includes("Sitemap: https://sbhcsecurity.com/sitemap.xml")) {
  failures.push("robots.txt must advertise the canonical sitemap");
}

const sitemap = existsSync(join(dist, "sitemap.xml"))
  ? readFileSync(join(dist, "sitemap.xml"), "utf8")
  : "";
for (const path of ["/", "/research/", "/research/daa/", "/projects/", "/badge/", "/blog/"]) {
  const url = `https://sbhcsecurity.com${path}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) failures.push(`sitemap is missing: ${url}`);
}
if (!sitemap.includes("<lastmod>2026-08-31</lastmod>")) {
  failures.push("sitemap must expose the latest site update date");
}
for (const imageMarker of [
  'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
  "<image:loc>https://sbhcsecurity.com/assets/blog/research-log-og.png</image:loc>"
]) {
  if (!sitemap.includes(imageMarker)) failures.push(`DAA sitemap image metadata is missing: ${imageMarker}`);
}

for (const file of scriptFiles) {
  const name = relative(dist, file);
  const source = readFileSync(file, "utf8");
  const networkPrimitives = ["fetch(", "XMLHttpRequest", "WebSocket(", "EventSource(", "sendBeacon("];
  for (const primitive of networkPrimitives) {
    if (source.includes(primitive)) failures.push(`${name}: runtime network primitive ${primitive} found`);
  }
  if (/https?:\/\//i.test(source)) failures.push(`${name}: external URL found in runtime JavaScript`);
}

const blogHtml = existsSync(join(dist, "blog/index.html"))
  ? readFileSync(join(dist, "blog/index.html"), "utf8")
  : "";
const researchHtml = existsSync(join(dist, "research/index.html"))
  ? readFileSync(join(dist, "research/index.html"), "utf8")
  : "";
const daaHtml = existsSync(join(dist, "research/daa/index.html"))
  ? readFileSync(join(dist, "research/daa/index.html"), "utf8")
  : "";
const homeHtml = existsSync(join(dist, "index.html"))
  ? readFileSync(join(dist, "index.html"), "utf8")
  : "";
const badgeHtml = existsSync(join(dist, "badge/index.html"))
  ? readFileSync(join(dist, "badge/index.html"), "utf8")
  : "";
const projectsHtml = existsSync(join(dist, "projects/index.html"))
  ? readFileSync(join(dist, "projects/index.html"), "utf8")
  : "";
for (const metadata of [
  '<title>Distributed Agentic Attacks (DAA) — Mario Oliva</title>',
  'name="citation_title" content="Distributed Agentic Attacks: A Proposed Threat Model for Large-Scale Distributed Offensive Agency"',
  'name="citation_author" content="Mario Oliva"',
  'name="citation_publication_date" content="2026/08/28"',
  'name="citation_doi" content="10.5281/zenodo.22150935"',
  'name="citation_technical_report_number" content="Publication Paper v6.4.3"',
  'name="citation_abstract_html_url" content="https://sbhcsecurity.com/research/daa/"',
  'itemscope itemtype="https://schema.org/Article"',
  'itemprop="additionalType" content="https://schema.org/ScholarlyArticle"',
  'itemprop="author" itemscope itemtype="https://schema.org/Person"',
  'itemprop="articleBody"',
  'itemprop="identifier" content="https://doi.org/10.5281/zenodo.22150935"',
  'itemprop="isAccessibleForFree" content="true"'
]) {
  if (!daaHtml.includes(metadata)) failures.push(`DAA scholarly metadata is missing: ${metadata}`);
}
for (const label of [
  "Decision authority / distributed loci",
  "Field evidence / bounded studies",
  "No live-system effects",
  "DAA remains on scientific probation.",
  "Distributed burden premium",
  "Publication Paper v6.4.3",
  "Preprint / not peer reviewed",
  "Research Dossier v4.4.3",
  "Experimental Evidence and Reproducibility Record v1.4.2",
  "H1b produced 18 descriptive block-by-population contrast rows",
  "Author responsibility and AI-tool disclosure",
  "Sources &amp; references"
]) {
  if (!daaHtml.includes(label)) failures.push(`DAA publication identity is missing: ${label}`);
}
for (const artifact of [
  ["https://zenodo.org/records/22150935", "DOI 10.5281/zenodo.22150935"],
  ["https://zenodo.org/records/22150937", "DOI 10.5281/zenodo.22150937"],
  ["https://zenodo.org/records/22150939", "DOI 10.5281/zenodo.22150939"]
]) {
  const [href, doi] = artifact;
  if (!daaHtml.includes(`href="${href}"`)) failures.push(`DAA Zenodo record link is missing: ${href}`);
  if (!daaHtml.includes(doi)) failures.push(`DAA Zenodo DOI is missing: ${doi}`);
}
for (const privateProductionNote of ["Hero animation:", "Visual:", "Animation:", "Graph:", "Timeline:", "Production note:", "Page treatment:", "Final visual:"]) {
  if (daaHtml.includes(privateProductionNote)) failures.push(`Private DAA production note leaked: ${privateProductionNote}`);
}
const daaReferencesPosition = daaHtml.indexOf('class="daa-reference-list"');
const daaReferencesHtml = daaReferencesPosition >= 0 ? daaHtml.slice(daaReferencesPosition) : "";
const daaPaperStart = daaHtml.indexOf('class="daa-paper"');
const daaPaperEnd = daaHtml.indexOf('class="daa-references"');
const daaArtifactsPosition = daaHtml.indexOf('class="daa-artifacts"');
const daaPaperHtml = daaPaperStart >= 0 && daaPaperEnd > daaPaperStart
  ? daaHtml.slice(daaPaperStart, daaPaperEnd)
  : "";
if (!daaHtml.includes('class="button button-primary" href="#abstract"')) {
  failures.push("DAA primary reading action must lead directly to the Abstract");
}
if (daaArtifactsPosition < daaPaperEnd) {
  failures.push("DAA Zenodo artifacts must follow the paper instead of delaying the Abstract");
}
if (!daaPaperHtml.includes('<details class="publication-context">')) {
  failures.push("DAA publication details must remain available in the compact disclosure");
}
if (daaPaperHtml.includes('<details class="publication-context" open')) {
  failures.push("DAA publication details must be collapsed by default");
}
if (daaIntegrity) {
  const renderedTableCount = (daaPaperHtml.match(/<table(?:\s|>)/g) ?? []).length;
  if (renderedTableCount !== daaIntegrity.tableCount) {
    failures.push(`DAA canonical paper must render ${daaIntegrity.tableCount} tables; found ${renderedTableCount}`);
  }
  const figureMarker = `data-publication-figure="${daaIntegrity.figureId}"`;
  const figureCount = daaPaperHtml.split(figureMarker).length - 1;
  if (figureCount !== 1) {
    failures.push(`DAA native Figure 1 must render once; found ${figureCount}`);
  }
  const figureStart = daaPaperHtml.indexOf(figureMarker);
  const figureEnd = figureStart >= 0 ? daaPaperHtml.indexOf("</figure>", figureStart) : -1;
  const figureHtml = figureStart >= 0 && figureEnd > figureStart
    ? daaPaperHtml.slice(figureStart, figureEnd)
    : "";
  if (/<img\b/.test(figureHtml)) {
    failures.push("DAA native Figure 1 must not fall back to a raster image");
  }
  for (const descriptor of daaIntegrity.figureDescriptors ?? []) {
    if (!figureHtml.includes(`<dt>${descriptor.label}</dt>`)) {
      failures.push(`DAA Figure 1 descriptor label is missing or changed: ${descriptor.label}`);
    }
    if (!figureHtml.includes(`<dd>${descriptor.definition}</dd>`)) {
      failures.push(`DAA Figure 1 descriptor definition is missing or changed: ${descriptor.label}`);
    }
  }
  if (!figureHtml.includes(`<strong>${daaIntegrity.figureRuleLabel}</strong> ${daaIntegrity.figureRuleText}`)) {
    failures.push("DAA Figure 1 orthogonality rule is missing or changed");
  }
  if (!daaPaperHtml.includes(daaIntegrity.figureCaption)) {
    failures.push("DAA canonical Figure 1 caption is missing or changed");
  }
}
const sourcesNavigationLinks = daaPaperHtml.match(/href="#sources-heading"/g) ?? [];
if (sourcesNavigationLinks.length !== 2) {
  failures.push(`DAA desktop and mobile indexes must each link to Sources & references; found ${sourcesNavigationLinks.length}`);
}
for (let referenceNumber = 1; referenceNumber <= 56; referenceNumber += 1) {
  if (!daaReferencesHtml.includes(`[${referenceNumber}]`)) failures.push(`DAA reference missing: [${referenceNumber}]`);
}
const linkedPaperCitations = [...daaPaperHtml.matchAll(/data-citation="(\d+)"/g)].map((match) => Number(match[1]));
const linkedReferenceNumbers = [...daaReferencesHtml.matchAll(/data-citation="(\d+)"/g)].map((match) => Number(match[1]));
if (linkedPaperCitations.length !== 97) {
  failures.push(`DAA paper must render 97 public citation links; found ${linkedPaperCitations.length}`);
}
if (linkedReferenceNumbers.length !== 47) {
  failures.push(`DAA bibliography must render 47 linked public reference numbers; found ${linkedReferenceNumbers.length}`);
}
for (const privateReferenceNumber of [39, 40, 41, 42, 43, 44, 45, 46, 56]) {
  if (linkedPaperCitations.includes(privateReferenceNumber) || linkedReferenceNumbers.includes(privateReferenceNumber)) {
    failures.push(`Private DAA reference must remain unlinked: [${privateReferenceNumber}]`);
  }
}
if (daaPaperHtml.includes('target="_blank"') || daaReferencesHtml.includes('target="_blank"')) {
  failures.push("DAA source links must preserve user-controlled navigation");
}
for (const stalePublicationMarker of ["Publication Paper v6.4.2", "Research Dossier v4.4.2", "Reproducibility Record v1.4.1"]) {
  if (daaHtml.includes(stalePublicationMarker)) failures.push(`Stale DAA publication marker remains: ${stalePublicationMarker}`);
}

if (!homeHtml.includes("Cybersecurity / field notes") || !homeHtml.includes("Systems · hardware · art")) {
  failures.push("Home authority-field identity is missing");
}
if (!homeHtml.includes("SBHC SECURITY") || !homeHtml.includes(">RESEARCH</span>")) {
  failures.push("Home research headline is missing");
}
if (homeHtml.includes("Authority leaves a trace")) {
  failures.push("Retired Home headline is still present");
}
for (const archivedSection of ["01 / Practice", "02 / Current dossier", "03 / Operating boundary"]) {
  if (homeHtml.includes(archivedSection)) {
    failures.push(`Archived Home section is still rendered: ${archivedSection}`);
  }
}
for (const label of ["STATION 562", "FIRMWARE / HARDWARE CTF", "ESP32-C3 / C6", "V6.3.0", "https://github.com/subversive01/station562-badge"]) {
  if (!badgeHtml.includes(label)) failures.push(`Badge page identity is missing: ${label}`);
}
for (const label of ["PROJECTS", "Software / security / hardware", "Builds / experiments / releases", "Station 562", "/badge/"]) {
  if (!projectsHtml.includes(label)) failures.push(`Projects page identity is missing: ${label}`);
}
if (projectsHtml.includes("/assets/badge/") || projectsHtml.includes("station-visual")) {
  failures.push("Projects index must not render badge imagery");
}
for (const label of ["RESEARCH", "Cybersecurity / formal research", "Methods / evidence / limitations", "Distributed Agentic Attacks", "/research/daa/"]) {
  if (!researchHtml.includes(label)) failures.push(`Research index identity is missing: ${label}`);
}
for (const removedResearchCopy of ["Research journal / DAA first", "Programs &amp; notes", "Each entry keeps its scope"]) {
  if (researchHtml.includes(removedResearchCopy)) failures.push(`Removed Research heading is still rendered: ${removedResearchCopy}`);
}
for (const label of ["Home", "Research", "Projects", "Blog"]) {
  if (!homeHtml.includes(`>${label}</a>`)) failures.push(`Primary navigation is missing: ${label}`);
}
for (const label of ["BLOG", "Personal notes / Los Angeles", "Personal notes / field observations", "Security / systems / hardware / art"]) {
  if (!blogHtml.includes(label)) failures.push(`Personal blog identity is missing: ${label}`);
}
if (blogHtml.includes("Things I’m thinking about") || blogHtml.includes("Less formal than the")) {
  failures.push("Removed Blog introduction is still rendered");
}
for (const removedBlogCopy of ["Notes / newest first", "From the notebook", "The notebook is open.", "The first informal entry will land here."]) {
  if (blogHtml.includes(removedBlogCopy)) failures.push(`Removed Blog placeholder is still rendered: ${removedBlogCopy}`);
}
for (const retiredCornerLabel of [
  "Authority field / symbolic",
  "Local render / no telemetry",
  "Research index / local",
  "Deterministic field / no telemetry",
  "Project circuit / local",
  "Pointer reactive / no telemetry",
  "Notebook field / local",
  "Generative margins / no telemetry",
  "SBHC / HARDWARE"
]) {
  if ([daaHtml, researchHtml, projectsHtml, blogHtml, badgeHtml].some((html) => html.includes(retiredCornerLabel))) {
    failures.push(`Retired decorative corner label remains: ${retiredCornerLabel}`);
  }
}
if (!researchHtml.includes(">Home</a>")) {
  failures.push("Primary navigation does not label the root page Home");
}
if ([homeHtml, daaHtml, researchHtml, projectsHtml, blogHtml, badgeHtml].some((html) => html.includes("Runtime network") || html.includes(">Disabled</dd>"))) {
  failures.push("Retired network status footer item must not render on any page");
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Validated ${htmlFiles.length} static pages and ${scriptFiles.length} local script bundles.`);

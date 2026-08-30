const citationSources = new Map([
  [1, ["https://csrc.nist.gov/glossary/term/botnet", "NIST botnet glossary"]],
  [2, ["https://doi.org/10.17487/RFC4732", "RFC 4732 denial-of-service considerations"]],
  [3, ["https://www.anthropic.com/news/disrupting-AI-espionage", "Anthropic AI-orchestrated cyber-espionage report"]],
  [4, ["https://arxiv.org/abs/2606.03811", "AI Agents Enable Adaptive Computer Worms"]],
  [5, ["https://arxiv.org/abs/2605.31593", "Stateful Online Monitoring Catches Distributed Agent Attacks"]],
  [6, ["https://arxiv.org/abs/2607.07368", "Multi-Agent AI Control"]],
  [7, ["https://arxiv.org/abs/2607.07433", "Beware of Agentic Botnets"]],
  [8, ["https://arxiv.org/abs/2603.11528", "Highly Autonomous Cyber-Capable Agents"]],
  [9, ["https://huggingface.co/blog/agent-intrusion-technical-timeline", "Hugging Face incident technical timeline"]],
  [10, ["https://openai.com/index/hugging-face-model-evaluation-security-incident/", "OpenAI and Hugging Face security-incident statement"]],
  [11, ["https://dreamgroup.com/blog/inside-a-multi-agent-ai-framework-used-to-compromise-government-entities-in-asia", "Dream multi-agent framework report"]],
  [12, ["https://moda.gov.tw/ACS/press/news/press/20394", "Taiwan Ministry of Digital Affairs incident statement"]],
  [13, ["https://www.reuters.com/world/china/taiwan-says-it-was-targeted-last-month-ai-driven-hacking-campaign-2026-08-13/", "Reuters Taiwan AI-driven hacking report"]],
  [14, ["https://www.aisi.gov.uk/blog/incident-report-unsanctioned-agent-behaviour-during-cyber-testing", "UK AI Security Institute incident report"]],
  [15, ["https://cloud.google.com/blog/topics/threat-intelligence/distillation-experimentation-integration-ai-adversarial-use", "Google Threat Intelligence AI threat tracker"]],
  [16, ["https://cloud.google.com/blog/topics/threat-intelligence/ai-vulnerability-exploitation-initial-access", "Google Threat Intelligence AI exploitation report"]],
  [17, ["https://www.ncsc.gov.uk/report/impact-ai-cyber-threat-now-2027", "UK NCSC AI cyber-threat report"]],
  [18, ["https://internationalaisafetyreport.org/publication/international-ai-safety-report-2026", "International AI Safety Report 2026"]],
  [19, ["https://www.fortinet.com/blog/business-and-technology/fortinet-fortiguard-2018-threat-landscape-predictions", "Fortinet 2018 threat-landscape predictions"]],
  [20, ["https://arxiv.org/abs/2505.02077", "Open Challenges in Multi-Agent Security"]],
  [21, ["https://www.nist.gov/news-events/news/2026/02/announcing-ai-agent-standards-initiative-interoperable-and-secure", "NIST AI Agent Standards Initiative"]],
  [22, ["https://csrc.nist.gov/pubs/other/2026/02/05/accelerating-the-adoption-of-software-and-ai-agent/ipd", "NIST agent identity and authorization concept paper"]],
  [23, ["https://modelcontextprotocol.io/specification/2026-07-28", "Model Context Protocol specification"]],
  [24, ["https://opentelemetry.io/blog/2026/genai-observability/", "OpenTelemetry GenAI observability"]],
  [25, ["https://www.cisa.gov/news-events/cybersecurity-advisories/aa25-239a", "CISA advisory AA25-239A"]],
  [26, ["https://genai.owasp.org/2026/05/13/memory-is-a-feature-it-is-also-an-attack-surface/", "OWASP GenAI memory attack-surface article"]],
  [27, ["https://www.cisa.gov/news-events/alerts/2020/12/13/active-exploitation-solarwinds-software", "CISA SolarWinds alert"]],
  [28, ["https://www.hhs.gov/about/agencies/asl/testimony/2023/05/2023/protecting-critical-infrastructure-from-cyberattacks.html", "HHS healthcare cybersecurity testimony"]],
  [29, ["https://www.cisa.gov/resources-tools/resources/stopransomware-guide", "CISA StopRansomware Guide"]],
  [30, ["https://doi.org/10.1145/997150.997156", "Taxonomy of DDoS attack and defense mechanisms"]],
  [31, ["https://doi.org/10.1016/j.jestch.2020.05.002", "DDoS attack-detection study"]],
  [32, ["https://gambit.security/blog-posts/a-single-operator-two-ai-platforms-nine-government-agencies-the-full-technical-report", "Gambit Security technical report"]],
  [33, ["https://research.checkpoint.com/2026/ai-security-report-2026/", "Check Point AI Security Report 2026"]],
  [34, ["https://doi.org/10.1007/978-1-4471-2265-4", "Distributed Decision Making and Control"]],
  [35, ["https://doi.org/10.1007/978-1-84628-982-8_5", "Decentralized Decision Making for Multiagent Systems"]],
  [36, ["https://arxiv.org/abs/2604.18718", "Optimal agentic architectures for offensive-security tasks"]],
  [37, ["https://doi.org/10.1038/s42256-026-01268-y", "Language-model collaboration study"]],
  [38, ["https://arxiv.org/abs/2604.02460", "Single-agent and multi-agent reasoning comparison"]],
  [47, ["https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/", "METR OpenAI and Hugging Face incident investigation"]],
  [48, ["https://openai.com/index/hugging-face-incident-and-the-road-ahead/", "OpenAI Hugging Face incident review"]],
  [49, ["https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf", "OpenAI Hugging Face incident technical report"]],
  [50, ["https://arxiv.org/abs/2605.11086", "ExploitGym"]],
  [51, ["https://assets.anthropic.com/m/ec212e6566a0d47/original/Disrupting-the-first-reported-AI-orchestrated-cyber-espionage-campaign.pdf", "Anthropic full cyber-espionage report"]],
  [52, ["https://attack.mitre.org/campaigns/C0062/", "MITRE ATT&CK Campaign C0062"]],
  [53, ["https://arxiv.org/abs/2406.01637", "Teams of LLM Agents can Exploit Zero-Day Vulnerabilities"]],
  [54, ["https://arxiv.org/abs/2508.20816", "Multi-Agent Penetration Testing AI for the Web"]],
  [55, ["https://arxiv.org/abs/2605.08763", "Coordinated attack framework for automated cyber intrusions"]]
]);

const citationPattern = /\[(\d{1,2})\]/g;
const skippedAncestors = new Set(["code", "definition", "html", "inlineCode", "link", "linkReference"]);

function isDaaPublication(fileURL) {
  const path = decodeURIComponent(fileURL?.pathname ?? "").replaceAll("\\", "/");
  return path.endsWith("/src/content/daa/article.md") || path.endsWith("/src/content/daa/references.md");
}

function isInsideSkippedNode(node, context) {
  let parent = context.parent(node);
  while (parent) {
    if (skippedAncestors.has(parent.type)) return true;
    parent = context.parent(parent);
  }
  return false;
}

function linkedCitation(number, url, label) {
  return {
    type: "link",
    url,
    title: `Reference ${number}: ${label}`,
    data: {
      hProperties: {
        className: ["citation-link"],
        "data-citation": String(number),
        "aria-label": `Reference ${number}: ${label}`,
        rel: "external"
      }
    },
    children: [{ type: "text", value: `[${number}]` }]
  };
}

function linkTextCitations(value) {
  const children = [];
  let cursor = 0;

  for (const match of value.matchAll(citationPattern)) {
    const start = match.index ?? 0;
    const number = Number(match[1]);
    const source = citationSources.get(number);
    if (start > cursor) children.push({ type: "text", value: value.slice(cursor, start) });
    children.push(source ? linkedCitation(number, source[0], source[1]) : { type: "text", value: match[0] });
    cursor = start + match[0].length;
  }

  if (cursor === 0) return null;
  if (cursor < value.length) children.push({ type: "text", value: value.slice(cursor) });
  return children;
}

export default function daaCitationLinks(document) {
  if (!isDaaPublication(document.fileURL) || !document.source.includes("[")) return null;

  return {
    name: "sbhc-daa-citation-links",
    text(node, context) {
      if (!node.value.includes("[") || isInsideSkippedNode(node, context)) return;
      const replacement = linkTextCitations(node.value);
      if (replacement) context.replaceNode(node, replacement);
    }
  };
}

export type VisualRole = "principal" | "lane" | "defender" | "objective";
export type LinkKind = "authority" | "observation" | "attempt";
export type PulseKind = "decision" | "attempt" | "intervention";

export type VisualProvenanceV1 =
  | {
      kind: "synthetic_placeholder";
      visibleLabel: "ILLUSTRATIVE MOCK DATA";
      sourceManifestSha256: null;
      sourceSchemas: [];
      rawProviderResponsesIncluded: false;
    }
  | {
      kind: "sanitized_public_export";
      visibleLabel: "SANITIZED MEASURED DATA";
      sourceManifestSha256: string;
      sourceSchemas: string[];
      rawProviderResponsesIncluded: false;
    };

export interface VisualNodeV1 {
  id: string;
  label: string;
  role: VisualRole;
  x: number;
  y: number;
}

export interface VisualLinkV1 {
  id: string;
  from: string;
  to: string;
  kind: LinkKind;
}

export interface VisualPulseV1 {
  linkId: string;
  step: number;
  kind: PulseKind;
  intensity: number;
}

export interface BlogVisualDataV1 {
  schemaVersion: "sbhc.daa.visual.v1";
  provenance: VisualProvenanceV1;
  scene: {
    id: string;
    representation: "illustrative_symbolic";
    coordinateSystem: "normalized_abstract";
    seed: number;
    steps: number;
    nodes: VisualNodeV1[];
    links: VisualLinkV1[];
    pulses: VisualPulseV1[];
  };
}

export const theaterDemo: BlogVisualDataV1 = {
  schemaVersion: "sbhc.daa.visual.v1",
  provenance: {
    kind: "synthetic_placeholder",
    visibleLabel: "ILLUSTRATIVE MOCK DATA",
    sourceManifestSha256: null,
    sourceSchemas: [],
    rawProviderResponsesIncluded: false
  },
  scene: {
    id: "demo-theater-001",
    representation: "illustrative_symbolic",
    coordinateSystem: "normalized_abstract",
    seed: 562,
    steps: 12,
    nodes: [
      { id: "d0", label: "D-00", role: "defender", x: 0.51, y: 0.5 },
      { id: "o1", label: "O-01", role: "objective", x: 0.48, y: 0.23 },
      { id: "o2", label: "O-02", role: "objective", x: 0.71, y: 0.43 },
      { id: "o3", label: "O-03", role: "objective", x: 0.58, y: 0.74 },
      { id: "o4", label: "O-04", role: "objective", x: 0.29, y: 0.61 },
      { id: "p1", label: "P-01", role: "principal", x: 0.1, y: 0.22 },
      { id: "p2", label: "P-02", role: "principal", x: 0.19, y: 0.43 },
      { id: "p3", label: "P-03", role: "principal", x: 0.13, y: 0.74 },
      { id: "p4", label: "P-04", role: "principal", x: 0.34, y: 0.84 },
      { id: "p5", label: "P-05", role: "principal", x: 0.79, y: 0.17 },
      { id: "p6", label: "P-06", role: "principal", x: 0.9, y: 0.35 },
      { id: "p7", label: "P-07", role: "principal", x: 0.87, y: 0.68 },
      { id: "p8", label: "P-08", role: "principal", x: 0.74, y: 0.86 }
    ],
    links: [
      { id: "l1", from: "p1", to: "o1", kind: "attempt" },
      { id: "l2", from: "p2", to: "o4", kind: "attempt" },
      { id: "l3", from: "p3", to: "o4", kind: "attempt" },
      { id: "l4", from: "p4", to: "o3", kind: "attempt" },
      { id: "l5", from: "p5", to: "o2", kind: "attempt" },
      { id: "l6", from: "p6", to: "o2", kind: "attempt" },
      { id: "l7", from: "p7", to: "o3", kind: "attempt" },
      { id: "l8", from: "p8", to: "o3", kind: "attempt" },
      { id: "l9", from: "d0", to: "o1", kind: "observation" },
      { id: "l10", from: "d0", to: "o2", kind: "observation" },
      { id: "l11", from: "d0", to: "o3", kind: "observation" },
      { id: "l12", from: "d0", to: "o4", kind: "observation" }
    ],
    pulses: [
      { linkId: "l1", step: 0, kind: "decision", intensity: 0.72 },
      { linkId: "l5", step: 0, kind: "decision", intensity: 0.84 },
      { linkId: "l2", step: 1, kind: "attempt", intensity: 0.66 },
      { linkId: "l7", step: 1, kind: "attempt", intensity: 0.92 },
      { linkId: "l3", step: 2, kind: "attempt", intensity: 0.74 },
      { linkId: "l6", step: 2, kind: "attempt", intensity: 0.83 },
      { linkId: "l9", step: 3, kind: "intervention", intensity: 1 },
      { linkId: "l11", step: 3, kind: "intervention", intensity: 0.88 },
      { linkId: "l4", step: 4, kind: "decision", intensity: 0.76 },
      { linkId: "l8", step: 4, kind: "decision", intensity: 0.91 },
      { linkId: "l1", step: 5, kind: "attempt", intensity: 0.82 },
      { linkId: "l5", step: 5, kind: "attempt", intensity: 0.93 },
      { linkId: "l10", step: 6, kind: "intervention", intensity: 1 },
      { linkId: "l12", step: 6, kind: "intervention", intensity: 0.87 },
      { linkId: "l2", step: 7, kind: "decision", intensity: 0.72 },
      { linkId: "l6", step: 7, kind: "attempt", intensity: 0.86 },
      { linkId: "l3", step: 8, kind: "attempt", intensity: 0.69 },
      { linkId: "l7", step: 8, kind: "attempt", intensity: 0.96 },
      { linkId: "l9", step: 9, kind: "intervention", intensity: 0.94 },
      { linkId: "l11", step: 9, kind: "intervention", intensity: 0.9 },
      { linkId: "l4", step: 10, kind: "decision", intensity: 0.78 },
      { linkId: "l8", step: 10, kind: "attempt", intensity: 0.88 },
      { linkId: "l10", step: 11, kind: "intervention", intensity: 1 },
      { linkId: "l12", step: 11, kind: "intervention", intensity: 0.93 }
    ]
  }
};

export function assertVisualDataV1(data: BlogVisualDataV1): void {
  const { nodes, links, pulses, steps } = data.scene;
  if (data.schemaVersion !== "sbhc.daa.visual.v1") throw new Error("Unsupported visual schema");
  if (data.provenance.rawProviderResponsesIncluded) throw new Error("Raw provider responses are forbidden");
  if (data.provenance.kind === "synthetic_placeholder") {
    if (data.provenance.sourceManifestSha256 !== null || data.provenance.sourceSchemas.length !== 0) {
      throw new Error("Synthetic visuals cannot claim measured provenance");
    }
  } else {
    if (!/^[a-f0-9]{64}$/.test(data.provenance.sourceManifestSha256)) {
      throw new Error("Measured visuals require an exact public manifest SHA-256");
    }
    if (data.provenance.sourceSchemas.length < 1 || data.provenance.sourceSchemas.length > 16) {
      throw new Error("Measured visuals require bounded source schema identities");
    }
    if (data.provenance.sourceSchemas.some((schema) => !/^[a-z0-9._-]{1,120}$/.test(schema))) {
      throw new Error("Invalid source schema identity");
    }
  }
  if (nodes.length > 256 || links.length > 512 || pulses.length > 2000) throw new Error("Visual data exceeds limits");
  if (!Number.isInteger(steps) || steps < 1 || steps > 120) throw new Error("Invalid visual step count");

  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) throw new Error("Duplicate visual node ID");
  for (const node of nodes) {
    if (!/^[a-z0-9-]{1,24}$/.test(node.id) || !/^[A-Z0-9-]{1,16}$/.test(node.label)) {
      throw new Error("Invalid bounded node identity");
    }
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || node.x < 0 || node.x > 1 || node.y < 0 || node.y > 1) {
      throw new Error(`Invalid normalized coordinate: ${node.id}`);
    }
  }
  for (const link of links) {
    if (!ids.has(link.from) || !ids.has(link.to)) throw new Error(`Unknown link endpoint: ${link.id}`);
  }
  const linkIds = new Set(links.map((link) => link.id));
  if (linkIds.size !== links.length) throw new Error("Duplicate visual link ID");
  for (const pulse of pulses) {
    if (
      !linkIds.has(pulse.linkId)
      || !Number.isInteger(pulse.step)
      || pulse.step < 0
      || pulse.step >= steps
      || !Number.isFinite(pulse.intensity)
      || pulse.intensity < 0
      || pulse.intensity > 1
    ) throw new Error("Invalid pulse");
  }
}

assertVisualDataV1(theaterDemo);

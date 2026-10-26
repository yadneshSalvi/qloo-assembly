import { randomUUID } from "node:crypto";
import { createWorkspace, concepts } from "@assembly/domain";
import type { ResearchEvidence } from "@assembly/contracts";

/** Synthetic saved output from the earlier copy format; never a provider fixture. */
export function presentationFixture() {
  const workspace = createWorkspace(randomUUID());
  workspace.suppliers[0].name = "Synthetic Sound Collective";
  workspace.suppliers[0].discipline = "Listening session";
  workspace.suppliers[1].name = "Synthetic Supper Table";
  const concept = structuredClone(concepts[0]);
  concept.title = "A Shared Frequency";
  concept.origin = "MODEL_HYPOTHESIS";
  concept.supplierIds = [workspace.suppliers[0].id];
  concept.composition = {
    format: "listening",
    inventoryIds: [...concept.supplierIds],
    culturalReferences: [
      {
        evidenceId: "synthetic-cultural-source",
        entityId: "11111111-1111-4111-8111-111111111111",
        purpose: "atmosphere",
      },
    ],
  };
  concept.evidenceIds = ["synthetic-cultural-source"];
  concept.description =
    "Proposed a listening-led gathering. Repeated legacy offer and reference copy.";
  concept.ingredients = [
    "Proposed operator offer: Synthetic Sound Collective (Listening session)",
    "Quoted supply and supplied overhead: 116400 GBP minor units at capacity.",
  ];
  const evidence: ResearchEvidence = {
    id: "synthetic-cultural-source",
    title: "Synthetic cultural discovery",
    origin: "QLOO_RESULT",
    body: "Synthetic test evidence. No provider request was made.",
    source: "Synthetic transport for presentation tests",
    capturedAt: "2026-10-27T00:00:00.000Z",
    boundary: "Test data only; no availability, rights or demand claim.",
    category: "artist",
    entityIds: ["11111111-1111-4111-8111-111111111111"],
    queryFingerprint: "synthetic-fingerprint",
    transport: "LIVE",
    purpose: "DISCOVERY",
    rankings: [
      {
        entityId: "11111111-1111-4111-8111-111111111111",
        name: "Synthetic Cultural Reference",
        position: 1,
        affinity: null,
      },
    ],
  };
  workspace.evidence.push(evidence);
  workspace.concepts = [concept];
  workspace.event.lifecycle = "CONCEPT_READY";
  workspace.qloo = {
    ...workspace.qloo,
    status: "LIVE",
    message: "Synthetic presentation fixture; no provider request.",
  };
  return workspace;
}

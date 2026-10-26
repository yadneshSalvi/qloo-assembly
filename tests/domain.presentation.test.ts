import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { presentConcept } from "@assembly/contracts";
import {
  applyAction,
  concepts,
  hashTerms,
  publicEvent,
} from "@assembly/domain";
import { presentationFixture } from "./fixtures/concept-presentation";

describe("saved generated concept presentation", () => {
  it("renders legacy saved concepts from known records without repeating costs or names", () => {
    const w = presentationFixture();
    const before = JSON.stringify(w);
    const copy = presentConcept(w.concepts[0], w.suppliers, w.evidence);
    expect(copy.description).toMatch(/^A proposed evening/);
    expect(copy.ingredients).toEqual([
      "Synthetic Sound Collective (Listening session)",
      "Atmosphere reference: Synthetic Cultural Reference (artist)",
    ]);
    expect(copy.program.match(/Synthetic Sound Collective/g)).toHaveLength(1);
    expect(copy.program).toContain(
      "Supply, scope and permissions need separate confirmation.",
    );
    expect(JSON.stringify(copy)).not.toMatch(/minor units|116400|Proposed a/);
    expect(JSON.stringify(w)).toBe(before);
  });

  it("creates fresh exact terms only through explicit selection and preserves stored evidence", () => {
    const w = presentationFixture();
    const originalEvidence = structuredClone(w.evidence);
    const version = w.terms.version;
    applyAction(
      { workspace: w, contactDigests: {} },
      {
        type: "SELECT_CONCEPT",
        payload: { conceptId: w.concepts[0].id },
        expectedVersion: w.version,
        idempotencyKey: randomUUID(),
      },
    );
    expect(w.terms.program).toContain("Proposed listening gathering.");
    expect(w.terms.program).toContain("Synthetic Cultural Reference");
    expect(w.terms.program.match(/Synthetic Sound Collective/g)).toHaveLength(
      1,
    );
    expect(w.terms.program).not.toContain("minor units");
    expect(w.terms.version).toBe(version + 1);
    expect(w.terms.hash).toBe(hashTerms(w.terms));
    expect(w.evidence).toEqual(originalEvidence);
    expect(w.concepts[0].ingredients.join(" ")).toContain("minor units");
  });

  it("keeps already approved terms unchanged when projecting the public view", () => {
    const w = presentationFixture();
    w.event.selectedConceptId = w.concepts[0].id;
    w.terms.program = "An already approved program, kept exactly as recorded.";
    w.terms.hash = hashTerms(w.terms);
    const before = JSON.stringify(w);
    const view = publicEvent(w);
    expect(view.concept?.description).toMatch(/^A proposed evening/);
    expect(view.concept?.ingredients.join(" ")).not.toContain("minor units");
    expect(view.terms).toEqual(w.terms);
    expect(JSON.stringify(w)).toBe(before);
    expect(JSON.stringify(view.concept)).not.toContain("11111111-");
  });

  it("presents current replacement supply while retaining the original research composition", () => {
    const w = presentationFixture();
    const concept = w.concepts[0];
    const composition = structuredClone(concept.composition);
    const replacement = w.suppliers[1];
    concept.supplierIds = [replacement.id];
    w.event.selectedConceptId = concept.id;
    const copy = presentConcept(concept, w.suppliers, w.evidence);
    expect(copy.program).toContain("Synthetic Supper Table");
    expect(copy.program).not.toContain("Synthetic Sound Collective");
    expect(publicEvent(w).concept?.ingredients[0]).toContain(
      "Synthetic Supper Table",
    );
    expect(concept.composition).toEqual(composition);
  });

  it("does not resurrect unresolvable reference prose and leaves authored copy unchanged", () => {
    const w = presentationFixture();
    const copy = presentConcept(w.concepts[0], w.suppliers, []);
    expect(copy.ingredients).toEqual([
      "Synthetic Sound Collective (Listening session)",
    ]);
    const authored = concepts[0];
    const authoredCopy = presentConcept(authored, w.suppliers, w.evidence);
    expect(authoredCopy.description).toBe(authored.description);
    expect(authoredCopy.ingredients).toEqual(authored.ingredients);
  });
});

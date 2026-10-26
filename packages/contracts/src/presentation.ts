import type { Concept, Evidence, Supplier } from "./index";
import type {
  CulturalType,
  ResearchComposition,
  ResearchEvidence,
} from "./research";

const descriptions = {
  listening:
    "A proposed evening of shared listening, with space to linger and exchange impressions.",
  conversation:
    "A proposed evening built around shared ideas and unhurried conversation.",
  participatory:
    "A proposed evening for taking part, sharing ideas and making connections.",
} as const;
const formats = {
  listening: "listening gathering",
  conversation: "conversation gathering",
  participatory: "participatory gathering",
} as const;
const purposes = {
  atmosphere: "Atmosphere reference",
  conversation: "Conversation prompt",
  participation: "Creative prompt",
} as const;

/** Public wording is assembled from known records; costs have their own worksheet. */
export function composeConceptCopy(input: {
  format: ResearchComposition["format"];
  offers: readonly { name: string; role: string }[];
  references: readonly {
    name: string;
    category: CulturalType;
    purpose: ResearchComposition["culturalReferences"][number]["purpose"];
  }[];
}) {
  const offers = input.offers.map((offer) => `${offer.name} (${offer.role})`);
  const references = input.references.map(
    (reference) =>
      `${purposes[reference.purpose]}: ${reference.name} (${reference.category === "movie" ? "film" : reference.category})`,
  );
  return {
    description: descriptions[input.format],
    ingredients: [...offers, ...references],
    program: [
      `Proposed ${formats[input.format]}.`,
      ...(offers.length
        ? [`Offers under consideration: ${offers.join("; ")}.`]
        : []),
      ...references.map((reference) => `${reference}.`),
      "Cultural references are creative inspiration. Supply, scope and permissions need separate confirmation.",
    ].join(" "),
  };
}

/** Keep original research composition intact, but show current approved supply. */
export function presentConcept(
  concept: Concept,
  suppliers: readonly Pick<Supplier, "id" | "name" | "discipline">[],
  evidence: readonly Evidence[],
) {
  const currentOffers = concept.supplierIds.flatMap((id) => {
    const offer = suppliers.find((supplier) => supplier.id === id);
    return offer ? [{ name: offer.name, role: offer.discipline }] : [];
  });
  if (concept.origin !== "MODEL_HYPOTHESIS" || !concept.composition)
    return {
      description: concept.description,
      ingredients: [...concept.ingredients],
      program: `${currentOffers.map((offer) => offer.name).join(" · ")} — ${concept.ingredients.join(" · ")}`,
    };
  const references = concept.composition.culturalReferences.flatMap(
    (reference) => {
      const source = evidence.find(
        (item): item is ResearchEvidence =>
          item.id === reference.evidenceId &&
          item.origin === "QLOO_RESULT" &&
          "rankings" in item &&
          Array.isArray(item.rankings),
      );
      const entity = source?.rankings.find(
        (item) => item.entityId === reference.entityId,
      );
      return source && entity
        ? [
            {
              name: entity.name,
              category: source.category,
              purpose: reference.purpose,
            },
          ]
        : [];
    },
  );
  return composeConceptCopy({
    format: concept.composition.format,
    offers: currentOffers,
    references,
  });
}

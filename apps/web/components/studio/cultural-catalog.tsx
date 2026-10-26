"use client";
import { useState } from "react";
import {
  AudioLines,
  BookOpen,
  Check,
  Globe2,
  Link2,
  Search,
  X,
} from "lucide-react";
import {
  CULTURAL_TYPES,
  type CatalogCandidate,
  type CulturalType,
  type SupplierInfluence,
} from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Badge, Button } from "../ui";
const typeLabels: Record<CulturalType, string> = {
  artist: "Artist",
  movie: "Film",
  book: "Book",
  person: "Person",
  brand: "Brand",
  place: "Place",
};
export function CulturalCatalog({ locked = false }: { locked?: boolean }) {
  const { workspace: w, act, busy } = useWorkspace();
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState<CulturalType>("artist");
  const [supplierId, setSupplierId] = useState("");
  if (!w) return null;
  const research = w.research,
    search = research?.search;
  const anchors = research?.anchors || [],
    influences = research?.influences || [];
  const searching = search?.status === "QUEUED" || search?.status === "RUNNING";
  const running = w.run?.status === "QUEUED" || w.run?.status === "RUNNING";
  const candidates = search?.candidates || [];
  const prior = research?.catalogHistory?.flatMap((s) => s.candidates) || [];
  const suggestions = candidates.length
    ? candidates
    : [...new Map(prior.map((c) => [c.entityId, c])).values()].slice(-10);
  async function select(
    nextAnchors: CatalogCandidate[],
    nextInfluences: SupplierInfluence[] = influences,
  ) {
    await act("SELECT_ANCHORS", {
      anchors: nextAnchors,
      influences: nextInfluences,
      targetTypes: research?.targetTypes || ["artist", "movie", "book"],
    });
  }
  return (
    <div className="cultural-catalog">
      <div className="catalog-heading">
        <div>
          <div className="eyebrow">
            <Globe2 size={13} />
            LIVE CULTURAL CATALOG
          </div>
          <h3>Names become real starting points.</h3>
        </div>
        <Badge tone={anchors.length ? "positive" : "neutral"}>
          {anchors.length} confirmed
        </Badge>
      </div>
      <p className="field-hint">
        Choose the exact artist, film, person or place you mean. A shared name
        is not enough. Your selections ground the live producer.
      </p>
      <div className="catalog-search">
        <label className="field">
          <span className="sr-only">Catalog category</span>
          <select
            value={entityType}
            disabled={locked || running}
            onChange={(e) => setEntityType(e.target.value as CulturalType)}
          >
            {CULTURAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="sr-only">Search cultural catalog</span>
          <input
            maxLength={200}
            value={query}
            disabled={locked || running}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              entityType === "artist"
                ? "Khruangbin, Cleo Sol…"
                : entityType === "person"
                  ? "Wong Kar-wai, Yotam Ottolenghi…"
                  : `Search a ${typeLabels[entityType].toLowerCase()}…`
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (query.trim().length >= 2)
                  void act("SEARCH_CATALOG", { query, entityType });
              }
            }}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          busy={searching || busy === "SEARCH_CATALOG"}
          disabled={locked || running || query.trim().length < 2}
          onClick={() => void act("SEARCH_CATALOG", { query, entityType })}
        >
          <Search size={16} />
          Search
        </Button>
      </div>
      {searching ? (
        <div className="catalog-status" role="status">
          Searching Qloo’s {typeLabels[search!.entityType].toLowerCase()}{" "}
          catalog for “{search!.query}”… Your saved brief stays here.
          <Button
            type="button"
            variant="ghost"
            busy={busy === "CANCEL_RESEARCH"}
            onClick={() => void act("CANCEL_RESEARCH")}
          >
            Cancel search
          </Button>
        </div>
      ) : search?.status === "FAILED" ? (
        <div className="catalog-status warning-text" role="alert">
          {search.error} No example was substituted. Change the query or retry
          when the service is ready.
        </div>
      ) : search?.status === "EMPTY" ? (
        <div className="catalog-status">
          No exact catalog matches. Try the full name or another category. You
          can keep an editorial note without treating it as a Qloo entity.
        </div>
      ) : null}
      {suggestions.length > 0 && !searching ? (
        <div className="catalog-results">
          <div className="catalog-result-caption">
            {search?.capturedAt
              ? `Qloo catalog · captured ${new Date(search.capturedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
              : "Previously retrieved catalog matches"}
            <span>Select deliberately</span>
          </div>
          {suggestions.map((c) => {
            const selected = anchors.some((a) => a.entityId === c.entityId);
            const mapped = influences.some(
              (i) => i.entityId === c.entityId && i.supplierId === supplierId,
            );
            return (
              <div className="catalog-result" key={c.entityId}>
                <span className="catalog-type-icon">
                  {c.entityType === "artist" ? (
                    <AudioLines size={18} />
                  ) : (
                    <BookOpen size={18} />
                  )}
                </span>
                <div>
                  <strong>{c.name}</strong>
                  <span>
                    {typeLabels[c.entityType]} ·{" "}
                    {c.disambiguation || "Catalog match"}
                  </span>
                </div>
                <div className="catalog-result-actions">
                  <Button
                    type="button"
                    variant={selected ? "ghost" : "secondary"}
                    disabled={
                      locked || !!busy || selected || anchors.length >= 10
                    }
                    onClick={() => void select([...anchors, c])}
                  >
                    {selected ? <Check size={14} /> : <Link2 size={14} />}
                    {selected ? "Selected" : "Use as anchor"}
                  </Button>
                  {supplierId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={locked || !!busy || mapped}
                      onClick={() =>
                        void select(anchors, [
                          ...influences,
                          {
                            supplierId,
                            entityId: c.entityId,
                            entityType: c.entityType,
                            name: c.name,
                            confirmedAt: new Date().toISOString(),
                          },
                        ])
                      }
                    >
                      {mapped ? "Influence linked" : "Link to offer"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="confirmed-anchors">
        {anchors.map((a) => (
          <span className="anchor-chip catalog-anchor" key={a.entityId}>
            <Check size={13} />
            <span>
              {a.name}
              <small>{typeLabels[a.entityType]}</small>
            </span>
            {!locked ? (
              <button
                type="button"
                aria-label={`Remove confirmed anchor ${a.name}`}
                disabled={!!busy || running}
                onClick={() =>
                  void select(anchors.filter((x) => x.entityId !== a.entityId))
                }
              >
                <X size={13} />
              </button>
            ) : null}
          </span>
        ))}
      </div>
      <details className="influence-editor">
        <summary>
          Connect an offer’s known influences <Link2 size={14} />
        </summary>
        <p className="field-hint">
          An operator-confirmed influence can help compare local offers. The
          evidence concerns the influence, not the supplier’s identity,
          availability or skill.
        </p>
        <label className="field">
          <span>Offer to connect to a catalog result</span>
          <select
            value={supplierId}
            disabled={locked}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Choose an offer…</option>
            {w.suppliers.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name} · {s.discipline}
              </option>
            ))}
          </select>
        </label>
        {influences.length ? (
          <div className="influence-mappings">
            {influences.map((i) => (
              <div key={`${i.supplierId}:${i.entityId}`}>
                <span>
                  {w.suppliers.find((s) => s.id === i.supplierId)?.name ||
                    "Removed offer"}
                  <Link2 size={12} />
                  <strong>{i.name}</strong>
                </span>
                {!locked ? (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${i.name} influence from ${w.suppliers.find((s) => s.id === i.supplierId)?.name}`}
                    disabled={!!busy}
                    onClick={() =>
                      void select(
                        anchors,
                        influences.filter((x) => x !== i),
                      )
                    }
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </details>
      <div className="catalog-targets">
        <span>Explore connections in</span>
        {(["artist", "movie", "book"] as CulturalType[]).map((type) => (
          <span key={type}>
            <Check size={12} />
            {typeLabels[type]}s
          </span>
        ))}
      </div>
      <p className="catalog-boundary">
        Cultural evidence can inspire a program. It never establishes rights,
        supplier availability or attendance.
      </p>
    </div>
  );
}

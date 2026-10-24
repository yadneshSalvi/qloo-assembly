"use client";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Layers3,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { formatMoney, type Concept } from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, ButtonLink, EmptyState } from "../ui";
import { Poster } from "../poster";
export function ConceptsView() {
  const { workspace: w, act, busy } = useWorkspace();
  if (!w) return null;
  const running = w.run?.status === "QUEUED" || w.run?.status === "RUNNING";
  if (running)
    return (
      <div className="research-view">
        <div className="research-symbol">
          <Sparkles size={36} strokeWidth={1} />
        </div>
        <div className="eyebrow">A GOOD NIGHT STARTS TO TAKE SHAPE</div>
        <h2>
          Putting the ingredients
          <br />
          <em>in conversation.</em>
        </h2>
        <p>
          Loading authored sample treatments against your saved brief and venue
          constraints.
        </p>
        <ol className="research-milestones">
          {[
            "Read the brief",
            "Check the available room",
            "Review authored cultural connections",
            "Calculate costs & practical fit",
            "Prepare three treatments",
          ].map((label, i) => (
            <li
              key={label}
              className={i < (w.run?.milestones.length || 0) ? "done" : ""}
            >
              {i < (w.run?.milestones.length || 0) ? (
                <CheckCircle2 size={19} />
              ) : i === (w.run?.milestones.length || 0) ? (
                <LoaderCircle size={19} className="spin" />
              ) : (
                <Circle size={19} />
              )}
              <span>{label}</span>
              {i < (w.run?.milestones.length || 0) ? (
                <small>Saved</small>
              ) : null}
            </li>
          ))}
        </ol>
        <Badge tone="warning">Sample operation · no live Qloo request</Badge>
        <div className="research-saved">
          You can leave this page. The worker saves progress to your workspace.
        </div>
      </div>
    );
  if (!w.concepts.length)
    return (
      <div className="empty-view">
        <EmptyState
          icon={<Layers3 size={24} />}
          title={
            w.run?.status === "FAILED"
              ? "A useful pause."
              : "A room full of possibilities."
          }
          action={
            <Button
              busy={busy === "RESEARCH"}
              onClick={() => void act("RESEARCH", { mode: "SAMPLE" })}
            >
              {w.run?.status === "FAILED"
                ? "Try sample research again"
                : "Explore sample concepts"}
              <ArrowRight size={16} />
            </Button>
          }
        >
          {w.run?.error ||
            "Save a few cultural anchors and the practical details in your brief. Then explore three authored ways this evening could come together."}
        </EmptyState>
        <ButtonLink href="/studio/events/blue-hour/brief" variant="ghost">
          Back to the brief
        </ButtonLink>
      </div>
    );
  return (
    <>
      <div className="section-intro concepts-intro">
        <div>
          <div className="eyebrow">02 / FIND THE CHARACTER</div>
          <h2>Same room. Three different feelings.</h2>
          <p>
            Three authored directions for the evening. Pick the one you want to
            put in front of people.
          </p>
        </div>
        <Badge tone="warning">Authored sample treatments</Badge>
      </div>
      {w.event.selectedConceptId ? (
        <div className="selection-banner">
          <div>
            <CheckCircle2 size={20} />
            <div>
              <strong>A direction worth exploring.</strong>
              <p>
                {
                  w.concepts.find((c) => c.id === w.event.selectedConceptId)
                    ?.title
                }{" "}
                is your chosen proposal.
              </p>
            </div>
          </div>
          <ButtonLink href="/studio/events/blue-hour/demand">
            Let people in on the idea <ArrowRight size={16} />
          </ButtonLink>
        </div>
      ) : null}
      <div className="concept-grid">
        {w.concepts.map((c) => (
          <ConceptCard key={c.id} concept={c} />
        ))}
      </div>
      <div className="concept-boundary">
        <Sparkles size={18} />
        <p>
          <strong>A creative hypothesis, ready to test.</strong> These
          connections are authored examples. Costs come from fictional offers,
          and supplier confirmation is a separate step. No concept carries a
          demand or conversion prediction.
        </p>
      </div>
    </>
  );
}
function ConceptCard({ concept: c }: { concept: Concept }) {
  const { workspace: w, act, busy } = useWorkspace();
  if (!w) return null;
  const selected = w.event.selectedConceptId === c.id;
  const locked = !["DRAFT", "CONCEPT_READY"].includes(w.event.lifecycle);
  const total = c.fixedCostMinor + c.variableCostMinor * w.venue.capacity;
  const margin = w.brief.ticketPriceMinor - c.variableCostMinor;
  const breakEven = margin > 0 ? Math.ceil(c.fixedCostMinor / margin) : null;
  const feasible =
    total <= w.brief.budgetMinor &&
    breakEven !== null &&
    breakEven <= w.venue.capacity;
  return (
    <article className={`concept-card ${selected ? "concept-selected" : ""}`}>
      <div className="concept-art">
        <Poster variant={c.art} compact />
        <div className="concept-number">
          0{c.number.replace(/^0/, "")}
          <span> / THE TREATMENT</span>
        </div>
        {selected ? (
          <span className="concept-selected-stamp">
            <Check size={13} />
            Your choice
          </span>
        ) : null}
      </div>
      <div className="concept-body">
        <div className="eyebrow">{c.category}</div>
        <h3>{c.title}</h3>
        <p className="concept-subtitle">{c.subtitle}</p>
        <p className="concept-description">{c.description}</p>
        <div className="concept-ingredients">
          {c.ingredients.map((i) => (
            <span key={i}>
              <span className="status-dot" />
              {i}
            </span>
          ))}
        </div>
        <div className="concept-budget">
          <div>
            <span>Full-room cost</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div>
            <span>Break-even</span>
            <strong>
              {breakEven === null ? "Not viable" : `${breakEven} places`}
            </strong>
          </div>
        </div>
        <div className="concept-feasible">
          <Badge tone={feasible ? "positive" : "warning"}>
            {feasible ? "Fits the sample budget" : "Review feasibility"}
          </Badge>
          <span>{w.venue.capacity} seated · GBP</span>
        </div>
        <details className="concept-thinking">
          <summary>
            Why these ingredients?
            <ChevronDown size={14} />
          </summary>
          <p>{c.rationale}</p>
          <span>Origin: authored editorial hypothesis</span>
        </details>
        <Button
          variant={selected ? "secondary" : "primary"}
          disabled={locked || selected || !feasible}
          busy={busy === "SELECT_CONCEPT"}
          onClick={() => void act("SELECT_CONCEPT", { conceptId: c.id })}
        >
          {selected ? (
            <>
              <Check size={15} />
              Selected direction
            </>
          ) : (
            <>
              Choose this direction
              <ArrowUpRight size={15} />
            </>
          )}
        </Button>
      </div>
    </article>
  );
}

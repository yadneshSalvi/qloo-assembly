"use client";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Layers3,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { formatMoney, presentConcept, type Concept } from "@assembly/contracts";
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
          {w.run?.mode === "LIVE"
            ? "Finding real cultural connections, checking your offers and costs, then composing distinct proposals."
            : "Checking authored sample treatments against your saved brief and venue constraints."}
        </p>
        <ol className="research-milestones">
          {(w.run?.milestones || []).map((milestone, i) => (
            <li key={`${milestone.at}-${i}`} className="done">
              <CheckCircle2 size={19} />
              <span>{milestone.label}</span>
              <small>Saved</small>
            </li>
          ))}
          <li aria-live="polite">
            <LoaderCircle size={19} className="spin" />
            <span>{w.run?.stage || "Waiting for the producer"}</span>
          </li>
        </ol>
        <Badge tone={w.run?.mode === "LIVE" ? "positive" : "warning"}>
          {w.run?.mode === "LIVE"
            ? `Live cultural research · ${w.mode === "SAMPLE" ? "sample operations" : "your inventory"}`
            : "Authored sample · no provider request"}
        </Badge>
        <div className="research-saved">
          You can leave this page. The worker saves progress to your workspace.
        </div>
        <Button
          variant="ghost"
          busy={busy === "CANCEL_RESEARCH"}
          onClick={() => void act("CANCEL_RESEARCH")}
        >
          Stop this run
        </Button>
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
              disabled={w.run?.mode === "LIVE" && !w.research?.anchors.length}
              onClick={() =>
                void act("RESEARCH", {
                  mode: w.run?.mode || (w.mode === "REAL" ? "LIVE" : "SAMPLE"),
                })
              }
            >
              {w.run?.status === "FAILED"
                ? `Retry ${w.run.mode === "LIVE" ? "live" : "authored"} research`
                : "Explore concepts"}
              <ArrowRight size={16} />
            </Button>
          }
        >
          {w.run?.error ||
            "Choose exact cultural anchors, add your offers and save the practical brief. Then compose three possible evenings."}
        </EmptyState>
        <ButtonLink href="/studio/events/current/brief" variant="ghost">
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
            {w.concepts.some((c) => c.origin === "MODEL_HYPOTHESIS")
              ? "Three creative hypotheses composed from real cultural evidence and your entered offers. Choose what you want to put in front of people."
              : "Three authored sample directions. Choose the one you want to put in front of people."}
          </p>
        </div>
        <Badge
          tone={
            w.concepts.some((c) => c.origin === "MODEL_HYPOTHESIS")
              ? "positive"
              : "warning"
          }
        >
          {w.concepts.some((c) => c.origin === "MODEL_HYPOTHESIS")
            ? "Live Qloo · AI composition"
            : "Authored sample treatments"}
        </Badge>
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
          <ButtonLink href="/studio/events/current/demand">
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
          <strong>A creative proposal, ready to test.</strong> Cultural
          references are inspiration. Costs come from{" "}
          {w.mode === "SAMPLE" ? "fictional sample" : "your entered"} offers,
          while supply, scope and permissions need separate confirmation.
          Attendance and conversion remain untested.
        </p>
      </div>
    </>
  );
}
function ConceptCard({ concept: c }: { concept: Concept }) {
  const { workspace: w, act, busy } = useWorkspace();
  if (!w) return null;
  const copy = presentConcept(c, w.suppliers, w.evidence);
  const selected = w.event.selectedConceptId === c.id;
  const locked = !["DRAFT", "CONCEPT_READY"].includes(w.event.lifecycle);
  const total = c.fixedCostMinor + c.variableCostMinor * w.venue.capacity;
  const margin = w.brief.ticketPriceMinor - c.variableCostMinor;
  const breakEven = margin > 0 ? Math.ceil(c.fixedCostMinor / margin) : null;
  const feasible =
    total <= w.brief.budgetMinor && !c.feasibility?.violations.length;
  return (
    <article className={`concept-card ${selected ? "concept-selected" : ""}`}>
      <div className="concept-art">
        <Poster
          variant={c.art}
          compact
          title={c.title}
          venueName={w.venue.name}
          date={w.brief.date}
          doors={w.brief.doors}
          location={w.venue.neighborhood}
          capacity={w.venue.capacity}
          category={c.category}
        />
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
        <p className="concept-description">{copy.description}</p>
        <div className="concept-ingredients">
          {copy.ingredients.map((i) => (
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
            <span>
              {w.brief.ticketPriceMinor === 0
                ? "Funding"
                : "Break-even scenario"}
            </span>
            <strong>
              {w.brief.ticketPriceMinor === 0
                ? "Host-funded"
                : breakEven === null
                  ? "Review price"
                  : `${breakEven} places`}
            </strong>
          </div>
        </div>
        <div className="concept-feasible">
          <Badge tone={feasible ? "positive" : "warning"}>
            {feasible ? "Fits the entered budget" : "Review feasibility"}
          </Badge>
          <span>{w.venue.capacity} seated · GBP</span>
        </div>
        <details className="concept-thinking">
          <summary>
            Why these ingredients?
            <ChevronDown size={14} />
          </summary>
          <p>{c.rationale}</p>
          <span>
            Origin:{" "}
            {c.origin === "MODEL_HYPOTHESIS"
              ? "AI creative hypothesis, grounded in the cited evidence"
              : "authored editorial hypothesis"}
          </span>
          <div className="concept-evidence-list">
            {c.evidenceIds
              .map((id) => w.evidence.find((e) => e.id === id))
              .filter((e) => !!e)
              .map((e) => (
                <div key={e.id}>
                  <Badge
                    dot={false}
                    tone={e.origin === "QLOO_RESULT" ? "positive" : "neutral"}
                  >
                    {e.origin === "QLOO_RESULT"
                      ? "Qloo evidence"
                      : e.origin === "APP_CALCULATION"
                        ? "Calculation"
                        : "Source"}
                  </Badge>
                  <strong>{e.title}</strong>
                  <p>{e.body}</p>
                  <small>{e.boundary}</small>
                </div>
              ))}
          </div>
          {c.feasibility?.unresolved.length ? (
            <div className="concept-unresolved">
              <strong>Before greenlight</strong>
              {c.feasibility.unresolved.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}
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

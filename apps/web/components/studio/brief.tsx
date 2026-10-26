"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  Film,
  Info,
  Plus,
  Utensils,
  X,
} from "lucide-react";
import { assessOfferSchedule, type Brief } from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Button, Badge } from "../ui";
import { CulturalCatalog } from "./cultural-catalog";
export function BriefView() {
  const { workspace: w } = useWorkspace();
  if (!w) return null;
  return (
    <BriefForm
      key={`${w.id}-${w.event.lifecycle === "DRAFT" ? "draft" : "saved"}`}
      initial={w.brief}
    />
  );
}
function BriefForm({ initial }: { initial: Brief }) {
  const { workspace: w, act, busy } = useWorkspace();
  const [brief, setBrief] = useState(initial);
  const [anchor, setAnchor] = useState("");
  const [dirty, setDirty] = useState(false);
  const [researchMode, setResearchMode] = useState<"LIVE" | "SAMPLE">("LIVE");
  const [reviewTime, setReviewTime] = useState(() => Date.now());
  useEffect(() => {
    const refreshTime = () => setReviewTime(Date.now());
    const timer = window.setInterval(refreshTime, 60000);
    window.addEventListener("focus", refreshTime);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshTime);
    };
  }, []);
  const router = useRouter();
  if (!w) return null;
  const locked =
    !["DRAFT", "CONCEPT_READY"].includes(w.event.lifecycle) ||
    w.run?.status === "QUEUED" ||
    w.run?.status === "RUNNING";
  const timingChecks = w.suppliers.map((offer) => {
    const schedule = assessOfferSchedule([offer], brief.doors, brief.end);
    const issues = [
      ...schedule.violations,
      ...schedule.unresolvedProgram,
      ...schedule.unresolvedSetup,
    ];
    if (offer.status === "UNAVAILABLE")
      issues.push("This offer is marked unavailable.");
    if (
      (w.mode === "REAL" || offer.validUntil !== undefined) &&
      (!offer.validUntil ||
        !Number.isFinite(Date.parse(offer.validUntil)) ||
        Date.parse(offer.validUntil) <= reviewTime)
    )
      issues.push(`Record a current quote review date for ${offer.name}.`);
    const fullCost =
      offer.feeMinor +
      (brief.overheadMinor ?? (w.mode === "REAL" ? 0 : 20000)) +
      (brief.perGuestMinor ?? (w.mode === "REAL" ? 0 : 800)) * w.venue.capacity;
    if (fullCost > brief.budgetMinor)
      issues.push(
        "This offer and the entered room costs exceed the full-room budget.",
      );
    if (offer.soundDb !== undefined && offer.soundDb > w.venue.soundLimitDb)
      issues.push("This offer exceeds the room’s sound limit.");
    return { offer, issues };
  });
  const timedOffers = timingChecks.filter(
    ({ issues }) => issues.length === 0,
  ).length;
  const update = <K extends keyof Brief>(key: K, value: Brief[K]) => {
    setBrief((b) => ({ ...b, [key]: value }));
    setDirty(true);
  };
  const addAnchor = () => {
    if (
      anchor.trim() &&
      brief.anchors.length < 10 &&
      !brief.anchors.includes(anchor.trim())
    ) {
      update("anchors", [...brief.anchors, anchor.trim()]);
      setAnchor("");
    }
  };
  async function save(research = false) {
    const saved = await act("SAVE_BRIEF", {
      brief: {
        ...brief,
        ticketPriceMinor: w?.mode === "REAL" ? 0 : brief.ticketPriceMinor,
        overheadMinor: brief.overheadMinor ?? (w?.mode === "REAL" ? 0 : 20000),
        perGuestMinor: brief.perGuestMinor ?? (w?.mode === "REAL" ? 0 : 800),
        anchors: w?.research?.anchors.length
          ? w.research.anchors.map((a) => a.name)
          : brief.anchors,
      },
    });
    if (saved.ok) {
      setDirty(false);
      if (research) {
        const result = await act("RESEARCH", { mode: researchMode });
        if (result.ok) router.push("/studio/events/current/concepts");
      }
    }
  }
  return (
    <div className="brief-layout">
      <section>
        <div className="section-intro">
          <div className="eyebrow">01 / SET THE DIRECTION</div>
          <h2>What should this night feel like?</h2>
          <p>
            A good brief starts with a feeling. The practical details give it
            somewhere to land.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(true);
          }}
          className="brief-form"
        >
          <label className="field">
            <span>
              The ambition <small>IN YOUR OWN WORDS</small>
            </span>
            <textarea
              required
              minLength={10}
              maxLength={800}
              rows={3}
              value={brief.ambition}
              disabled={locked}
              onChange={(e) => update("ambition", e.target.value)}
              placeholder="What would make this evening worth coming to?"
            />
          </label>
          <div className="field">
            <span>
              Editorial starting notes <small>UP TO 10</small>
            </span>
            <p className="field-hint">
              Names that set the mood. Confirm their catalog identities below
              for live research.
            </p>
            <div className="anchor-chips">
              {brief.anchors.map((a, i) => (
                <span className="anchor-chip" key={a}>
                  {i % 3 === 0 ? (
                    <AudioLines size={14} />
                  ) : i % 3 === 1 ? (
                    <Film size={14} />
                  ) : (
                    <Utensils size={14} />
                  )}
                  <span>{a}</span>
                  {!locked ? (
                    <button
                      type="button"
                      aria-label={`Remove ${a}`}
                      onClick={() =>
                        update(
                          "anchors",
                          brief.anchors.filter((x) => x !== a),
                        )
                      }
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
            {!locked ? (
              <div className="anchor-add">
                <input
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAnchor();
                    }
                  }}
                  maxLength={100}
                  placeholder="Add a cultural anchor…"
                  aria-label="New cultural anchor"
                />
                <button
                  type="button"
                  onClick={addAnchor}
                  aria-label="Add cultural anchor"
                  disabled={!anchor.trim() || brief.anchors.length >= 10}
                >
                  <Plus size={17} />
                </button>
              </div>
            ) : null}
            <div className="inline-hint">
              <Info size={12} />
              These notes alone are not Qloo evidence or confirmed entity
              matches.
            </div>
          </div>
          <CulturalCatalog locked={locked} />
          <div className="form-divider">
            <span>THE PRACTICAL PART</span>
          </div>
          <div className="form-grid form-grid-three">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={brief.date}
                disabled={locked}
                required
                onChange={(e) => update("date", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Doors open</span>
              <input
                type="time"
                value={brief.doors}
                disabled={locked}
                required
                onChange={(e) => update("doors", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Last goodbyes</span>
              <input
                type="time"
                value={brief.end}
                disabled={locked}
                required
                onChange={(e) => update("end", e.target.value)}
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>
                Total budget <small>GBP</small>
              </span>
              <div className="input-prefix">
                <span>£</span>
                <input
                  type="number"
                  min={100}
                  max={100000}
                  step="1"
                  disabled={locked}
                  value={brief.budgetMinor / 100}
                  onChange={(e) =>
                    update(
                      "budgetMinor",
                      Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
              </div>
              <p className="field-hint">
                Includes fixed costs and per-person costs.
              </p>
            </label>
            <label className="field">
              <span>
                {w.mode === "REAL"
                  ? "Guest price · free admission"
                  : "Proposed ticket price"}{" "}
                <small>GBP</small>
              </span>
              <div className="input-prefix">
                <span>£</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  step=".01"
                  disabled={locked}
                  value={w.mode === "REAL" ? 0 : brief.ticketPriceMinor / 100}
                  readOnly={w.mode === "REAL"}
                  onChange={(e) =>
                    update(
                      "ticketPriceMinor",
                      Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
              </div>
              <p className="field-hint">
                {w.mode === "REAL"
                  ? "Your funded budget covers the costs. Guests book for free."
                  : "A hypothetical condition to test. No payment is collected."}
              </p>
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>
                Room & other fixed costs <small>GBP</small>
              </span>
              <div className="input-prefix">
                <span>£</span>
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step="0.01"
                  required
                  disabled={locked}
                  value={
                    (brief.overheadMinor ?? (w.mode === "REAL" ? 0 : 20000)) /
                    100
                  }
                  onChange={(e) =>
                    update(
                      "overheadMinor",
                      Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
              </div>
              <p className="field-hint">
                Add staffing, equipment and contingency to supplier fees.
              </p>
            </label>
            <label className="field">
              <span>
                Costs per guest <small>GBP</small>
              </span>
              <div className="input-prefix">
                <span>£</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  step="0.01"
                  required
                  disabled={locked}
                  value={
                    (brief.perGuestMinor ?? (w.mode === "REAL" ? 0 : 800)) / 100
                  }
                  onChange={(e) =>
                    update(
                      "perGuestMinor",
                      Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
              </div>
              <p className="field-hint">Enter 0 if included in fixed offers.</p>
            </label>
          </div>
          <label className="field">
            <span>Who is this for?</span>
            <textarea
              rows={2}
              required
              minLength={5}
              maxLength={600}
              disabled={locked}
              value={brief.audience}
              onChange={(e) => update("audience", e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              Anything we should keep in mind? <small>OPTIONAL</small>
            </span>
            <textarea
              rows={2}
              maxLength={800}
              disabled={locked}
              value={brief.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </label>
          <div className="form-actions">
            <span className="form-save-state">
              {w.event.publishedAt ? (
                <>
                  <Check size={13} />
                  Published brief · edits require a versioned change
                </>
              ) : locked ? (
                <>
                  <span className="status-dot" />
                  {w.research?.search?.status === "QUEUED" ||
                  w.research?.search?.status === "RUNNING"
                    ? "Catalog search in progress · editing paused"
                    : "Research in progress · editing paused"}
                </>
              ) : dirty ? (
                <>
                  <span className="status-dot" />
                  Unsaved changes
                </>
              ) : (
                <>
                  <Check size={13} />
                  Saved in your production workspace
                </>
              )}
            </span>
            {!locked ? (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  busy={busy === "SAVE_BRIEF"}
                  onClick={() => void save()}
                >
                  Save brief
                </Button>
                <Button
                  type="submit"
                  busy={busy === "RESEARCH"}
                  disabled={
                    !!busy ||
                    (researchMode === "LIVE"
                      ? !w.research?.anchors.length || timedOffers < 2
                      : brief.anchors.length === 0)
                  }
                >
                  {researchMode === "LIVE"
                    ? "Compose with live evidence"
                    : "Explore authored concepts"}{" "}
                  <ArrowRight size={16} />
                </Button>
              </div>
            ) : null}
          </div>
          {!locked ? (
            <div className="research-mode-picker">
              <label className={researchMode === "LIVE" ? "selected" : ""}>
                <input
                  type="radio"
                  name="research-mode"
                  checked={researchMode === "LIVE"}
                  onChange={() => setResearchMode("LIVE")}
                />
                <span>
                  <strong>Live Qloo + AI producer</strong>
                  <small>
                    Confirmed anchors, your offers, a bounded research run.
                  </small>
                </span>
              </label>
              {w.mode === "SAMPLE" ? (
                <label className={researchMode === "SAMPLE" ? "selected" : ""}>
                  <input
                    type="radio"
                    name="research-mode"
                    checked={researchMode === "SAMPLE"}
                    onChange={() => setResearchMode("SAMPLE")}
                  />
                  <span>
                    <strong>Authored rehearsal</strong>
                    <small>
                      Three written examples. No live provider request.
                    </small>
                  </span>
                </label>
              ) : null}
              {researchMode === "LIVE" && !w.research?.anchors.length ? (
                <p>
                  Choose at least one exact catalog match above to compose with
                  live evidence.
                </p>
              ) : null}
              {researchMode === "LIVE" && !w.suppliers.length ? (
                <p>
                  Add supplier offers in{" "}
                  <a href="/studio/suppliers">People & offers</a> first.
                </p>
              ) : null}
            </div>
          ) : null}
          {!locked &&
          researchMode === "LIVE" &&
          (timedOffers < 2 ||
            timingChecks.some(({ issues }) => issues.length)) ? (
            <div className="schedule-review" role="status">
              <strong>
                {timedOffers >= 2
                  ? `${timedOffers} workable offers are ready to consider.`
                  : "Complete two workable offers before composing."}
              </strong>
              <p>
                {timedOffers >= 2
                  ? "You can compose with the ready offers. These alternatives still need review before they can be confirmed or published:"
                  : `The producer needs at least two different inventory combinations. ${timedOffers} of 2 offers are ready. Enter program and setup times within the event window, with costs and sound that fit the room. Extra incomplete alternatives can stay in your inventory.`}
              </p>
              <ul>
                {timingChecks
                  .filter(({ issues }) => issues.length)
                  .map(({ offer, issues }) => (
                    <li key={offer.id}>
                      <a
                        href={`/studio/suppliers#offer-${encodeURIComponent(offer.id)}`}
                      >
                        {offer.name}
                      </a>
                      {": "}
                      {issues.join(" ")}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </form>
      </section>
      <aside className="brief-aside">
        <div className="constraint-card">
          <div className="eyebrow">YOUR CREATIVE CONSTRAINTS</div>
          <h3>
            A little structure.
            <br />
            <em>A lot of possibility.</em>
          </h3>
          <div className="constraint-venue">
            <span className="venue-avatar">F</span>
            <div>
              <strong>{w.venue.name}</strong>
              <small>{w.venue.neighborhood}</small>
            </div>
            <Badge
              tone={
                w.venue.availability === "AVAILABLE" ? "positive" : "warning"
              }
            >
              {w.venue.availability === "AVAILABLE" ? "Available" : "Reconfirm"}
            </Badge>
          </div>
          <dl>
            <div>
              <dt>Seated capacity</dt>
              <dd>{w.venue.capacity} people</dd>
            </div>
            <div>
              <dt>Sound limit</dt>
              <dd>{w.venue.soundLimitDb} dB</dd>
            </div>
            <div>
              <dt>Curfew</dt>
              <dd>{w.venue.curfew}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>See venue sheet</dd>
            </div>
          </dl>
          <a className="text-link" href="/studio/venue">
            Review venue details <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="editorial-note">
          <span>✳</span>
          <h3>Connections, with context.</h3>
          <p>
            A musician and a film can share a feeling. That’s a useful creative
            starting point — it isn’t proof that a supplier is available or an
            audience will buy.
          </p>
          <div className="note-signoff">THE ASSEMBLY APPROACH</div>
        </div>
        <div className="qloo-status">
          <BookOpen size={18} />
          <div>
            <strong>
              {w.qloo.status === "LIVE"
                ? "Live Qloo evidence is saved"
                : "Two sources. One considered plan."}
            </strong>
            <p>
              Qloo finds cultural connections. The AI producer proposes a
              program using your entered offers and costs. Publication remains
              your decision.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

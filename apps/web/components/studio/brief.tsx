"use client";
import { useState } from "react";
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
import type { Brief } from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Button, Badge } from "../ui";
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
  const router = useRouter();
  if (!w) return null;
  const locked = !["DRAFT", "CONCEPT_READY"].includes(w.event.lifecycle);
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
    const saved = await act("SAVE_BRIEF", { brief });
    if (saved.ok) {
      setDirty(false);
      if (research) {
        const result = await act("RESEARCH", { mode: "SAMPLE" });
        if (result.ok) router.push("/studio/events/blue-hour/concepts");
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
              Cultural starting points <small>UP TO 10</small>
            </span>
            <p className="field-hint">
              Artists, films, people, or places that set the mood.
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
              Editorial inputs. Entity resolution needs a live Qloo connection.
            </div>
          </div>
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
                Proposed ticket price <small>GBP</small>
              </span>
              <div className="input-prefix">
                <span>£</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step=".01"
                  disabled={locked}
                  value={brief.ticketPriceMinor / 100}
                  onChange={(e) =>
                    update(
                      "ticketPriceMinor",
                      Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
              </div>
              <p className="field-hint">
                A condition to test. No payment is collected.
              </p>
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
              {locked ? (
                <>
                  <Check size={13} />
                  Published brief · edits require a versioned change
                </>
              ) : dirty ? (
                <>
                  <span className="status-dot" />
                  Unsaved changes
                </>
              ) : (
                <>
                  <Check size={13} />
                  Saved in your sample workspace
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
                  disabled={!!busy || brief.anchors.length === 0}
                >
                  Explore sample concepts <ArrowRight size={16} />
                </Button>
              </div>
            ) : null}
          </div>
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
          <a className="text-link" href="/studio/venues/the-fold">
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
            <strong>Qloo is not connected</strong>
            <p>
              This run loads three authored sample treatments. Live entity
              resolution and recommendations remain unavailable.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

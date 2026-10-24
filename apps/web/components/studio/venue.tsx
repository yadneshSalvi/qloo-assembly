"use client";
import { useState } from "react";
import { Check, Info } from "lucide-react";
import type { Venue } from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Badge, Button } from "../ui";
export function VenueView() {
  const { workspace: w } = useWorkspace();
  if (!w) return null;
  return <VenueForm key={w.id} initial={w.venue} />;
}
function VenueForm({ initial }: { initial: Venue }) {
  const { workspace: w, act, busy } = useWorkspace();
  const [venue, setVenue] = useState(initial);
  const [dirty, setDirty] = useState(false);
  if (!w) return null;
  const locked = !["DRAFT", "CONCEPT_READY"].includes(w.event.lifecycle);
  function update<K extends keyof Venue>(key: K, value: Venue[K]) {
    setVenue((v) => ({ ...v, [key]: value }));
    setDirty(true);
  }
  return (
    <>
      <div className="venue-heading">
        <div>
          <div className="eyebrow">KNOW YOUR SPACE</div>
          <h1>
            A room with
            <br />
            <em>its own character.</em>
          </h1>
          <p>
            The practical facts are the foundation. Keep them explicit, current,
            and owned by someone.
          </p>
        </div>
        <div className="large-venue-art" aria-hidden="true">
          <div className="room-window" />
          <div className="room-table" />
          <div className="room-lamp" />
          <span>
            THE FOLD
            <br />
            <small>PECKHAM, LONDON</small>
          </span>
        </div>
      </div>
      <div className="venue-layout">
        <section className="panel venue-form-panel">
          <div className="panel-heading">
            <h2>Venue sheet</h2>
            <Badge tone="warning">Fictional sample inventory</Badge>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if ((await act("SAVE_VENUE", { venue })).ok) setDirty(false);
            }}
          >
            <div className="form-grid">
              <label className="field">
                <span>Venue name</span>
                <input
                  required
                  maxLength={100}
                  value={venue.name}
                  disabled={locked}
                  onChange={(e) => update("name", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Neighborhood & city</span>
                <input
                  required
                  maxLength={100}
                  value={venue.neighborhood}
                  disabled={locked}
                  onChange={(e) => update("neighborhood", e.target.value)}
                />
              </label>
            </div>
            <label className="field">
              <span>Address</span>
              <input
                required
                maxLength={300}
                value={venue.address}
                disabled={locked}
                onChange={(e) => update("address", e.target.value)}
              />
            </label>
            <div className="form-grid form-grid-three">
              <label className="field">
                <span>Seated capacity</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={venue.capacity}
                  disabled={locked}
                  onChange={(e) => update("capacity", Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>
                  Sound limit <small>dB</small>
                </span>
                <input
                  type="number"
                  min={0}
                  max={140}
                  required
                  value={venue.soundLimitDb}
                  disabled={locked}
                  onChange={(e) =>
                    update("soundLimitDb", Number(e.target.value))
                  }
                />
              </label>
              <label className="field">
                <span>Curfew</span>
                <input
                  type="time"
                  required
                  value={venue.curfew}
                  disabled={locked}
                  onChange={(e) => update("curfew", e.target.value)}
                />
              </label>
            </div>
            <label className="field">
              <span>Access & guest needs</span>
              <textarea
                required
                minLength={5}
                maxLength={1500}
                rows={4}
                value={venue.access}
                disabled={locked}
                onChange={(e) => update("access", e.target.value)}
              />
            </label>
            <div className="inline-hint">
              <Info size={14} />
              All event times use Europe/London. Capacity is the app-managed
              sample allotment.
            </div>
            <div className="form-actions">
              <span className="form-save-state">
                {locked
                  ? "Published venue terms are locked."
                  : dirty
                    ? "Unsaved venue changes"
                    : "Venue sheet saved"}
              </span>
              {!locked ? (
                <Button type="submit" busy={busy === "SAVE_VENUE"}>
                  Save venue details <Check size={16} />
                </Button>
              ) : null}
            </div>
          </form>
        </section>
        <aside>
          <div className="availability-panel">
            <div className="eyebrow">THE OPEN EVENING</div>
            <div className="availability-date">
              <strong>{Number(w.terms.date.slice(8))}</strong>
              <div>
                <span>
                  {new Date(w.terms.date + "T12:00:00Z")
                    .toLocaleDateString("en-GB", { month: "long" })
                    .toUpperCase()}
                </span>
                <span>
                  {new Date(w.terms.date + "T12:00:00Z")
                    .toLocaleDateString("en-GB", {
                      weekday: "long",
                      year: "numeric",
                    })
                    .toUpperCase()}
                </span>
              </div>
              <span className="serif-asterisk">✳</span>
            </div>
            <Badge
              tone={
                w.venue.availability === "AVAILABLE" ? "positive" : "warning"
              }
            >
              {w.venue.availability === "AVAILABLE"
                ? "Sample availability confirmed"
                : "Needs reconfirmation"}
            </Badge>
            <p>
              The room is available for this authored production. A saved venue
              edit requires fresh confirmation.
            </p>
            <dl>
              <div>
                <dt>Event</dt>
                <dd>
                  {w.brief.doors}–{w.brief.end}
                </dd>
              </div>
              <div>
                <dt>Capacity</dt>
                <dd>{w.venue.capacity} seated</dd>
              </div>
              <div>
                <dt>Confirmed</dt>
                <dd>
                  {new Date(w.venue.confirmedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </dd>
              </div>
              <div>
                <dt>Fresh until</dt>
                <dd>
                  {new Date(w.venue.validUntil).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            </dl>
            <Button
              variant="secondary"
              busy={busy === "CONFIRM_AVAILABILITY"}
              onClick={() => void act("CONFIRM_AVAILABILITY")}
            >
              Reconfirm sample availability <Check size={14} />
            </Button>
            <small>{w.venue.source}</small>
          </div>
          <div className="editorial-note">
            <span>✳</span>
            <h3>A constraint can be a creative invitation.</h3>
            <p>
              Forty-eight seats invite intimacy. A sound limit invites a softer
              set. The best concept belongs to the room.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

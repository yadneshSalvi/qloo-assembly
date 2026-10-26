"use client";
import { useState } from "react";
import { Check, Info } from "lucide-react";
import type { Venue } from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, ButtonLink } from "../ui";
export function VenueView() {
  const { workspace: w } = useWorkspace();
  if (!w) return null;
  return <VenueForm key={w.id} initial={w.venue} />;
}
function VenueForm({ initial }: { initial: Venue }) {
  const { workspace: w, act, busy } = useWorkspace();
  const [venue, setVenue] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [confirmationUntil, setConfirmationUntil] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [openedAt] = useState(() => Date.now());
  if (!w) return null;
  const locked = !["DRAFT", "CONCEPT_READY"].includes(w.event.lifecycle);
  const fresh =
    w.venue.availability === "AVAILABLE" &&
    Date.parse(w.venue.validUntil) > openedAt;
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
            {w.venue.name || "YOUR ROOM"}
            <br />
            <small>{w.venue.neighborhood}</small>
          </span>
        </div>
      </div>
      <div className="venue-layout">
        <section className="panel venue-form-panel">
          <div className="panel-heading">
            <h2>Venue sheet</h2>
            <Badge tone={w.mode === "SAMPLE" ? "warning" : "neutral"}>
              {w.mode === "SAMPLE"
                ? "Fictional sample inventory"
                : "Operator-entered inventory"}
            </Badge>
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
            <div className="form-grid">
              <label className="field">
                <span>Venue timezone</span>
                <input
                  required
                  disabled={locked}
                  list="venue-timezones"
                  value={venue.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                />
                <datalist id="venue-timezones">
                  {[
                    "Europe/London",
                    "Asia/Kolkata",
                    "America/New_York",
                    "America/Los_Angeles",
                    "Europe/Paris",
                    "Asia/Singapore",
                    "UTC",
                  ].map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span>Source of venue facts</span>
                <input
                  required
                  minLength={5}
                  maxLength={1000}
                  disabled={locked}
                  value={venue.source}
                  onChange={(e) => update("source", e.target.value)}
                  placeholder="Owner’s venue sheet · reviewed today"
                />
              </label>
            </div>
            <div className="inline-hint">
              <Info size={14} />
              Event times use {venue.timezone}. Capacity is this production’s
              app-managed allotment; account for any places sold elsewhere.
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
              <strong>
                {w.terms.date ? Number(w.terms.date.slice(8)) : "—"}
              </strong>
              <div>
                <span>
                  {w.terms.date
                    ? new Date(w.terms.date + "T12:00:00Z")
                        .toLocaleDateString("en-GB", {
                          month: "long",
                          timeZone: "UTC",
                        })
                        .toUpperCase()
                    : "DATE TO CHOOSE"}
                </span>
                <span>
                  {w.terms.date
                    ? new Date(w.terms.date + "T12:00:00Z")
                        .toLocaleDateString("en-GB", {
                          weekday: "long",
                          year: "numeric",
                          timeZone: "UTC",
                        })
                        .toUpperCase()
                    : "SET IN THE BRIEF"}
                </span>
              </div>
              <span className="serif-asterisk">✳</span>
            </div>
            <Badge tone={fresh ? "positive" : "warning"}>
              {fresh
                ? w.mode === "SAMPLE"
                  ? "Sample availability confirmed"
                  : "Availability attested by operator"
                : "Needs reconfirmation"}
            </Badge>
            <p>
              {w.mode === "SAMPLE"
                ? "Availability belongs to this fictional rehearsal."
                : "Confirm that you control this room and the allotment for the stated evening."}{" "}
              A saved venue edit requires fresh confirmation.
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
                  {w.venue.confirmedAt
                    ? new Date(w.venue.confirmedAt).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                        },
                      )
                    : "Not yet confirmed"}
                </dd>
              </div>
              <div>
                <dt>Fresh until</dt>
                <dd>
                  {w.venue.validUntil
                    ? new Date(w.venue.validUntil).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Awaiting your check"}
                </dd>
              </div>
            </dl>
            {w.mode === "REAL" ? (
              <>
                <label className="field">
                  <span>Source of your availability check</span>
                  <textarea
                    rows={2}
                    value={venue.source}
                    maxLength={1000}
                    onChange={(e) =>
                      setVenue((v) => ({ ...v, source: e.target.value }))
                    }
                    placeholder="Name the owner’s record or agreement you checked."
                  />
                </label>
                <label className="field">
                  <span>Valid through</span>
                  <input
                    type="date"
                    value={confirmationUntil}
                    onChange={(e) => setConfirmationUntil(e.target.value)}
                  />
                </label>
              </>
            ) : null}
            <Button
              variant="secondary"
              busy={busy === "CONFIRM_AVAILABILITY"}
              disabled={
                dirty ||
                !w.terms.date ||
                (w.mode === "REAL" && venue.source.trim().length < 5)
              }
              onClick={() =>
                void act(
                  "CONFIRM_AVAILABILITY",
                  w.mode === "REAL"
                    ? {
                        source: venue.source,
                        validUntil: `${confirmationUntil}T23:59:59.000Z`,
                      }
                    : {},
                )
              }
            >
              {w.mode === "SAMPLE"
                ? "Reconfirm sample availability"
                : "Attest availability & allotment"}{" "}
              <Check size={14} />
            </Button>
            {!w.terms.date ? (
              <p className="field-hint">
                Set the date in your brief, then confirm availability for that
                evening.
                <br />
                <ButtonLink href="/studio/events/current/brief" variant="ghost">
                  Shape the brief
                </ButtonLink>
              </p>
            ) : null}
            <small>{w.venue.source}</small>
          </div>
          <div className="editorial-note">
            <span>✳</span>
            <h3>A constraint can be a creative invitation.</h3>
            <p>
              A small room invites intimacy. A sound limit invites a softer set.
              The best concept belongs to the room.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

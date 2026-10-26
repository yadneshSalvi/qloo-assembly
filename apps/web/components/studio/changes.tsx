"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  countsFor,
  costWorksheet,
  formatMoney,
  selectedConcept,
  type Terms,
  type Venue,
} from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, ButtonLink, EmptyState } from "../ui";
import { ApprovalDialog } from "../approval-dialog";
import { SupplierTools } from "./suppliers";

export function ChangesView() {
  const { workspace: w, act, busy } = useWorkspace();
  const [approve, setApprove] = useState(false);
  const [editing, setEditing] = useState(false);
  if (!w) return null;
  if (
    !w.event.publishedAt ||
    ["LIVE", "COMPLETED", "CANCELLED"].includes(w.event.lifecycle)
  )
    return (
      <EmptyState
        icon={<RefreshCw size={25} />}
        title="A considered change needs a published plan."
        action={
          <ButtonLink href="/studio/events/current/production">
            Return to production
            <ArrowRight size={15} />
          </ButtonLink>
        }
      >
        Before an event starts, review changes to supply, timing, venue, access
        or program here. Keep an explicit record of what your audience is
        choosing.
      </EmptyState>
    );
  const change = w.change,
    approved = change?.status === "APPROVED";
  const replacement = w.suppliers.find((s) => s.id === change?.replacementId);
  const original = w.suppliers.find((s) => s.id === change?.supplierId);
  const waiting = w.commitments.filter(
    (c) => c.status === "RECONFIRM_REQUIRED",
  );
  const cost = costWorksheet(w),
    counts = countsFor(w);
  const totalCostDelta =
    change?.totalCostDeltaMinor ?? change?.costDeltaMinor ?? 0;
  const unresolvedSupply =
    !!change?.supplierId &&
    (!replacement || replacement.status !== "CONFIRMED");
  const pendingResponsibilities = w.requirements.filter((r) => !r.confirmed);
  const pendingSuppliers = (selectedConcept(w)?.supplierIds ?? []).filter(
    (id) => w.suppliers.find((s) => s.id === id)?.status !== "CONFIRMED",
  );
  const pendingProductionChecks = [
    ...(pendingResponsibilities.length
      ? [
          `${pendingResponsibilities.length} responsibility ${pendingResponsibilities.length === 1 ? "check" : "checks"}`,
        ]
      : []),
    ...(pendingSuppliers.length
      ? [
          `${pendingSuppliers.length} supplier ${pendingSuppliers.length === 1 ? "confirmation" : "confirmations"}`,
        ]
      : []),
  ];
  const funded = cost.headroom >= (approved ? 0 : totalCostDelta);
  return (
    <>
      <div className="change-heading">
        <div>
          <div className="eyebrow">WHEN THE PLAN NEEDS A SECOND ACT</div>
          <h2>
            A thoughtful change.
            <br />
            <em>A renewed choice.</em>
          </h2>
          <p>
            {change?.reason ||
              "Keep the evening’s promise honest when a supplier, date, place or program changes."}
          </p>
        </div>
        <Badge tone={w.event.bookingPaused ? "warning" : "positive"}>
          {w.event.bookingPaused
            ? "Booking paused"
            : change
              ? "Recovery resolved"
              : "Review before changing"}
        </Badge>
      </div>
      {!change || editing ? (
        <ChangeEditor
          key={change?.id || "new"}
          saved={() => setEditing(false)}
        />
      ) : null}
      {change ? (
        <div className="change-layout">
          <section>
            <div className="change-comparison">
              <div className="change-before">
                <span className="eyebrow">THE CURRENT PROMISE</span>
                {original ? (
                  <span className="supplier-avatar">{original.initials}</span>
                ) : (
                  <ShieldCheck size={30} />
                )}
                <h3>{original?.name || "Terms your guests saw"}</h3>
                <p>
                  {original?.description ||
                    `The accepted proposition is version ${change.expectedTermsVersion}.`}
                </p>
                {original ? (
                  <strong>{formatMoney(original.feeMinor)}</strong>
                ) : null}
                <Badge tone="warning">
                  {original ? "Unavailable" : "Material change proposed"}
                </Badge>
              </div>
              <div className="change-arrow">
                <ArrowRight size={24} />
              </div>
              <div className="change-after">
                <span className="eyebrow">THE PROPOSED NEXT CHAPTER</span>
                {replacement ? (
                  <span className="supplier-avatar">
                    {replacement.initials}
                  </span>
                ) : (
                  <RefreshCw size={30} />
                )}
                <h3>
                  {replacement?.name ||
                    (change.supplierId
                      ? "A replacement is still needed."
                      : "Revised event terms")}
                </h3>
                <p>
                  {replacement?.description ||
                    (change.supplierId
                      ? "Booking stays paused until you have a feasible, confirmed offer."
                      : "The exact differences below become a new proposition after your approval.")}
                </p>
                {replacement ? (
                  <strong>
                    {formatMoney(replacement.feeMinor)}
                    <small>
                      {change.costDeltaMinor >= 0 ? "+" : ""}
                      {formatMoney(change.costDeltaMinor)}
                    </small>
                  </strong>
                ) : null}
                <Badge tone={approved ? "positive" : "warning"}>
                  {approved
                    ? "Approved · choices being resolved"
                    : replacement?.status === "CONFIRMED"
                      ? "Offer confirmed · approval needed"
                      : "Still a proposal"}
                </Badge>
              </div>
            </div>
            <div className="panel change-details">
              <div className="panel-heading">
                <h3>The exact differences.</h3>
                <RefreshCw size={18} />
              </div>
              {change.diff?.map((d) => (
                <div className="diff-row" key={d.field}>
                  <span>{fieldLabel(d.field)}</span>
                  <del>
                    {d.field === "priceMinor"
                      ? formatMoney(Number(d.before))
                      : d.before}
                  </del>
                  <strong>
                    {d.field === "priceMinor"
                      ? formatMoney(Number(d.after))
                      : d.after}
                  </strong>
                </div>
              ))}
              {change.supplierId ? (
                <div className="diff-row">
                  <span>Fixed production cost</span>
                  <del>
                    {formatMoney(
                      cost.fixed - (approved ? change.costDeltaMinor : 0),
                    )}
                  </del>
                  <strong>
                    {formatMoney(
                      cost.fixed + (approved ? 0 : change.costDeltaMinor),
                    )}
                  </strong>
                </div>
              ) : null}
              <div className="diff-row">
                <span>Estimated cost at full capacity</span>
                <del>
                  {formatMoney(cost.total - (approved ? totalCostDelta : 0))}
                </del>
                <strong>
                  {formatMoney(cost.total + (approved ? 0 : totalCostDelta))}
                </strong>
              </div>
              <div className="diff-row">
                <span>Budget headroom after change</span>
                <strong className={funded ? "" : "warning-text"}>
                  {formatMoney(cost.headroom - (approved ? 0 : totalCostDelta))}
                </strong>
              </div>
              <div className="diff-row">
                <span>Existing seat allocations</span>
                <span className="unchanged">
                  <Check size={14} />
                  Held until each choice is resolved
                </span>
              </div>
              <div className="diff-row">
                <span>Guest consent</span>
                <strong className="warning-text">
                  Reconfirmation or withdrawal required
                </strong>
              </div>
            </div>
            <div className="panel reconfirm-panel">
              <div className="panel-heading">
                <div>
                  <h3>Let people choose the new evening.</h3>
                  <p>
                    {change.affectedCommitments} choices and{" "}
                    {change.affectedBookings} bookings were affected when
                    proposed.
                  </p>
                </div>
                <Users size={19} />
              </div>
              {approved && waiting.length ? (
                <div className="response-rows">
                  {waiting.map((c) => (
                    <div className="response-row" key={c.id}>
                      <span className="avatar">{c.displayName[0]}</span>
                      <div>
                        <strong>{c.displayName}</strong>
                        <small>
                          {c.quantity} places · accepted v{c.termsVersion}
                        </small>
                      </div>
                      <Badge tone="warning">Awaiting their choice</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="reconfirm-note">
                  <ShieldCheck size={24} />
                  <h4>
                    {approved
                      ? "Every current choice is resolved."
                      : "The change needs your approval first."}
                  </h4>
                  <p>
                    {approved
                      ? "Review any new operational checks before resuming."
                      : "Approving creates a new terms version. Active choices will stop counting until their holders accept again."}
                  </p>
                </div>
              )}
              <div className="sample-note">
                Guests use their existing private response link to accept or
                withdraw. No email is sent. The producer cannot make that choice
                for them.
              </div>
            </div>
          </section>
          <aside className="recovery-aside">
            <div className="panel recovery-steps">
              <div className="eyebrow">THE WAY FORWARD</div>
              <h3>A careful second act.</h3>
              <ol>
                {[
                  {
                    done: true,
                    title: "Protect current commitments",
                    text: `${counts.remaining} unallocated places. Existing allocations stay held.`,
                  },
                  {
                    done: !unresolvedSupply,
                    title: "Confirm workable supply",
                    text: change.supplierId
                      ? "An exact offer and fresh confirmation are required."
                      : "Recheck any supply affected by time or venue changes.",
                  },
                  {
                    done: !!approved,
                    title: "Approve the exact difference",
                    text: "A changed promise becomes a new terms version.",
                  },
                  {
                    done: !!approved && !waiting.length,
                    title: "Ask each affected guest again",
                    text: "Resolve every response, then resume when operational checks pass.",
                  },
                ].map((step) => (
                  <li key={step.title} className={step.done ? "done" : ""}>
                    {step.done ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Circle size={18} />
                    )}
                    <div>
                      <strong>{step.title}</strong>
                      <span>{step.text}</span>
                    </div>
                  </li>
                ))}
              </ol>
              {!approved ? (
                <>
                  <Button
                    disabled={unresolvedSupply || !funded}
                    onClick={() => setApprove(true)}
                  >
                    Review & approve change
                    <ArrowRight size={15} />
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(!editing)}>
                    {editing ? "Close proposal editor" : "Revise this proposal"}
                  </Button>
                </>
              ) : w.event.bookingPaused ? (
                <>
                  <Button
                    disabled={
                      waiting.length > 0 || pendingProductionChecks.length > 0
                    }
                    busy={busy === "RESUME_BOOKING"}
                    onClick={() => void act("RESUME_BOOKING")}
                  >
                    Resume this production
                    <ArrowRight size={15} />
                  </Button>
                  {pendingProductionChecks.length ? (
                    <p className="warning-text" role="status">
                      Before resuming, review{" "}
                      {pendingProductionChecks.join(" and ")}.
                    </p>
                  ) : null}
                  <ButtonLink
                    href="/studio/events/current/production"
                    variant="ghost"
                  >
                    Review production checks
                  </ButtonLink>
                </>
              ) : (
                <>
                  <ButtonLink href="/studio/events/current/production">
                    Continue production
                    <ArrowRight size={15} />
                  </ButtonLink>
                  <Button variant="ghost" onClick={() => setEditing(!editing)}>
                    Propose another change
                  </Button>
                </>
              )}
              {!funded ? (
                <p className="warning-text">
                  This replacement exceeds the entered budget. Choose a feasible
                  offer.
                </p>
              ) : null}
            </div>
            {replacement && !approved ? (
              <div className="panel replacement-assignment">
                <div className="eyebrow">THE REPLACEMENT’S CHOICE</div>
                <h3>{replacement.name}</h3>
                <p>{replacement.scope}</p>
                <SupplierTools supplier={replacement} />
              </div>
            ) : null}
            {change.supplierId && !replacement ? (
              <div className="editorial-note">
                <span>✳</span>
                <h3>A good replacement starts with a real offer.</h3>
                <p>
                  Add an alternative, including its scope, fee and quote source.
                  Return here to compare it.
                </p>
                <ButtonLink href="/studio/suppliers" variant="secondary">
                  People & offers
                  <ArrowRight size={14} />
                </ButtonLink>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
      {change ? (
        <ApprovalDialog
          open={approve}
          onOpenChange={setApprove}
          action="APPROVE_CHANGE"
          title="Approve the next chapter."
          description="Review the exact differences and cost delta. Affected guests must make their own choice on the revised terms."
          buttonLabel="Approve this exact change"
          payload={{ changeId: change.id }}
          blocked={unresolvedSupply || !funded}
        >
          <div className="approval-check warning">
            <TriangleAlert size={18} />
            <p>
              {change.affectedCommitments} active choices and{" "}
              {change.affectedBookings} bookings were affected. Held seats are
              released only by withdrawal or cancellation.
            </p>
          </div>
        </ApprovalDialog>
      ) : null}
    </>
  );
}

const editableTermsFields = [
  "title",
  "date",
  "doors",
  "end",
  "venue",
  "address",
  "priceMinor",
  "program",
  "access",
] as const;
type TermsPatch = Partial<Pick<Terms, (typeof editableTermsFields)[number]>>;
function ChangeEditor({ saved }: { saved: () => void }) {
  const { workspace: w, act, busy } = useWorkspace();
  const [kind, setKind] = useState<"SUPPLIER" | "TERMS">(
    w?.change?.supplierId ? "SUPPLIER" : "TERMS",
  );
  const [reason, setReason] = useState(
    w?.change?.status === "PROPOSED" ? w.change.reason : "",
  );
  const [supplierId, setSupplierId] = useState(w?.change?.supplierId || "");
  const [replacementId, setReplacementId] = useState(
    w?.change?.replacementId || "",
  );
  const [terms, setTerms] = useState<TermsPatch>({
    title: w?.terms.title,
    date: w?.terms.date,
    doors: w?.terms.doors,
    end: w?.terms.end,
    venue: w?.terms.venue,
    address: w?.terms.address,
    priceMinor: w?.terms.priceMinor,
    program: w?.terms.program,
    access: w?.terms.access,
    ...(w?.change?.status === "PROPOSED" ? w.change.termsPatch : {}),
  });
  const [venue, setVenue] = useState<
    Pick<Venue, "capacity" | "soundLimitDb" | "curfew" | "timezone">
  >({
    capacity: w?.venue.capacity ?? 1,
    soundLimitDb: w?.venue.soundLimitDb ?? 0,
    curfew: w?.venue.curfew ?? "22:00",
    timezone: w?.venue.timezone ?? "Europe/London",
    ...(w?.change?.status === "PROPOSED" ? w.change.venuePatch : {}),
  });
  if (!w) return null;
  const selected = selectedConcept(w)?.supplierIds || [];
  const alternatives = w.suppliers.filter(
    (s) => !selected.includes(s.id) && s.status !== "UNAVAILABLE",
  );
  return (
    <form
      className="panel change-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        const payload =
          kind === "SUPPLIER"
            ? { reason, supplierId, replacementId }
            : {
                reason,
                terms: Object.fromEntries(
                  editableTermsFields.flatMap((key) =>
                    terms[key] !== undefined && terms[key] !== w.terms[key]
                      ? [[key, terms[key]]]
                      : [],
                  ),
                ),
                venue: Object.fromEntries(
                  Object.entries(venue).filter(
                    ([key, value]) => value !== w.venue[key as keyof Venue],
                  ),
                ),
              };
        if ((await act("PROPOSE_CHANGE", payload)).ok) saved();
      }}
    >
      <div className="panel-heading">
        <div>
          <h3>Make the proposed change explicit.</h3>
          <p>
            Saving pauses new bookings. Approval and renewed consent come next.
          </p>
        </div>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>What changed?</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "SUPPLIER" | "TERMS")}
          >
            <option value="TERMS">Date, venue, program or access</option>
            <option value="SUPPLIER">A selected supplier is unavailable</option>
          </select>
        </label>
        <label className="field">
          <span>Why the change is needed</span>
          <input
            required
            minLength={5}
            maxLength={1500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the operational fact, with its source."
          />
        </label>
      </div>
      {kind === "SUPPLIER" ? (
        <>
          <div className="form-grid">
            <label className="field">
              <span>Unavailable supplier</span>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Choose selected supply…</option>
                {w.suppliers
                  .filter((s) => selected.includes(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Proposed replacement</span>
              <select
                value={replacementId}
                onChange={(e) => setReplacementId(e.target.value)}
              >
                <option value="">
                  No replacement yet · keep booking paused
                </option>
                {alternatives.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name} · {formatMoney(s.feeMinor)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="alternative-options">
            {alternatives.map((s) => (
              <div key={s.id}>
                <strong>{s.name}</strong>
                <span>
                  {s.discipline} · {formatMoney(s.feeMinor)}
                </span>
                <p>{s.influence}</p>
                <Badge tone={s.status === "CONFIRMED" ? "positive" : "warning"}>
                  {s.status === "CONFIRMED"
                    ? "Offer confirmed"
                    : "Availability needs confirmation"}
                </Badge>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="form-grid form-grid-three">
            {(["date", "doors", "end"] as const).map((key) => (
              <label className="field" key={key}>
                <span>{fieldLabel(key)}</span>
                <input
                  type={key === "date" ? "date" : "time"}
                  required
                  value={terms[key] || ""}
                  onChange={(e) =>
                    setTerms((t) => ({ ...t, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          {w.mode === "REAL" ||
          selectedConcept(w)?.origin === "MODEL_HYPOTHESIS" ? (
            <p className="field-hint">
              Changing doors proposes the same shift to the selected program and
              setup slots. Review every before-and-after time before approval.
              Suppliers and guests must confirm the updated terms.
            </p>
          ) : null}
          {(["title", "venue", "address", "program", "access"] as const).map(
            (key) => (
              <label className="field" key={key}>
                <span>{fieldLabel(key)}</span>
                <textarea
                  rows={key === "program" || key === "access" ? 3 : 1}
                  required
                  maxLength={2000}
                  value={terms[key] || ""}
                  onChange={(e) =>
                    setTerms((t) => ({ ...t, [key]: e.target.value }))
                  }
                />
              </label>
            ),
          )}
          <div className="form-grid">
            <label className="field">
              <span>Proposed seated capacity</span>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={venue.capacity}
                onChange={(e) =>
                  setVenue((v) => ({ ...v, capacity: Number(e.target.value) }))
                }
              />
            </label>
            <label className="field">
              <span>Proposed sound limit · dB</span>
              <input
                type="number"
                min={0}
                max={140}
                required
                value={venue.soundLimitDb}
                onChange={(e) =>
                  setVenue((v) => ({
                    ...v,
                    soundLimitDb: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Proposed curfew</span>
              <input
                type="time"
                required
                value={venue.curfew}
                onChange={(e) =>
                  setVenue((v) => ({ ...v, curfew: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Proposed time zone</span>
              <input
                required
                maxLength={100}
                value={venue.timezone}
                placeholder="Europe/London"
                onChange={(e) =>
                  setVenue((v) => ({ ...v, timezone: e.target.value }))
                }
              />
            </label>
          </div>
          <p className="field-hint">
            Held places must fit the new room. Supply, timing and the
            full-capacity budget are checked again before approval.
          </p>
          {w.mode === "SAMPLE" ? (
            <label className="field">
              <span>Proposed sample price · GBP</span>
              <input
                type="number"
                min={0}
                max={1000}
                step="0.01"
                value={(terms.priceMinor ?? 0) / 100}
                onChange={(e) =>
                  setTerms((t) => ({
                    ...t,
                    priceMinor: Math.round(Number(e.target.value) * 100),
                  }))
                }
              />
            </label>
          ) : (
            <p className="field-hint">
              Own productions retain free admission. Dates, venue and access
              changes require renewed operational checks.
            </p>
          )}
        </>
      )}
      <div className="form-actions">
        <p className="field-hint">
          This is a proposal. It cannot silently transfer a guest’s consent.
        </p>
        <Button type="submit" busy={busy === "PROPOSE_CHANGE"}>
          Save change for review
          <ArrowRight size={15} />
        </Button>
      </div>
    </form>
  );
}
function fieldLabel(field: string) {
  return (
    (
      {
        title: "Event title",
        date: "Date",
        doors: "Doors",
        end: "Finish",
        venue: "Venue",
        address: "Address",
        program: "Program",
        programSchedule: "Program times",
        setupSchedule: "Setup times",
        access: "Access & guest needs",
        priceMinor: "Price per guest",
        capacity: "Seated capacity",
        soundLimitDb: "Sound limit · dB",
        curfew: "Curfew",
        timezone: "Time zone",
      } as Record<string, string>
    )[field] || field
  );
}

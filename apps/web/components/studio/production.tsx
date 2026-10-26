"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  DoorOpen,
  Fingerprint,
  Plus,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  assessOfferSchedule,
  costWorksheet,
  countsFor,
  formatMoney,
  selectedConcept,
  type ProductionTask,
  type Requirement,
} from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, ButtonLink, EmptyState } from "../ui";
import { ApprovalDialog } from "../approval-dialog";
import { SupplierTools } from "./suppliers";
import { eventDate } from "@/lib/format";
export function ProductionView() {
  const { workspace: w, act, busy } = useWorkspace();
  const [approve, setApprove] = useState(false);
  if (!w) return null;
  const c = selectedConcept(w),
    cost = costWorksheet(w),
    counts = countsFor(w);
  if (!c)
    return (
      <EmptyState
        icon={<ClipboardCheck size={24} />}
        title="First, find the evening’s character."
        action={
          <ButtonLink href="/studio/events/current/concepts">
            Explore the concepts <ArrowRight size={16} />
          </ButtonLink>
        }
      >
        A selected concept gives the production a practical starting point. Then
        confirm the people, costs, and responsibilities.
      </EmptyState>
    );
  const suppliers = w.suppliers.filter((s) => c.supplierIds.includes(s.id));
  const explicitSchedule = w.mode === "REAL" || c.origin === "MODEL_HYPOTHESIS";
  const schedule = explicitSchedule
    ? assessOfferSchedule(suppliers, w.terms.doors, w.terms.end)
    : null;
  const scheduleIssues = schedule
    ? [
        ...schedule.violations,
        ...schedule.unresolvedProgram,
        ...schedule.unresolvedSetup,
      ]
    : [];
  const schedulePending = explicitSchedule && !w.terms.programSchedule?.length;
  const visibleSchedule = schedulePending
    ? w.runOfShow.filter((item) => ["doors", "close"].includes(item.id))
    : w.runOfShow;
  const gates =
    suppliers.filter((s) => s.status === "CONFIRMED").length +
    w.requirements.filter((r) => r.confirmed).length;
  const gateTotal = suppliers.length + w.requirements.length;
  const cleared =
    gates === gateTotal &&
    cost.headroom >= 0 &&
    w.venue.availability === "AVAILABLE" &&
    scheduleIssues.length === 0 &&
    !schedulePending;
  const confirmed = [
    "CONFIRMED",
    "BOOKING_OPEN",
    "READY",
    "LIVE",
    "COMPLETED",
  ].includes(w.event.lifecycle);
  const taskCount = w.tasks.filter((t) => t.done).length;
  return (
    <>
      <div className="production-lead">
        <div className="section-intro">
          <div className="eyebrow">04 / MAKE IT HAPPEN</div>
          <h2>Good nights are in the details.</h2>
          <p>
            The people, permissions, and practicalities behind a room that feels
            effortless.
          </p>
        </div>
        <div className="readiness-pill">
          <span className={`readiness-ring ${cleared ? "ready" : ""}`}>
            {gates}
            <small>/{gateTotal}</small>
          </span>
          <div>
            <strong>
              {confirmed
                ? "Owner approved"
                : cleared
                  ? "Ready for your decision"
                  : "Bringing it together"}
            </strong>
            <small>
              {gateTotal -
                gates +
                scheduleIssues.length +
                (schedulePending ? 1 : 0)}{" "}
              unresolved production requirements
            </small>
          </div>
        </div>
      </div>
      {w.event.bookingPaused ? (
        <div className="recovery-alert">
          <TriangleAlert size={23} />
          <div>
            <strong>A change to the evening needs your attention.</strong>
            <p>
              Bookings are paused. Existing allocations are preserved while the
              replacement and revised terms are reviewed.
            </p>
          </div>
          <ButtonLink href="/studio/events/current/changes/current">
            Review the change <ArrowRight size={15} />
          </ButtonLink>
        </div>
      ) : null}
      <div className="production-layout">
        <section className="production-primary">
          <div className="panel suppliers-panel">
            <div className="panel-heading">
              <div>
                <h3>The people behind the night</h3>
                <p>Recorded offers. Explicit availability, source and scope.</p>
              </div>
              <Badge>
                {suppliers.filter((s) => s.status === "CONFIRMED").length}/
                {suppliers.length} confirmed
              </Badge>
            </div>
            {suppliers.map((s) => (
              <div className="supplier-row" key={s.id}>
                <span
                  className={`supplier-avatar ${s.id === "little-table" ? "olive" : ""}`}
                >
                  {s.initials}
                </span>
                <div className="supplier-info">
                  <span>{s.discipline}</span>
                  <strong>{s.name}</strong>
                  <p>{s.scope}</p>
                  <SupplierTools supplier={s} />
                </div>
                <div className="supplier-actions">
                  <strong>{formatMoney(s.feeMinor)}</strong>
                  <Badge
                    tone={
                      s.status === "CONFIRMED"
                        ? "positive"
                        : s.status === "UNAVAILABLE"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {s.status.toLowerCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="panel requirements-panel">
            <div className="panel-heading">
              <div>
                <h3>The responsibilities</h3>
                <p>A named owner and a recorded check for each gate.</p>
              </div>
              <ShieldCheck size={21} />
            </div>
            {w.requirements.map((r) => (
              <RequirementRow key={r.id} requirement={r} />
            ))}
          </div>
          <div className="panel run-of-show">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">
                  {eventDate(w.terms.date).toUpperCase()}
                </div>
                <h3>The rhythm of the evening</h3>
              </div>
              <Badge dot={false}>{w.venue.timezone}</Badge>
            </div>
            {scheduleIssues.length || schedulePending ? (
              <div className="schedule-review" role="status">
                <strong>Exact timing needs review.</strong>
                <ul>
                  {scheduleIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                  {schedulePending ? (
                    <li>
                      Program times have not been captured in the exact event
                      terms.
                    </li>
                  ) : null}
                </ul>
                <p>
                  {w.event.publishedAt
                    ? "Use a reviewed replacement offer for any changed slot. Guests must approve the updated program."
                    : "Enter the times on each supplier offer, then choose a current proposal."}
                </p>
                <ButtonLink
                  href={
                    w.event.publishedAt
                      ? "/studio/events/current/changes/current"
                      : "/studio/suppliers"
                  }
                  variant="secondary"
                >
                  Review timing <ArrowRight size={15} />
                </ButtonLink>
              </div>
            ) : null}
            <div className="timeline">
              {visibleSchedule.map((item, i) => (
                <div className="timeline-row" key={item.id}>
                  <span className="timeline-time">{item.time}</span>
                  <span
                    className={`timeline-node ${i === 3 ? "featured" : ""}`}
                  />
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.detail}</p>
                    <small>{item.owner}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {confirmed ? (
            <div className="panel task-panel">
              <div className="panel-heading">
                <div>
                  <h3>Before the doors open</h3>
                  <p>
                    Complete each task with a short record of what was checked.
                  </p>
                </div>
                <Badge
                  tone={taskCount === w.tasks.length ? "positive" : "neutral"}
                >
                  {taskCount}/{w.tasks.length} complete
                </Badge>
              </div>
              {w.tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          ) : null}
          {confirmed ? (
            <div className="panel guest-panel">
              <div className="panel-heading">
                <div>
                  <h3>The guest list</h3>
                  <p>
                    {counts.bookings} allocated{" "}
                    {w.mode === "SAMPLE" ? "sample " : ""}places ·{" "}
                    {counts.checkins} arrivals
                  </p>
                </div>
                <Users size={19} />
              </div>
              {w.bookings.filter((b) => b.status !== "CANCELLED").length ? (
                <div className="response-rows">
                  {w.bookings
                    .filter((b) => b.status !== "CANCELLED")
                    .map((b) => (
                      <div className="response-row" key={b.id}>
                        <span className="avatar">
                          {b.displayName.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <strong>{b.displayName}</strong>
                          <small>
                            {b.quantity} {b.quantity === 1 ? "place" : "places"}{" "}
                            · terms v{b.termsVersion}
                          </small>
                        </div>
                        {b.checkedIn ? (
                          <Badge tone="positive">Checked in</Badge>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={
                              !["READY", "LIVE"].includes(w.event.lifecycle) ||
                              b.status !== "CONFIRMED" ||
                              w.event.bookingPaused
                            }
                            busy={busy === "CHECK_IN"}
                            onClick={() =>
                              void act("CHECK_IN", { bookingId: b.id })
                            }
                          >
                            Check in <Check size={14} />
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="inline-empty">
                  No bookings yet. Confirmed audience choices can book once you
                  open booking.
                </div>
              )}
            </div>
          ) : null}
        </section>
        <aside className="production-aside">
          <div className="panel cost-panel">
            <div className="eyebrow">THE WORKING NUMBERS</div>
            <h3>A night that adds up.</h3>
            <div className="cost-total">
              <span>Full-room production cost</span>
              <strong>{formatMoney(cost.total)}</strong>
              <small>
                At {w.venue.capacity} guests ·{" "}
                {w.mode === "SAMPLE" ? "sample" : "entered"} GBP costs
              </small>
            </div>
            <dl>
              <div>
                <dt>Fixed production costs</dt>
                <dd>{formatMoney(cost.fixed)}</dd>
              </div>
              <div>
                <dt>Per guest</dt>
                <dd>{formatMoney(cost.variable)}</dd>
              </div>
              <div>
                <dt>
                  {w.terms.priceMinor === 0
                    ? "Guest price · free"
                    : "Scenario ticket price"}
                </dt>
                <dd>{formatMoney(w.terms.priceMinor)}</dd>
              </div>
              <div>
                <dt>Production budget</dt>
                <dd>{formatMoney(w.brief.budgetMinor)}</dd>
              </div>
              <div className="cost-headroom">
                <dt>Budget headroom</dt>
                <dd>{formatMoney(cost.headroom)}</dd>
              </div>
            </dl>
            <div className="break-even">
              <span className="break-even-number">
                {w.terms.priceMinor === 0 ? "£0" : (cost.breakEven ?? "—")}
                {w.terms.priceMinor ? <small>/{w.venue.capacity}</small> : null}
              </span>
              <div>
                <strong>
                  {w.terms.priceMinor === 0
                    ? "Host-funded production"
                    : "places to break even"}
                </strong>
                <small>
                  {w.terms.priceMinor === 0
                    ? "Costs must fit the funded budget above."
                    : "Based on entered costs, not predicted demand."}
                </small>
              </div>
            </div>
          </div>
          <div className="greenlight-panel">
            <div className="eyebrow">
              <span className="status-dot" />
              THE NEXT DECISION
            </div>
            <h3>
              {w.event.lifecycle === "COMPLETED"
                ? "The evening is complete."
                : w.event.lifecycle === "LIVE"
                  ? "Let the evening unfold."
                  : w.event.lifecycle === "READY"
                    ? "The room is ready."
                    : confirmed
                      ? "From approved to happening."
                      : "Yours to greenlight."}
            </h3>
            <p>
              {!confirmed
                ? "Confirm the people and responsibilities, then approve the exact production terms. Audience interest informs your choice. It never makes the decision for you."
                : w.event.lifecycle === "CONFIRMED"
                  ? "Your approval is saved. Open bookings when you are ready to allocate places."
                  : w.event.lifecycle === "BOOKING_OPEN"
                    ? "Complete the operational checks before welcoming guests. Every allocated place is capacity-checked."
                    : "Keep a clear record of what actually happened."}
            </p>
            {w.event.lifecycle === "VALIDATION_OPEN" ? (
              <Button onClick={() => setApprove(true)}>
                Review greenlight <ArrowRight size={16} />
              </Button>
            ) : w.event.lifecycle === "CONCEPT_READY" ? (
              <ButtonLink href="/studio/events/current/demand">
                Publish the proposal first <ArrowRight size={15} />
              </ButtonLink>
            ) : w.event.lifecycle === "CONFIRMED" ? (
              <Button
                busy={busy === "OPEN_BOOKING"}
                onClick={() => void act("OPEN_BOOKING")}
              >
                Open {w.mode === "SAMPLE" ? "sample " : "free "}bookings{" "}
                <ArrowRight size={16} />
              </Button>
            ) : w.event.lifecycle === "BOOKING_OPEN" ? (
              <Button
                disabled={taskCount !== w.tasks.length || w.event.bookingPaused}
                busy={busy === "MARK_READY"}
                onClick={() => void act("MARK_READY")}
              >
                Mark the production ready <Check size={16} />
              </Button>
            ) : w.event.lifecycle === "READY" ? (
              <Button
                busy={busy === "START_EVENT"}
                onClick={() => void act("START_EVENT")}
              >
                Open the doors <DoorOpen size={16} />
              </Button>
            ) : w.event.lifecycle === "LIVE" ? (
              <CompletionControl />
            ) : (
              <ButtonLink href="/studio/events/current/results">
                See the outcome <ArrowRight size={16} />
              </ButtonLink>
            )}
            {!confirmed && !cleared ? (
              <span className="greenlight-blocked">
                {gateTotal - gates} requirements still need confirmation.
              </span>
            ) : null}
            <div className="approval-note">
              <Fingerprint size={13} />
              {w.approvals.length} versioned{" "}
              {w.approvals.length === 1 ? "approval" : "approvals"} recorded
            </div>
          </div>
          <ProductionChanges />
        </aside>
      </div>
      <ApprovalDialog
        open={approve}
        onOpenChange={setApprove}
        action="GREENLIGHT"
        title="Let’s make this night happen."
        description="Approve the exact production terms and the recorded operational checks. No external messages or payments are sent by this action."
        buttonLabel="Greenlight this version"
        blocked={!cleared}
      >
        <div className={`approval-check ${cleared ? "positive" : "warning"}`}>
          {cleared ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
          <p>
            {cleared
              ? "Supplier terms, owner responsibilities, and the entered budget are ready."
              : `Confirm all ${gateTotal} supplier and responsibility gates, and clear budget/availability constraints before approval.`}
          </p>
        </div>
      </ApprovalDialog>
    </>
  );
}
function CompletionControl() {
  const { workspace: w, act, busy } = useWorkspace();
  const [evidence, setEvidence] = useState("");
  if (!w) return null;
  return (
    <form
      className="completion-control"
      onSubmit={(e) => {
        e.preventDefault();
        void act("COMPLETE_EVENT", w.mode === "REAL" ? { evidence } : {});
      }}
    >
      {w.mode === "REAL" ? (
        <label className="field">
          <span>What actually happened?</span>
          <textarea
            value={evidence}
            required
            minLength={5}
            maxLength={2000}
            rows={3}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Record completion, who observed it, and any unresolved issues."
          />
        </label>
      ) : (
        <p className="field-hint">
          Completing records the end of this fictional rehearsal. It is not
          evidence of a physical event.
        </p>
      )}
      <Button type="submit" busy={busy === "COMPLETE_EVENT"}>
        Complete the {w.mode === "SAMPLE" ? "rehearsal" : "production"}
        <CheckCircle2 size={16} />
      </Button>
    </form>
  );
}
function ProductionChanges() {
  const { workspace: w } = useWorkspace();
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState("");
  if (
    !w ||
    !w.event.publishedAt ||
    ["COMPLETED", "CANCELLED"].includes(w.event.lifecycle)
  )
    return null;
  return (
    <div className="rehearsal-panel">
      <div className="eyebrow">WHEN PLANS CHANGE</div>
      <h3>A resilient production has a second act.</h3>
      <p>
        Review any supplier loss, date, place, program or access change.
        Existing allocations stay protected while people decide again.
      </p>
      {w.event.lifecycle !== "LIVE" ? (
        <ButtonLink
          href="/studio/events/current/changes/current"
          variant="secondary"
        >
          Review a change of plan
          <ArrowUpRight size={14} />
        </ButtonLink>
      ) : null}
      <Button variant="ghost" onClick={() => setCancel(true)}>
        Cancel this production
      </Button>
      <ApprovalDialog
        open={cancel}
        onOpenChange={setCancel}
        action="CANCEL_EVENT"
        title="Close this evening’s doors."
        description="Cancelling releases every app-managed place and marks the public invitation and private response links as cancelled. No message or refund is sent; ASSEMBLY has not collected payment."
        buttonLabel="Cancel this production"
        payload={{ reason }}
        blocked={reason.trim().length < 5}
      >
        <label className="field">
          <span>Reason for cancellation</span>
          <textarea
            rows={3}
            required
            minLength={5}
            maxLength={1500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </ApprovalDialog>
    </div>
  );
}
function RequirementRow({ requirement: r }: { requirement: Requirement }) {
  const { act, busy } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState("");
  return (
    <div className={`requirement-row ${r.confirmed ? "done" : ""}`}>
      <div className="requirement-main">
        {r.confirmed ? <CheckCircle2 size={19} /> : <Circle size={19} />}
        <div>
          <strong>{r.label}</strong>
          <p>{r.confirmed ? r.proof : r.detail}</p>
        </div>
        {!r.confirmed ? (
          <Button variant="ghost" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Record check"}
            <ChevronDown size={14} />
          </Button>
        ) : (
          <span className="verified-label">Recorded</span>
        )}
      </div>
      {open && !r.confirmed ? (
        <form
          className="proof-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await act("CONFIRM_REQUIREMENT", {
              requirementId: r.id,
              proof,
            });
            if (result.ok) setOpen(false);
          }}
        >
          <label className="field">
            <span>What did you check?</span>
            <textarea
              required
              minLength={5}
              maxLength={1000}
              rows={2}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder="Record the responsible person and what was reviewed."
            />
          </label>
          <Button type="submit" busy={busy === "CONFIRM_REQUIREMENT"}>
            Save responsibility check <Check size={14} />
          </Button>
        </form>
      ) : null}
    </div>
  );
}
function TaskRow({ task: t }: { task: ProductionTask }) {
  const { workspace: w, act, busy } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const dependencies = t.dependencyIds.map((id) =>
    w?.tasks.find((item) => item.id === id),
  );
  const blocked = dependencies.some((d) => !d?.done);
  return (
    <div className={`task-row ${t.done ? "done" : ""}`}>
      <div className="task-main">
        {t.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        <div>
          <strong>{t.label}</strong>
          <small>
            {t.owner} · {t.due}
            {blocked
              ? ` · First: ${dependencies
                  .filter((d) => !d?.done)
                  .map((d) => d?.label)
                  .join(", ")}`
              : ""}
          </small>
          {t.done ? <p>{t.evidence}</p> : null}
        </div>
        {!t.done ? (
          <Button
            variant="ghost"
            disabled={blocked}
            onClick={() => setOpen(!open)}
          >
            {open ? "Close" : "Complete"}
            <Plus size={14} />
          </Button>
        ) : null}
      </div>
      {open && !t.done ? (
        <form
          className="proof-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await act("COMPLETE_TASK", {
              taskId: t.id,
              evidence,
            });
            if (result.ok) setOpen(false);
          }}
        >
          <label className="field">
            <span>Completion evidence</span>
            <input
              required
              minLength={5}
              maxLength={1000}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="What was completed and checked?"
            />
          </label>
          <Button type="submit" busy={busy === "COMPLETE_TASK"}>
            Record completed task <Check size={14} />
          </Button>
        </form>
      ) : null}
    </div>
  );
}

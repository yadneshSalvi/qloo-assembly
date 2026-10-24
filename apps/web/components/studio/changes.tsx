"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { costWorksheet, formatMoney } from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { ApprovalDialog } from "../approval-dialog";
import { Badge, Button, ButtonLink, EmptyState } from "../ui";
export function ChangesView() {
  const { workspace: w, act, busy } = useWorkspace();
  const [approve, setApprove] = useState(false);
  if (!w) return null;
  const change = w.change;
  if (!change)
    return (
      <EmptyState
        icon={<ShieldCheck size={24} />}
        title="Everything is on the same page."
        action={
          <ButtonLink href="/studio/events/blue-hour/production">
            Back to production <ArrowRight size={15} />
          </ButtonLink>
        }
      >
        There is no proposed change. The production desk keeps suppliers,
        commitments, and current terms together.
      </EmptyState>
    );
  const replacement = w.suppliers.find((s) => s.id === change.replacementId)!;
  const original = w.suppliers.find((s) => s.id === change.supplierId)!;
  const waiting = w.commitments.filter(
    (c) => c.status === "RECONFIRM_REQUIRED",
  );
  const approved = change.status === "APPROVED";
  return (
    <>
      <Link
        className="text-link back-link"
        href="/studio/events/blue-hour/production"
      >
        <ArrowLeft size={14} />
        Back to the production
      </Link>
      <div className="section-intro change-intro">
        <div>
          <div className="eyebrow">A CHANGE OF PLAN / RECOVERY 001</div>
          <h2>
            A new set.
            <br />
            <em>The same shared evening.</em>
          </h2>
          <p>
            {change.reason} The plan can adapt. Your audience’s choice must
            adapt with it.
          </p>
        </div>
        <Badge tone={w.event.bookingPaused ? "warning" : "positive"}>
          {w.event.bookingPaused ? "Booking paused" : "Recovery complete"}
        </Badge>
      </div>
      <div className="change-layout">
        <section>
          <div className="change-comparison">
            <div className="change-before">
              <span className="eyebrow">THE ORIGINAL PLAN</span>
              <span className="supplier-avatar">{original.initials}</span>
              <h3>{change.before}</h3>
              <p>{original.description}</p>
              <strong>{formatMoney(original.feeMinor)}</strong>
              <Badge tone="warning">Unavailable in sample</Badge>
            </div>
            <div className="change-arrow">
              <ArrowRight size={24} />
            </div>
            <div className="change-after">
              <span className="eyebrow">THE PROPOSED REPLACEMENT</span>
              <span className="supplier-avatar">{replacement.initials}</span>
              <h3>{change.after}</h3>
              <p>{replacement.description}</p>
              <strong>
                {formatMoney(replacement.feeMinor)}{" "}
                <small>+{formatMoney(change.costDeltaMinor)}</small>
              </strong>
              <Badge
                tone={
                  replacement.status === "CONFIRMED" ? "positive" : "warning"
                }
              >
                {replacement.status === "CONFIRMED"
                  ? "Sample offer confirmed"
                  : "Awaiting sample confirmation"}
              </Badge>
            </div>
          </div>
          <div className="panel change-details">
            <div className="panel-heading">
              <h3>What changes. What carries on.</h3>
              <RefreshCw size={18} />
            </div>
            <div className="diff-row">
              <span>Live program</span>
              <del>{change.before}</del>
              <strong>{change.after}</strong>
            </div>
            <div className="diff-row">
              <span>Fixed production cost</span>
              <del>
                {formatMoney(
                  costWorksheet(w).fixed -
                    (approved ? change.costDeltaMinor : 0),
                )}
              </del>
              <strong>
                {formatMoney(
                  costWorksheet(w).fixed +
                    (approved ? 0 : change.costDeltaMinor),
                )}
              </strong>
            </div>
            <div className="diff-row">
              <span>Date, venue & ticket price</span>
              <span className="unchanged">
                <Check size={14} />
                Preserved
              </span>
            </div>
            <div className="diff-row">
              <span>Food, room & access work</span>
              <span className="unchanged">
                <Check size={14} />
                Preserved
              </span>
            </div>
            <div className="diff-row">
              <span>Soundcheck & guest briefing</span>
              <strong className="warning-text">Must be checked again</strong>
            </div>
            <div className="diff-row">
              <span>Audience commitments</span>
              <strong className="warning-text">
                Explicit reconfirmation required
              </strong>
            </div>
          </div>
          <div className="panel reconfirm-panel">
            <div className="panel-heading">
              <div>
                <h3>Let each person choose again.</h3>
                <p>A material program change creates a new proposition.</p>
              </div>
              <Users size={19} />
            </div>
            {approved && waiting.length ? (
              <div className="response-rows">
                {waiting.map((c) => (
                  <div className="response-row" key={c.id}>
                    <span className="avatar">
                      {c.displayName.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{c.displayName}</strong>
                      <small>
                        {c.quantity} {c.quantity === 1 ? "place" : "places"} ·
                        previous terms v{c.termsVersion}
                      </small>
                    </div>
                    <ButtonLink
                      href={`/commitments/${c.token}`}
                      variant="secondary"
                    >
                      Review new terms <ArrowRight size={14} />
                    </ButtonLink>
                  </div>
                ))}
              </div>
            ) : (
              <div className="reconfirm-note">
                <InfoNote
                  approved={approved}
                  count={change.affectedCommitments}
                />
              </div>
            )}
            <div className="sample-note">
              Sample confirmation links stay inside this browser session. No
              email or other message is sent.
            </div>
          </div>
        </section>
        <aside className="recovery-aside">
          <div className="panel recovery-steps">
            <div className="eyebrow">THE WAY FORWARD</div>
            <h3>A careful second act.</h3>
            <ol>
              <li className="done">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Protect the current commitments</strong>
                  <span>Pause booking. Preserve seat allocations.</span>
                </div>
              </li>
              <li className={replacement.status === "CONFIRMED" ? "done" : ""}>
                {replacement.status === "CONFIRMED" ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <Circle size={18} />
                )}
                <div>
                  <strong>Confirm the replacement</strong>
                  <span>
                    Same slot, same sound limit, +
                    {formatMoney(change.costDeltaMinor)}.
                  </span>
                </div>
              </li>
              <li className={approved ? "done" : ""}>
                {approved ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                <div>
                  <strong>Approve the exact change</strong>
                  <span>New program, new terms version.</span>
                </div>
              </li>
              <li className={approved && !waiting.length ? "done" : ""}>
                {approved && !waiting.length ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <Circle size={18} />
                )}
                <div>
                  <strong>Let affected people reconfirm</strong>
                  <span>Reconfirm or withdraw before resuming.</span>
                </div>
              </li>
            </ol>
            {replacement.status !== "CONFIRMED" ? (
              <Button
                busy={busy === "CONFIRM_SUPPLIER"}
                onClick={() =>
                  void act("CONFIRM_SUPPLIER", { supplierId: replacement.id })
                }
              >
                Confirm replacement offer <Check size={14} />
              </Button>
            ) : !approved ? (
              <Button onClick={() => setApprove(true)}>
                Review & approve change <ArrowRight size={15} />
              </Button>
            ) : w.event.bookingPaused ? (
              <Button
                disabled={waiting.length > 0}
                busy={busy === "RESUME_BOOKING"}
                onClick={() => void act("RESUME_BOOKING")}
              >
                Resume sample booking <ArrowRight size={15} />
              </Button>
            ) : (
              <ButtonLink href="/studio/events/blue-hour/production">
                Continue the production <ArrowRight size={15} />
              </ButtonLink>
            )}
          </div>
          <div className="editorial-note">
            <span>✳</span>
            <h3>A replacement is a proposal, too.</h3>
            <p>{replacement.influence}</p>
            <div className="note-signoff">OPERATOR / EDITORIAL INFERENCE</div>
          </div>
        </aside>
      </div>
      <ApprovalDialog
        open={approve}
        onOpenChange={setApprove}
        action="APPROVE_CHANGE"
        title="Approve the second act."
        description={`Replace ${change.before} with ${change.after}. The fixed cost increases by ${formatMoney(change.costDeltaMinor)}; affected choices will require reconfirmation.`}
        buttonLabel="Approve this exact change"
        payload={{ changeId: change.id }}
      >
        <div className="approval-check warning">
          <TriangleAlert size={18} />
          <p>
            {change.affectedCommitments} audience choices and{" "}
            {change.affectedBookings} sample bookings were affected when the
            disruption was recorded. Current active choices will be marked for
            reconfirmation.
          </p>
        </div>
      </ApprovalDialog>
    </>
  );
}
function InfoNote({ approved, count }: { approved: boolean; count: number }) {
  return (
    <>
      <ShieldCheck size={24} />
      <h4>
        {approved
          ? "All current choices are resolved."
          : "No one is silently moved to a new program."}
      </h4>
      <p>
        {approved
          ? "You can resume bookings once the replacement is approved. Any new guest sees the current terms."
          : `${count} audience ${count === 1 ? "choice" : "choices"} will need an explicit response after approval. Withdrawals release their sample places.`}
      </p>
    </>
  );
}

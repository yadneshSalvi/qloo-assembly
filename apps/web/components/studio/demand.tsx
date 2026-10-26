"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Fingerprint,
  Info,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  assessOfferSchedule,
  countsFor,
  formatMoney,
  selectedConcept,
} from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, ButtonLink, EmptyState } from "../ui";
import { ApprovalDialog } from "../approval-dialog";
import { Poster } from "../poster";
import { eventDate } from "@/lib/format";
export function DemandView() {
  const { workspace: w } = useWorkspace();
  const [approve, setApprove] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!w) return null;
  const c = selectedConcept(w),
    counts = countsFor(w);
  if (!c)
    return (
      <EmptyState
        icon={<Users size={25} />}
        title="Give people something to choose."
        action={
          <ButtonLink href="/studio/events/current/concepts">
            Choose a concept <ArrowRight size={15} />
          </ButtonLink>
        }
      >
        Select a concept before publishing an exact proposal. Interest is always
        tied to the event terms people actually saw.
      </EmptyState>
    );
  const published = !!w.event.publishedAt;
  const schedule =
    w.mode === "REAL" || c.origin === "MODEL_HYPOTHESIS"
      ? assessOfferSchedule(
          w.suppliers.filter((s) => c.supplierIds.includes(s.id)),
          w.terms.doors,
          w.terms.end,
        )
      : null;
  const scheduleIssues = schedule
    ? [...schedule.violations, ...schedule.unresolvedProgram]
    : [];
  return (
    <>
      <div className="section-intro">
        <div className="eyebrow">03 / INVITE A REAL CHOICE</div>
        <h2>A good idea deserves a response.</h2>
        <p>
          Ask people if they would come, on clear terms. Interest is a signal —
          never a ticket.
        </p>
      </div>
      <div className="demand-metrics">
        <Metric
          number={counts.interested}
          label="Expressed interest"
          detail={
            w.mode === "SAMPLE"
              ? "Rehearsal responses · active terms"
              : "Response quantities · active terms"
          }
        />
        <Metric
          number={counts.verified}
          label="Confirmed, current choices"
          detail={`Private-link consent · terms v${w.terms.version}`}
          accent
        />
        <Metric
          number={counts.bookings}
          label={
            w.mode === "SAMPLE" ? "Confirmed sample places" : "Confirmed places"
          }
          detail="Allocated places · no payment"
        />
        <Metric
          number={counts.checkins}
          label="Checked in"
          detail={
            w.mode === "SAMPLE"
              ? "Recorded rehearsal arrivals"
              : "Operator-recorded arrivals"
          }
        />
      </div>
      <div className="demand-layout">
        <section className="demand-main">
          <div className="panel-heading">
            <div>
              <h3>The conditional proposal</h3>
              <p>Exactly what people will be asked to consider.</p>
            </div>
            <Badge tone={published ? "positive" : "warning"}>
              {published
                ? "Interest collection open"
                : "Awaiting your approval"}
            </Badge>
          </div>
          <div className="proposal-preview">
            <div className="proposal-preview-art">
              <Poster
                variant={c.art}
                compact
                title={w.terms.title}
                venueName={w.venue.name}
                date={w.terms.date}
                doors={w.terms.doors}
                location={w.venue.neighborhood}
                capacity={w.venue.capacity}
                category={c.category}
              />
            </div>
            <div>
              <div className="eyebrow">
                AN EVENING AT {w.venue.name.toUpperCase()}
              </div>
              <h3>{w.terms.title}</h3>
              <p>{c.subtitle}</p>
              <div className="proposal-details">
                <span>
                  {eventDate(w.terms.date, true)} · {w.terms.doors}–
                  {w.terms.end}
                </span>
                <span>
                  {w.venue.name} · {w.venue.neighborhood}
                </span>
                <span>
                  {formatMoney(w.terms.priceMinor)} per person if the event goes
                  ahead
                </span>
              </div>
              <Badge tone="warning">
                Conditional interest · no ticket or payment
              </Badge>
            </div>
          </div>
          <div className="terms-note">
            <ShieldCheck size={19} />
            <div>
              <strong>Plain terms. A genuine choice.</strong>
              <p>{w.terms.notice}</p>
              <p>
                A material change to the date, venue, price, program, or access
                conditions requires a new confirmation.
              </p>
            </div>
          </div>
          <div className="proposal-actions">
            <span className="terms-fingerprint">
              <Fingerprint size={13} />
              Terms v{w.terms.version} · {w.terms.hash.slice(0, 8)}
            </span>
            {!published ? (
              <Button onClick={() => setApprove(true)}>
                Review & publish proposal <ArrowRight size={16} />
              </Button>
            ) : (
              <ButtonLink href={`/events/${w.event.slug}`} variant="secondary">
                Open attendee experience <ArrowUpRight size={16} />
              </ButtonLink>
            )}
          </div>
          {!published && scheduleIssues.length ? (
            <div className="schedule-review" role="status">
              <strong>Confirm the program times before publishing.</strong>
              <ul>
                {scheduleIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <ButtonLink href="/studio/suppliers" variant="secondary">
                Review offer times <ArrowRight size={15} />
              </ButtonLink>
            </div>
          ) : null}
          <div className="audience-list">
            <div className="panel-heading">
              <div>
                <h3>The responses</h3>
                <p>Only confirmed choices on the current terms count.</p>
              </div>
              <span className="small-count">{w.commitments.length}</span>
            </div>
            {w.commitments.length ? (
              <div className="response-rows">
                {w.commitments.map((r) => (
                  <div className="response-row" key={r.id}>
                    <span className="avatar">
                      {r.displayName.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{r.displayName}</strong>
                      <small>
                        {r.quantity} {r.quantity === 1 ? "place" : "places"}
                      </small>
                    </div>
                    <Badge
                      tone={
                        r.status === "VERIFIED"
                          ? "positive"
                          : r.status === "WITHDRAWN"
                            ? "neutral"
                            : "warning"
                      }
                    >
                      {r.status === "VERIFIED"
                        ? "confirmed choice"
                        : r.status.toLowerCase().replaceAll("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Users size={23} />}
                title="The first conversation is still ahead."
                action={
                  published ? (
                    <ButtonLink
                      href={`/events/${w.event.slug}`}
                      variant="secondary"
                    >
                      Open the attendee invitation <ArrowUpRight size={15} />
                    </ButtonLink>
                  ) : undefined
                }
              >
                No one has expressed interest yet. Publish the proposal, then
                share its link and let each guest make their own choice.
              </EmptyState>
            )}
          </div>
        </section>
        <aside className="demand-aside">
          <div className="panel share-panel">
            <div className="eyebrow">
              THE DOOR IS {published ? "OPEN" : "ALMOST OPEN"}
            </div>
            <h3>
              A little invitation.
              <br />
              <em>A clear commitment.</em>
            </h3>
            <p>
              Share the published invitation. Guests use their own browser and
              receive a private response link.
            </p>
            {published ? (
              <ButtonLink href={`/events/${w.event.slug}`} variant="secondary">
                Open the published event <ExternalLink size={14} />
              </ButtonLink>
            ) : (
              <p className="field-hint">
                Review and approve the proposal to create its public invitation.
              </p>
            )}
            {published ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/events/${w.event.slug}`,
                    );
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}{" "}
                {copied ? "Link copied" : "Copy invitation link"}
              </Button>
            ) : null}
            <small>
              This link opens this production in any browser. Guests cannot see
              your desk or anyone else’s response. No message is sent.
            </small>
          </div>
          <div className="count-definition">
            <Info size={16} />
            <div>
              <h4>Every number means one thing.</h4>
              <p>
                <strong>Interest</strong> is an active response quantity.
              </p>
              <p>
                <strong>Confirmed</strong> means the holder of a private link
                accepted the current terms. It does not verify identity.
              </p>
              <p>
                <strong>Booking</strong> allocates places from this production’s
                capacity.
              </p>
              <p>
                <strong>Check-in</strong> records attendance separately.
              </p>
            </div>
          </div>
          {published ? (
            <div className="next-step-panel">
              <div className="eyebrow">WHILE THE WORD SPREADS</div>
              <h3>Bring the people behind the night together.</h3>
              <ButtonLink
                href="/studio/events/current/production"
                variant="ghost"
              >
                Open production <ArrowRight size={16} />
              </ButtonLink>
            </div>
          ) : null}
        </aside>
      </div>
      <ApprovalDialog
        blocked={scheduleIssues.length > 0}
        open={approve}
        onOpenChange={setApprove}
        action="PUBLISH"
        title="Let people in on the idea."
        description="Approve the exact conditional proposal before opening interest collection. Share the link yourself when you are ready."
        buttonLabel="Approve & publish proposal"
      />
    </>
  );
}
function Metric({
  number,
  label,
  detail,
  accent = false,
}: {
  number: number;
  label: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={`metric ${accent ? "metric-accent" : ""}`}>
      <span>{label}</span>
      <strong>{number.toString().padStart(2, "0")}</strong>
      <small>{detail}</small>
    </div>
  );
}

"use client";
import Link from "next/link";
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
import { countsFor, formatMoney, selectedConcept } from "@assembly/contracts";
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
          <ButtonLink href="/studio/events/blue-hour/concepts">
            Choose a concept <ArrowRight size={15} />
          </ButtonLink>
        }
      >
        Select a concept before publishing an exact proposal. Interest is always
        tied to the event terms people actually saw.
      </EmptyState>
    );
  const published = !!w.event.publishedAt;
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
          detail="Sample people · all active terms"
        />
        <Metric
          number={counts.verified}
          label="Verified, current choices"
          detail={`Contact verified · terms v${w.terms.version}`}
          accent
        />
        <Metric
          number={counts.bookings}
          label="Confirmed sample bookings"
          detail="Allocated places · no payment"
        />
        <Metric
          number={counts.checkins}
          label="Checked in"
          detail="Observed sample attendance"
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
              <Poster variant={c.art} compact />
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
                Review & publish sample <ArrowRight size={16} />
              </Button>
            ) : (
              <ButtonLink href="/events/blue-hour" variant="secondary">
                Open attendee experience <ArrowUpRight size={16} />
              </ButtonLink>
            )}
          </div>
          <div className="audience-list">
            <div className="panel-heading">
              <div>
                <h3>The responses</h3>
                <p>Only verified choices on the current terms count.</p>
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
                        {r.emailMasked} · {r.quantity}{" "}
                        {r.quantity === 1 ? "place" : "places"}
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
                      {r.status.toLowerCase().replaceAll("_", " ")}
                    </Badge>
                    <Link
                      href={`/commitments/${r.token}`}
                      className="icon-button"
                      aria-label={`Review ${r.displayName}'s sample choice`}
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Users size={23} />}
                title="The first conversation is still ahead."
                action={
                  published ? (
                    <ButtonLink href="/events/blue-hour" variant="secondary">
                      Try the sample attendee journey <ArrowUpRight size={15} />
                    </ButtonLink>
                  ) : undefined
                }
              >
                No one has expressed interest yet. Publish the proposal, then
                use the attendee page to make a sample choice.
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
              Preview the public page, make a sample choice, and see the counts
              update here.
            </p>
            <ButtonLink href="/events/blue-hour" variant="secondary">
              Preview the event <ExternalLink size={14} />
            </ButtonLink>
            {published ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/events/blue-hour`,
                    );
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}{" "}
                {copied ? "Link copied" : "Copy preview link"}
              </Button>
            ) : null}
            <small>
              The link opens a sample for each browser. Your workspace’s guest
              list is private to this session.
            </small>
          </div>
          <div className="count-definition">
            <Info size={16} />
            <div>
              <h4>Every number means one thing.</h4>
              <p>
                <strong>Interest</strong> is an active sample response.
              </p>
              <p>
                <strong>Verified</strong> means the sample confirmation step was
                completed on current terms.
              </p>
              <p>
                <strong>Booking</strong> allocates a sample place.
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
                href="/studio/events/blue-hour/production"
                variant="ghost"
              >
                Open production <ArrowRight size={16} />
              </ButtonLink>
            </div>
          ) : null}
        </aside>
      </div>
      <ApprovalDialog
        open={approve}
        onOpenChange={setApprove}
        action="PUBLISH"
        title="Let people in on the idea."
        description="Approve the exact conditional proposal before opening sample interest collection."
        buttonLabel="Approve & publish sample"
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

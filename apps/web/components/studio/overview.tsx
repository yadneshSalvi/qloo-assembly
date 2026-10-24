"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  DoorOpen,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { countsFor, selectedConcept } from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Badge, ButtonLink } from "../ui";
import { Poster } from "../poster";
import { eventDate } from "@/lib/format";
export function Overview() {
  const { workspace: w } = useWorkspace();
  if (!w) return null;
  const counts = countsFor(w);
  const concept = selectedConcept(w);
  const stage = w.event.lifecycle;
  const target =
    stage === "DRAFT"
      ? "brief"
      : stage === "RESEARCHING" || stage === "CONCEPT_READY"
        ? "concepts"
        : stage === "VALIDATION_OPEN"
          ? "demand"
          : stage === "COMPLETED"
            ? "results"
            : "production";
  const next =
    stage === "DRAFT"
      ? {
          title: "Give the evening a direction.",
          body: "A few cultural anchors and a practical brief are all you need to begin.",
          cta: "Shape the brief",
        }
      : stage === "CONCEPT_READY"
        ? {
            title: "Find the one that feels right.",
            body: "Three distinct treatments, one room. Review the costs and choose a direction.",
            cta: "Explore the concepts",
          }
        : stage === "VALIDATION_OPEN"
          ? {
              title: "Listen to your audience.",
              body: "Your conditional proposal is open. A verified choice is the next useful signal.",
              cta: "View audience response",
            }
          : stage === "COMPLETED"
            ? {
                title: "A night, made together.",
                body: "Review the observed sample outcomes and what the numbers actually mean.",
                cta: "See the outcome",
              }
            : {
                title: "Bring the details together.",
                body: "Confirm the people, clear the gates, and keep the evening moving.",
                cta: "Open production",
              };
  return (
    <>
      <div className="overview-heading">
        <div>
          <div className="eyebrow">YOUR PRODUCTION DESK</div>
          <h1>
            Make room for
            <br />
            <em>something good.</em>
          </h1>
        </div>
        <div className="overview-welcome">
          <span className="mini-spark">✳</span>
          <p>
            A space. An open evening.
            <br />A little possibility.
          </p>
        </div>
      </div>
      <div className="overview-topline">
        <h2>
          On the horizon <span>01</span>
        </h2>
        <Link href="/studio/venues/the-fold">
          View your space <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="overview-feature">
        <Link
          className="overview-poster"
          href={`/studio/events/blue-hour/${target}`}
          aria-label="Open Blue hour production"
        >
          <Poster variant={concept?.art || "blue-hour"} compact />
        </Link>
        <div className="overview-production">
          <div className="overview-production-top">
            <Badge tone={stage === "DRAFT" ? "neutral" : "positive"}>
              {stage.replaceAll("_", " ").toLowerCase()}
            </Badge>
            <span>NO. 001</span>
          </div>
          <h2>
            {w.event.title.includes(",") ? (
              <>
                {w.event.title.split(",")[0]},<br />
                <em>{w.event.title.split(",").slice(1).join(",").trim()}</em>
              </>
            ) : (
              w.event.title
            )}
          </h2>
          <p>
            {concept?.subtitle ||
              "A listening supper for a room full of curious people."}
          </p>
          <div className="overview-meta">
            <span>
              <CalendarDays size={14} />
              {eventDate(w.terms.date, true)}
            </span>
            <span>
              <Clock3 size={14} />
              {w.terms.doors}–{w.terms.end}
            </span>
            <span>
              <Users size={14} />
              {w.venue.capacity} seated
            </span>
          </div>
          <div className="overview-mini-stats">
            <div>
              <strong>{counts.verified}</strong>
              <span>verified choices</span>
            </div>
            <div>
              <strong>{counts.bookings}</strong>
              <span>sample bookings</span>
            </div>
            <div>
              <strong>
                {w.suppliers.filter((s) => s.status === "CONFIRMED").length}
              </strong>
              <span>confirmed suppliers</span>
            </div>
          </div>
          <ButtonLink href={`/studio/events/blue-hour/${target}`}>
            Continue the production <ArrowRight size={16} />
          </ButtonLink>
        </div>
        <div className="overview-next">
          <div className="eyebrow">
            <span className="status-dot" />
            YOUR NEXT MOVE
          </div>
          <div className="next-move-icon">
            <Sparkles size={30} strokeWidth={1} />
          </div>
          <h3>{next.title}</h3>
          <p>{next.body}</p>
          <Link href={`/studio/events/blue-hour/${target}`}>
            {next.cta}
            <ArrowUpRight size={16} />
          </Link>
          <div className="next-move-note">
            <Check size={13} />
            Every consequential decision stays yours.
          </div>
        </div>
      </div>
      <div className="overview-bottom">
        <section className="venue-summary">
          <div className="section-heading">
            <h2>The room behind the night</h2>
            <DoorOpen size={19} />
          </div>
          <div className="venue-summary-body">
            <div className="venue-illustration" aria-hidden="true">
              <div className="room-window" />
              <div className="room-table" />
              <div className="room-lamp" />
              <span>THE FOLD</span>
            </div>
            <div>
              <Badge
                tone={
                  w.venue.availability === "AVAILABLE" ? "positive" : "warning"
                }
              >
                {w.venue.availability === "AVAILABLE"
                  ? "Sample availability confirmed"
                  : "Availability needs confirmation"}
              </Badge>
              <h3>{w.venue.name}</h3>
              <p>
                <MapPin size={13} />
                {w.venue.neighborhood}
              </p>
              <div className="venue-summary-facts">
                <span>{w.venue.capacity} seated</span>
                <span>Access on venue sheet</span>
                <span>{w.venue.curfew} curfew</span>
              </div>
              <Link className="text-link" href="/studio/venues/the-fold">
                Know your space <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
        <section className="studio-notes">
          <div className="section-heading">
            <h2>A note on the ingredients</h2>
            <span className="serif-asterisk">✳</span>
          </div>
          <p>
            Culture can spark a connection. It takes people, practical details,
            and permission to turn it into a night.
          </p>
          <div className="notes-rows">
            <div>
              <span className="notes-number">01</span>
              <strong>Authored ideas</strong>
              <span>Clearly labeled</span>
            </div>
            <div>
              <span className="notes-number">02</span>
              <strong>Your decisions</strong>
              <span>Versioned & saved</span>
            </div>
            <div>
              <span className="notes-number">03</span>
              <strong>Sample operations</strong>
              <span>Nothing sent or charged</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

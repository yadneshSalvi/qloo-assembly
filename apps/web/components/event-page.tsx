"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  Check,
  Info,
  MapPin,
  ShieldCheck,
  Users,
  Utensils,
  AlertCircle,
} from "lucide-react";
import { formatMoney, selectedConcept } from "@assembly/contracts";
import { WorkspaceProvider, useWorkspace } from "./workspace-context";
import { PublicHeader, PublicFooter, Button, ButtonLink, Badge } from "./ui";
import { Poster } from "./poster";
import { eventDate } from "@/lib/format";
export function EventPage() {
  return (
    <WorkspaceProvider>
      <PublicEvent />
    </WorkspaceProvider>
  );
}
function PublicEvent() {
  const { workspace: w, loading, error, refresh } = useWorkspace();
  if (loading) return <PublicLoading />;
  if (!w) return <PublicFailure error={error} retry={refresh} />;
  const c = selectedConcept(w);
  const published = !!w.event.publishedAt;
  const bookingOpen =
    w.event.lifecycle === "BOOKING_OPEN" && !w.event.bookingPaused;
  const confirmed = [
    "CONFIRMED",
    "BOOKING_OPEN",
    "READY",
    "LIVE",
    "COMPLETED",
  ].includes(w.event.lifecycle);
  return (
    <div className="public-site event-site">
      <header className="event-header">
        <Link href="/" className="event-wordmark">
          ASSEMBLY<span>.</span>
        </Link>
        <span>A NIGHT BY {w.venue.name.toUpperCase()}</span>
        <Link href="/studio/events/blue-hour/demand">
          Producer view <ArrowUpRight size={15} />
        </Link>
      </header>
      <main id="main">
        <div className="public-sample-strip">
          <span className="sample-ring" />
          An interactive sample event · fictional venue & suppliers · no
          payments or real reservations
        </div>
        <section className="public-event-hero">
          <div className="public-event-copy">
            <div className="event-public-status">
              <Badge
                tone={
                  w.event.bookingPaused
                    ? "warning"
                    : confirmed
                      ? "positive"
                      : "coral"
                }
              >
                {w.event.bookingPaused
                  ? "A change is being reviewed"
                  : confirmed
                    ? "Confirmed sample production"
                    : published
                      ? "A proposed evening"
                      : "A glimpse of a possible evening"}
              </Badge>
              <span>NO. 001</span>
            </div>
            <div className="eyebrow">
              {c?.category || "LISTENING ROOM × LONG-TABLE SUPPER"}
            </div>
            <h1>
              {(c?.title || "Blue hour, shared table.").split(",")[0]}
              {c?.title.includes(",") || !c ? (
                <>
                  <span>,</span>
                  <br />
                  <em>shared table.</em>
                </>
              ) : null}
            </h1>
            <p className="public-event-deck">
              {c?.subtitle || "Stay for one more record."}
            </p>
            <p className="public-event-description">
              {c?.description ||
                "Soulful grooves, generous plates, and the easy intimacy of a room that feels like someone’s home. Come for the music. Stay for the conversation."}
            </p>
            <div className="public-event-facts">
              <div>
                <CalendarDays size={17} />
                <span>
                  <strong>{eventDate(w.terms.date, true)}</strong>
                  <small>
                    {w.terms.doors}–{w.terms.end} · Europe/London
                  </small>
                </span>
              </div>
              <div>
                <MapPin size={17} />
                <span>
                  <strong>
                    {w.venue.name}, {w.venue.neighborhood}
                  </strong>
                  <small>
                    Fictional sample venue · {w.venue.capacity} seated places
                  </small>
                </span>
              </div>
              <div>
                <Utensils size={17} />
                <span>
                  <strong>
                    {formatMoney(w.terms.priceMinor)} per person, proposed
                  </strong>
                  <small>Music, supper & a little time together</small>
                </span>
              </div>
            </div>
            {published && w.event.lifecycle !== "COMPLETED" ? (
              <>
                <a href="#interest" className="button button-primary">
                  {bookingOpen
                    ? "Join the sample evening"
                    : "I’d like to be there"}
                  <ArrowDown size={17} />
                </a>
                <div className="event-action-note">
                  {bookingOpen
                    ? "Sample allocation only. No payment is taken."
                    : "Conditional interest only. This is not a ticket."}
                </div>
              </>
            ) : (
              <>
                <ButtonLink
                  href="/studio/events/blue-hour/brief"
                  variant="primary"
                >
                  {w.event.lifecycle === "COMPLETED"
                    ? "See how the night came together"
                    : "Make this night happen"}
                  <ArrowUpRight size={17} />
                </ButtonLink>
                <div className="event-action-note">
                  {w.event.lifecycle === "COMPLETED"
                    ? "The sample event is complete."
                    : "This preview is not yet open for interest."}
                </div>
              </>
            )}
          </div>
          <div className="public-event-art">
            <Poster variant={c?.art || "blue-hour"} />
            <div className="public-art-caption">
              <span>AN ORIGINAL ASSEMBLY SAMPLE POSTER</span>
              <span>01 / 03</span>
            </div>
          </div>
        </section>
        <section className="public-event-story">
          <div className="event-story-title">
            <div className="eyebrow">A LITTLE OF WHAT’S IN STORE</div>
            <h2>
              The best part
              <br />
              <em>is being there.</em>
            </h2>
          </div>
          <div className="public-story-grid">
            {[
              {
                icon: AudioLines,
                title: c?.ingredients[0] || "A sound to settle into.",
                body:
                  w.change?.status === "APPROVED"
                    ? `${w.change.after} brings a warm acoustic set to the same intimate room.`
                    : "A warm, intimate program. Close enough to catch the quiet details, soft enough to hear one another.",
              },
              {
                icon: Utensils,
                title: c?.ingredients[1] || "Pass the plates.",
                body: "Generous seasonal food, shared at the table. A vegetarian-led menu with dietary needs confirmed before any real event.",
              },
              {
                icon: Users,
                title: c?.ingredients[2] || "Make a new connection.",
                body: "A small room, a generous pace, and a little space for the unexpected. Come with someone, or come on your own.",
              },
            ].map((s) => (
              <article key={s.title}>
                <s.icon size={25} strokeWidth={1.25} />
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="event-practical">
          <div>
            <div className="eyebrow">THE EVENING, AT A GLANCE</div>
            <h2>
              A few things
              <br />
              <em>before you come.</em>
            </h2>
            <div className="public-run-of-show">
              {w.runOfShow
                .filter((r) =>
                  ["doors", "music", "supper", "records", "close"].includes(
                    r.id,
                  ),
                )
                .map((r) => (
                  <div key={r.id}>
                    <span>{r.time}</span>
                    <div>
                      <strong>{r.title}</strong>
                      <p>{r.detail}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <div className="public-terms">
            <div className="eyebrow">
              <ShieldCheck size={15} />
              YOUR CHOICE, ON CLEAR TERMS
            </div>
            <h3>The exact proposition.</h3>
            <dl>
              <div>
                <dt>The date</dt>
                <dd>{eventDate(w.terms.date)}</dd>
              </div>
              <div>
                <dt>The time</dt>
                <dd>
                  {w.terms.doors}–{w.terms.end} · Europe/London
                </dd>
              </div>
              <div>
                <dt>The venue</dt>
                <dd>{w.terms.address}</dd>
              </div>
              <div>
                <dt>The price</dt>
                <dd>
                  {formatMoney(w.terms.priceMinor)} per person if a real pilot
                  is approved. This sample never charges you.
                </dd>
              </div>
              <div>
                <dt>The program</dt>
                <dd>{w.terms.program}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>{w.terms.access}</dd>
              </div>
            </dl>
            <div className="public-terms-note">
              <Info size={16} />
              <p>
                Any material change to the program, date, place, price, or
                access conditions asks you to confirm again. You can withdraw
                your sample choice at any time.
              </p>
            </div>
            <span className="public-terms-version">
              TERMS v{w.terms.version} · {w.terms.hash.slice(0, 12)}
            </span>
          </div>
        </section>
        {published && w.event.lifecycle !== "COMPLETED" ? (
          <InterestForm />
        ) : (
          <section className="preview-invitation">
            <span>✳</span>
            <h2>
              Every good night starts
              <br />
              <em>with someone saying, “what if?”</em>
            </h2>
            <p>
              Step into the production desk to choose a concept, review the
              details, and publish this sample invitation.
            </p>
            <ButtonLink href="/studio">
              Open the production desk <ArrowRight size={17} />
            </ButtonLink>
          </section>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
function InterestForm() {
  const { workspace: w, act, busy, error } = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [consent, setConsent] = useState(false);
  if (!w) return null;
  return (
    <section className="interest-section" id="interest">
      <div>
        <div className="eyebrow">A GOOD EVENING NEEDS GOOD COMPANY</div>
        <h2>
          A place in the idea.
          <br />
          <em>A choice that’s yours.</em>
        </h2>
        <p>
          Let the producer know you’d consider coming on these terms. Verify
          your sample contact in the next step. If booking is open, you can then
          allocate a sample place.
        </p>
        <div className="interest-boundary">
          <ShieldCheck size={23} />
          <p>
            No payment. No real reservation. No marketing consent.
            <br />A material change means we ask you again.
          </p>
        </div>
        <div className="interest-sample">
          <Badge tone="warning">Isolated sample journey</Badge>
          <p>
            Use a made-up email address. The verification link appears on
            screen; nothing is emailed. Sample verification does not prove
            ownership of a real contact.
          </p>
        </div>
      </div>
      <form
        className="interest-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await act("EXPRESS_INTEREST", {
            name,
            email,
            quantity,
            consent,
            termsVersion: w.terms.version,
          });
          if (result.ok && result.token)
            router.push(`/commitments/${result.token}`);
        }}
      >
        <div className="interest-form-heading">
          <h3>I’d like to be there.</h3>
          <Badge dot={false}>Terms v{w.terms.version}</Badge>
        </div>
        {error ? (
          <div className="public-error" role="alert">
            <AlertCircle size={17} />
            <p>{error}</p>
          </div>
        ) : null}
        <label className="field">
          <span>Your sample name</span>
          <input
            autoComplete="off"
            name="name"
            required
            maxLength={100}
            placeholder="Alex Taylor"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Sample email address</span>
          <input
            autoComplete="off"
            name="email"
            type="email"
            required
            maxLength={254}
            placeholder="alex@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="field-hint">
            Only a masked address and a deduplication digest are saved.
          </p>
        </label>
        <label className="field">
          <span>People in your party</span>
          <select
            name="quantity"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option value={n} key={n}>
                {n} {n === 1 ? "person" : "people"}
              </option>
            ))}
          </select>
        </label>
        <label className="consent-label">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I’ve read terms v{w.terms.version}. I understand this is a sample
            conditional choice, not a ticket or payment, and I can withdraw it.
          </span>
        </label>
        <Button
          type="submit"
          busy={busy === "EXPRESS_INTEREST"}
          disabled={!consent || w.event.bookingPaused}
        >
          Save my sample interest <ArrowRight size={16} />
        </Button>
        {w.event.bookingPaused ? (
          <p className="paused-note">
            A program change is under review. New choices are paused until the
            terms are settled.
          </p>
        ) : null}
        <div className="interest-form-footer">
          <Check size={12} />
          Your choice belongs to this browser’s isolated workspace.
        </div>
      </form>
    </section>
  );
}
export function PublicLoading() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main id="main" className="public-loading" role="status">
        <div className="public-loading-lines">
          <div />
          <div />
          <div />
        </div>
        <div className="public-loading-art" />
        <span className="sr-only">Opening the evening…</span>
      </main>
    </div>
  );
}
export function PublicFailure({
  error,
  retry,
}: {
  error: string | null;
  retry: () => Promise<void>;
}) {
  return (
    <div className="public-site">
      <PublicHeader />
      <main id="main" className="not-found">
        <div className="eyebrow">A MOMENTARY PAUSE</div>
        <h1>
          Let’s try
          <br />
          <em>that again.</em>
        </h1>
        <p>{error || "The saved sample workspace could not be opened."}</p>
        <Button onClick={() => void retry()}>
          Reload the evening <ArrowRight size={16} />
        </Button>
      </main>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
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
import {
  formatMoney,
  type PublicEventView,
  type Terms,
} from "@assembly/contracts";
import { usePublicView } from "./public-session";
import { PublicHeader, PublicFooter, Button, Badge } from "./ui";
import { Poster } from "./poster";
import { eventDate } from "@/lib/format";

export function EventPage({ slug }: { slug: string }) {
  const remote = usePublicView<PublicEventView>(
    `/api/public/events/${encodeURIComponent(slug)}`,
  );
  if (remote.loading) return <PublicLoading />;
  if (!remote.view)
    return <PublicFailure error={remote.error} retry={remote.refresh} />;
  const w = remote.view,
    c = w.concept;
  const closed = ["COMPLETED", "CANCELLED", "LIVE"].includes(w.event.lifecycle);
  const bookingOpen =
    w.event.lifecycle === "BOOKING_OPEN" && !w.event.bookingPaused;
  const confirmed = [
    "CONFIRMED",
    "BOOKING_OPEN",
    "READY",
    "LIVE",
    "COMPLETED",
  ].includes(w.event.lifecycle);
  const title = w.terms.title.replace(/\.$/, ""),
    comma = title.indexOf(",");
  return (
    <div className="public-site event-site">
      <header className="event-header">
        <Link href="/" className="event-wordmark">
          ASSEMBLY<span>.</span>
        </Link>
        <span>A NIGHT BY {w.venue.name.toUpperCase()}</span>
        <span>
          {w.mode === "SAMPLE"
            ? "A FICTIONAL REHEARSAL"
            : "AN OPERATOR’S INVITATION"}
        </span>
      </header>
      <main id="main">
        <div className="public-sample-strip">
          <span className="sample-ring" />
          {w.mode === "SAMPLE"
            ? "Fictional event & suppliers · shared rehearsal · no real reservation or payment"
            : "An operator-published production · free places · the host is responsible for availability and permissions"}
        </div>
        <section className="public-event-hero">
          <div className="public-event-copy">
            <div className="event-public-status">
              <Badge
                tone={
                  w.event.bookingPaused || w.event.lifecycle === "CANCELLED"
                    ? "warning"
                    : confirmed
                      ? "positive"
                      : "coral"
                }
              >
                {w.event.lifecycle === "CANCELLED"
                  ? "This evening was cancelled"
                  : w.event.lifecycle === "COMPLETED"
                    ? "The evening is complete"
                    : w.event.bookingPaused
                      ? "A change is being reviewed"
                      : bookingOpen
                        ? "Booking is open"
                        : confirmed
                          ? "Production confirmed"
                          : "A proposed evening"}
              </Badge>
              <span>TERMS {w.terms.version.toString().padStart(2, "0")}</span>
            </div>
            <div className="eyebrow">
              {c?.category || "AN EVENING, MADE TOGETHER"}
            </div>
            <h1>
              {comma >= 0 ? (
                <>
                  {title.slice(0, comma + 1)}
                  <br />
                  <em>{title.slice(comma + 1).trim()}.</em>
                </>
              ) : (
                <>
                  {title}
                  <span>.</span>
                </>
              )}
            </h1>
            <p className="public-event-deck">{c?.subtitle}</p>
            <p className="public-event-description">{c?.description}</p>
            <div className="public-event-facts">
              <div>
                <CalendarDays size={17} />
                <span>
                  <strong>{eventDate(w.terms.date, true)}</strong>
                  <small>
                    {w.terms.doors}–{w.terms.end} · {w.venue.timezone}
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
                    {w.venue.capacity} places in this production’s allotment
                  </small>
                </span>
              </div>
              <div>
                <Utensils size={17} />
                <span>
                  <strong>
                    {w.terms.priceMinor
                      ? `${formatMoney(w.terms.priceMinor)} proposed per person`
                      : "Free to come together"}
                  </strong>
                  <small>
                    {w.mode === "SAMPLE"
                      ? "A sample price; no money is collected"
                      : "No ticket fee or payment step"}
                  </small>
                </span>
              </div>
            </div>
            {!closed && !w.event.bookingPaused ? (
              <>
                <a href="#interest" className="button button-primary">
                  {bookingOpen
                    ? "A place in this evening"
                    : "I’d like to be there"}
                  <ArrowDown size={17} />
                </a>
                <div className="event-action-note">
                  {bookingOpen
                    ? "Confirm your choice, then request your places."
                    : "Conditional interest only. This is not a ticket."}
                </div>
              </>
            ) : (
              <div className="event-action-note">
                {w.event.bookingPaused
                  ? "The host is reviewing a change. Existing guests can use their private response link."
                  : w.event.lifecycle === "CANCELLED"
                    ? "All reservations have been released. There were no payments through ASSEMBLY."
                    : "New responses are closed. Existing guests can still review their private choice."}
              </div>
            )}
          </div>
          <div className="public-event-art">
            <Poster
              variant={c?.art}
              title={w.terms.title}
              venueName={w.venue.name}
              date={w.terms.date}
              doors={w.terms.doors}
              location={w.venue.neighborhood}
              capacity={w.venue.capacity}
              category={c?.category}
            />
            <div className="public-art-caption">
              <span>ORIGINAL ASSEMBLY POSTER ART</span>
              <span>MADE FOR THIS EVENING</span>
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
            {(
              c?.ingredients || [
                "A room with character",
                "A considered program",
                "Good company",
              ]
            ).map((ingredient, i) => {
              const Icon = [AudioLines, Utensils, Users][i % 3];
              return (
                <article key={`${i}-${ingredient}`}>
                  <Icon size={25} strokeWidth={1.25} />
                  <h3>{ingredient}</h3>
                  <p>
                    {i === 0
                      ? "The program below is the host’s current proposal. Any material change comes back to you for a new choice."
                      : i === 1
                        ? "Practical details and permissions are the host’s responsibility. Read the access notes before choosing."
                        : "Come with someone or come on your own. Your response stays private, and you can withdraw it."}
                  </p>
                </article>
              );
            })}
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
              {w.programSchedulePending ? (
                <p>
                  The host still needs to review exact program times with the
                  suppliers. Only the event’s opening and closing times are
                  shown.
                </p>
              ) : null}
              {w.runOfShow
                .filter((r) => r.time >= w.terms.doors)
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
          <PublicTerms
            terms={w.terms}
            timezone={w.venue.timezone}
            sample={w.mode === "SAMPLE"}
          />
        </section>
        {!closed ? (
          <InterestForm
            event={w}
            busy={remote.busy}
            error={remote.error}
            submit={remote.act}
          />
        ) : (
          <section className="preview-invitation">
            <span>✳</span>
            <h2>
              {w.event.lifecycle === "CANCELLED"
                ? "Sometimes, the right call"
                : "Every evening leaves"}
              <br />
              <em>
                {w.event.lifecycle === "CANCELLED"
                  ? "is to pause."
                  : "a little afterglow."}
              </em>
            </h2>
            <p>{w.terms.notice}</p>
          </section>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

function InterestForm({
  event: w,
  busy,
  error,
  submit,
}: {
  event: PublicEventView;
  busy: string | null;
  error: string | null;
  submit: (input: {
    type: string;
    [key: string]: unknown;
  }) => Promise<{ ok: boolean; token?: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [acceptedHash, setAcceptedHash] = useState<string | null>(null);
  const consent = acceptedHash === w.terms.hash;
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
          Tell the producer you would consider coming on these exact terms.
          You’ll get a private response link to confirm, book when places open,
          or change your mind.
        </p>
        <div className="interest-boundary">
          <ShieldCheck size={23} />
          <p>
            No payment and no marketing consent.
            <br />A material change means we ask you again.
          </p>
        </div>
        <div className="interest-sample">
          <Badge tone={w.mode === "SAMPLE" ? "warning" : "positive"}>
            {w.mode === "SAMPLE"
              ? "Shared sample journey"
              : "Your response stays private"}
          </Badge>
          <p>
            {w.mode === "SAMPLE"
              ? "You’re participating in a fictional rehearsal. Use a made-up name. Your actions are saved only as sample activity."
              : "Use a first name or alias. No email is required. Save your private response link: anyone with it can manage your choice."}
          </p>
        </div>
      </div>
      <form
        className="interest-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await submit({
            type: "EXPRESS_INTEREST",
            expectedPublicVersion: w.version,
            termsVersion: w.terms.version,
            termsHash: w.terms.hash,
            payload: { name, quantity, consent },
          });
          if (result.ok && result.token) {
            try {
              sessionStorage.setItem(
                `assembly-choice:${w.event.slug}`,
                result.token,
              );
            } catch {
              /* The private link still works without browser storage. */
            }
            router.push(`/commitments/${result.token}`);
          }
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
          <span>
            {w.mode === "SAMPLE"
              ? "Your sample name"
              : "Your first name or alias"}
          </span>
          <input
            autoComplete="given-name"
            name="name"
            required
            maxLength={100}
            placeholder="Alex"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
            onChange={(e) =>
              setAcceptedHash(e.target.checked ? w.terms.hash : null)
            }
          />
          <span>
            I’ve read terms v{w.terms.version}. This is conditional interest,
            not an allocated place. I can withdraw using my private response
            link.{w.mode === "SAMPLE" ? " This is a fictional rehearsal." : ""}
          </span>
        </label>
        <Button
          type="submit"
          busy={busy === "EXPRESS_INTEREST"}
          disabled={!consent || w.event.bookingPaused}
        >
          Save my {w.mode === "SAMPLE" ? "sample " : ""}interest
          <ArrowRight size={16} />
        </Button>
        {w.event.bookingPaused ? (
          <p className="paused-note">
            A change is under review. New choices are paused until the terms are
            settled.
          </p>
        ) : null}
        <div className="interest-form-footer">
          <Check size={12} />
          {w.consentNotice}
        </div>
      </form>
    </section>
  );
}

export function PublicTerms({
  terms,
  timezone,
  sample,
}: {
  terms: Terms;
  timezone: string;
  sample: boolean;
}) {
  return (
    <div className="public-terms">
      <div className="eyebrow">
        <ShieldCheck size={15} />
        YOUR CHOICE, ON CLEAR TERMS
      </div>
      <h3>The exact proposition.</h3>
      <dl>
        <div>
          <dt>The date</dt>
          <dd>{eventDate(terms.date)}</dd>
        </div>
        <div>
          <dt>The time</dt>
          <dd>
            {terms.doors}–{terms.end} · {timezone}
          </dd>
        </div>
        <div>
          <dt>The venue</dt>
          <dd>
            {terms.venue} · {terms.address}
          </dd>
        </div>
        <div>
          <dt>The price</dt>
          <dd>
            {terms.priceMinor
              ? `${formatMoney(terms.priceMinor)} proposed per person`
              : "Free admission"}
            {sample
              ? " · sample allocation only, no payment"
              : " · no payment through ASSEMBLY"}
          </dd>
        </div>
        {terms.capacity !== undefined ? (
          <div>
            <dt>The room</dt>
            <dd>
              {terms.capacity} seated places
              {terms.soundLimitDb !== undefined
                ? ` · sound limit ${terms.soundLimitDb} dB`
                : ""}
              {terms.curfew ? ` · curfew ${terms.curfew}` : ""}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>The program</dt>
          <dd>{terms.program}</dd>
        </div>
        {terms.programSchedule?.length ? (
          <div>
            <dt>Program times</dt>
            <dd>
              <ul className="terms-program-slots">
                {terms.programSchedule.map((slot) => (
                  <li key={slot.supplierId}>
                    <strong>
                      {slot.start}–{slot.end}
                    </strong>{" "}
                    · {slot.name}
                    {slot.canOverlap ? " · concurrent service" : ""}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Access</dt>
          <dd>{terms.access}</dd>
        </div>
      </dl>
      <div className="public-terms-note">
        <Info size={16} />
        <p>
          {terms.notice} Material changes to the date, place, price, program or
          access require your renewed choice.
        </p>
      </div>
      <span className="public-terms-version">
        TERMS v{terms.version} · {terms.hash.slice(0, 12)}
      </span>
    </div>
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
        <div className="eyebrow">THIS INVITATION NEEDS A MOMENT</div>
        <h1>
          A little pause.
          <br />
          <em>The night can wait.</em>
        </h1>
        <p>
          {error ||
            "This link may have expired, or the host has not published the invitation yet."}
        </p>
        <Button onClick={() => void retry()}>
          Try this link again
          <ArrowRight size={16} />
        </Button>
      </main>
      <PublicFooter />
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Fingerprint,
  Info,
  Link2,
  RefreshCw,
  ShieldCheck,
  Star,
  Ticket,
  TriangleAlert,
} from "lucide-react";
import type { ParticipantView, PublicActionRequest } from "@assembly/contracts";
import { usePublicView } from "./public-session";
import { Badge, Button, PublicFooter } from "./ui";
import { PublicLoading, PublicFailure, PublicTerms } from "./event-page";

export function CommitmentPage({ token }: { token: string }) {
  const remote = usePublicView<ParticipantView>(
    `/api/participants/${encodeURIComponent(token)}`,
  );
  const [acceptedHash, setAcceptedHash] = useState<string | null>(null);
  const [withdraw, setWithdraw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  if (remote.loading) return <PublicLoading />;
  if (!remote.view)
    return <PublicFailure error={remote.error} retry={remote.refresh} />;
  const { event: w, commitment: c, feedback } = remote.view;
  const booking =
    remote.view.booking?.status !== "CANCELLED" ? remote.view.booking : null;
  const pending = c.status === "PENDING",
    reconfirm = c.status === "RECONFIRM_REQUIRED",
    withdrawn = c.status === "WITHDRAWN",
    cancelled = w.event.lifecycle === "CANCELLED",
    completed = w.event.lifecycle === "COMPLETED";
  const bookingOpen =
    w.event.lifecycle === "BOOKING_OPEN" && !w.event.bookingPaused;
  const act = (
    type: PublicActionRequest["type"],
    payload: Record<string, unknown> = {},
  ) =>
    remote.act({
      type,
      expectedPublicVersion: w.version,
      termsVersion: w.terms.version,
      termsHash: w.terms.hash,
      payload,
    });
  const sample = w.mode === "SAMPLE";
  return (
    <div className="public-site commitment-site">
      <header className="event-header">
        <Link href="/" className="event-wordmark">
          ASSEMBLY<span>.</span>
        </Link>
        <span>YOUR CHOICE, IN YOUR HANDS</span>
        <Badge tone={sample ? "warning" : "neutral"}>
          {sample ? "Sample response" : "Private response"}
        </Badge>
      </header>
      <main id="main" className="commitment-main">
        <Link className="text-link" href={`/events/${w.event.slug}`}>
          <ArrowLeft size={14} />
          Back to the evening
        </Link>
        <div className="commitment-layout">
          <section className="commitment-copy">
            <div
              className={`commitment-symbol ${reconfirm || cancelled ? "warning" : ""}`}
            >
              {cancelled ? (
                <TriangleAlert size={32} />
              ) : reconfirm ? (
                <RefreshCw size={32} />
              ) : booking ? (
                <Ticket size={32} strokeWidth={1.25} />
              ) : pending ? (
                <Link2 size={32} strokeWidth={1.25} />
              ) : (
                <CheckCircle2 size={32} strokeWidth={1.25} />
              )}
            </div>
            <Badge
              tone={
                reconfirm || cancelled
                  ? "warning"
                  : pending
                    ? "neutral"
                    : "positive"
              }
            >
              {cancelled
                ? "Production cancelled"
                : withdrawn
                  ? "Choice withdrawn"
                  : reconfirm
                    ? "New terms need your choice"
                    : pending
                      ? "One clear choice to go"
                      : completed
                        ? "The evening is complete"
                        : booking
                          ? `${sample ? "Sample p" : "P"}laces allocated`
                          : "Confirmed conditional interest"}
            </Badge>
            <h1>
              {cancelled ? (
                <>
                  Plans changed.
                  <br />
                  <em>Your places are released.</em>
                </>
              ) : pending ? (
                <>
                  Make your
                  <br />
                  <em>choice count.</em>
                </>
              ) : reconfirm ? (
                <>
                  The evening changed.
                  <br />
                  <em>The choice is still yours.</em>
                </>
              ) : withdrawn ? (
                <>
                  Thanks for
                  <br />
                  <em>letting us know.</em>
                </>
              ) : booking ? (
                <>
                  A place in the room.
                  <br />
                  <em>With your name on it.</em>
                </>
              ) : (
                <>
                  You’re part
                  <br />
                  <em>of the possibility.</em>
                </>
              )}
            </h1>
            <p>
              {cancelled
                ? "The host cancelled this production. All app-managed places have been released. ASSEMBLY collected no payment."
                : pending
                  ? `Hello ${c.displayName}. Read the exact proposition and confirm that you would consider coming. No place is allocated until you choose to book.`
                  : reconfirm
                    ? `The host changed material event terms. Review version ${w.terms.version} and choose again. Any existing places stay held during this review; withdrawing releases them.`
                    : withdrawn
                      ? "Your choice is withdrawn and any allocation is released. You can make a new response from the event page if it is still open."
                      : booking
                        ? `${c.quantity} ${sample ? "sample " : ""}${c.quantity === 1 ? "place is" : "places are"} allocated within the host’s app-managed capacity. ${sample ? "This is a fictional rehearsal, not a real ticket." : "No payment was taken. Keep this link for entry and updates."}`
                        : "Your choice is confirmed on the current terms. It is conditional interest. You can request places when the host opens booking."}
            </p>
            <div className="commitment-identity">
              <span>{c.displayName.charAt(0).toUpperCase()}</span>
              <div>
                <strong>{c.displayName}</strong>
                <small>
                  {c.quantity} {c.quantity === 1 ? "person" : "people"} ·
                  response {c.id.slice(0, 8)}
                </small>
              </div>
            </div>
            {w.event.bookingPaused && !cancelled && !completed ? (
              <div className="public-warning" role="status">
                <TriangleAlert size={17} />
                <p>
                  New bookings are paused while the host reviews the production.
                  Existing places stay held. Any revised terms will need your
                  choice again.
                </p>
              </div>
            ) : null}
            {remote.error ? (
              <div className="public-error" role="alert">
                <TriangleAlert size={17} />
                <p>{remote.error}</p>
              </div>
            ) : null}
            {remote.notice ? (
              <div className="public-success" role="status">
                <CheckCircle2 size={17} />
                <p>{remote.notice}</p>
              </div>
            ) : null}
            {(pending || reconfirm) && !cancelled && !completed ? (
              <div className="commitment-action">
                <label className="consent-label">
                  <input
                    type="checkbox"
                    checked={acceptedHash === w.terms.hash}
                    onChange={(e) =>
                      setAcceptedHash(e.target.checked ? w.terms.hash : null)
                    }
                  />
                  <span>
                    I accept the exact terms v{w.terms.version} shown here.{" "}
                    {sample
                      ? "I understand this is a fictional rehearsal with no real reservation or payment."
                      : "I understand this is my conditional choice, and I can withdraw."}
                  </span>
                </label>
                <Button
                  disabled={acceptedHash !== w.terms.hash}
                  busy={remote.busy === (pending ? "CONFIRM" : "RECONFIRM")}
                  onClick={async () => {
                    if (
                      (
                        await act(pending ? "CONFIRM" : "RECONFIRM", {
                          consent: true,
                        })
                      ).ok
                    )
                      setAcceptedHash(null);
                  }}
                >
                  {pending ? "Confirm my choice" : "Accept the revised terms"}
                  <Check size={16} />
                </Button>
                <div className="sample-verification-note">
                  <Info size={14} />
                  <span>
                    This records your consent through this private link. It is
                    not email or identity verification.
                  </span>
                </div>
              </div>
            ) : !withdrawn && !booking && !cancelled && !completed ? (
              <div className="commitment-action">
                {bookingOpen ? (
                  <>
                    <Button
                      busy={remote.busy === "FREE_BOOK"}
                      disabled={w.counts.remaining < c.quantity}
                      onClick={() => void act("FREE_BOOK")}
                    >
                      Book {c.quantity} {sample ? "sample " : ""}
                      {c.quantity === 1 ? "place" : "places"}
                      <Ticket size={16} />
                    </Button>
                    <div className="sample-verification-note">
                      <ShieldCheck size={14} />
                      <span>
                        {w.counts.remaining} places remain in this allotment.
                        Capacity is checked when you book.
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="sample-verification-note">
                    <Info size={17} />
                    <span>
                      {w.event.bookingPaused
                        ? "The host is resolving a change. Your response is saved."
                        : "The host has not opened booking yet. Refresh this link to check for an update."}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
            {booking ? (
              <div className="private-ticket">
                <Ticket size={23} />
                <div>
                  <strong>
                    {c.quantity} {c.quantity === 1 ? "place" : "places"} ·{" "}
                    {booking.checkedIn
                      ? "Arrival recorded"
                      : booking.status === "RECONFIRM_REQUIRED"
                        ? "Held for your new choice"
                        : "Confirmed"}
                  </strong>
                  <span>
                    Booking {booking.id.slice(0, 8).toUpperCase()} · terms v
                    {booking.termsVersion}
                  </span>
                </div>
              </div>
            ) : null}
            {!withdrawn && !cancelled && !completed ? (
              <div className="withdraw-section">
                {withdraw ? (
                  <>
                    <p>
                      Withdraw this choice and release any places held for your
                      party?
                    </p>
                    <div className="button-row">
                      <Button
                        variant="danger"
                        busy={remote.busy === "WITHDRAW"}
                        onClick={async () => {
                          if ((await act("WITHDRAW")).ok) setWithdraw(false);
                        }}
                      >
                        Yes, withdraw my choice
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setWithdraw(false)}
                      >
                        Keep my choice
                      </Button>
                    </div>
                  </>
                ) : (
                  <button
                    className="text-link"
                    onClick={() => setWithdraw(true)}
                  >
                    I can no longer make it <ArrowRight size={14} />
                  </button>
                )}
              </div>
            ) : null}
            {completed && !withdrawn ? (
              <form
                className="feedback-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await act("SUBMIT_FEEDBACK", { rating, comment });
                }}
              >
                <div className="eyebrow">
                  <Star size={15} />
                  THE AFTERGLOW
                </div>
                <h3>
                  {feedback
                    ? "Thank you for the honest response."
                    : "How was the evening?"}
                </h3>
                {feedback ? (
                  <p>
                    You recorded {feedback.rating}/5. {feedback.comment}
                  </p>
                ) : (
                  <>
                    <label className="field">
                      <span>Your experience</span>
                      <select
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option value={n} key={n}>
                            {n} / 5
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>What should the host know?</span>
                      <textarea
                        value={comment}
                        maxLength={1000}
                        rows={3}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Something that worked. Something to do differently."
                      />
                    </label>
                    <Button
                      type="submit"
                      busy={remote.busy === "SUBMIT_FEEDBACK"}
                    >
                      Save my feedback
                      <Check size={15} />
                    </Button>
                  </>
                )}
              </form>
            ) : null}
            <div className="private-link-note">
              <Fingerprint size={17} />
              <div>
                <strong>Keep your private response link.</strong>
                <p>
                  Anyone with this link can manage this choice. It works in
                  another browser. No messages are sent.
                </p>
                <div className="button-row">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          window.location.href,
                        );
                        setCopied(true);
                        setCopyError(false);
                      } catch {
                        setCopyError(true);
                      }
                    }}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? "Private link copied" : "Copy my private link"}
                  </Button>
                  <Button variant="ghost" onClick={() => void remote.refresh()}>
                    <RefreshCw size={14} />
                    Check for updates
                  </Button>
                </div>
                {copyError ? (
                  <p role="status">
                    Copy this page’s address from your browser to save the link.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
          <aside className="commitment-terms">
            <h2>{w.terms.title}</h2>
            <PublicTerms
              terms={w.terms}
              timezone={w.venue.timezone}
              sample={sample}
            />
          </aside>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Fingerprint,
  Info,
  MailCheck,
  ShieldCheck,
  Ticket,
  TriangleAlert,
} from "lucide-react";
import { countsFor, formatMoney } from "@assembly/contracts";
import { useWorkspace, WorkspaceProvider } from "./workspace-context";
import { Badge, Button, ButtonLink, PublicFooter } from "./ui";
import { PublicLoading, PublicFailure } from "./event-page";
import { eventDate } from "@/lib/format";
export function CommitmentPage({ token }: { token: string }) {
  return (
    <WorkspaceProvider>
      <Commitment token={token} />
    </WorkspaceProvider>
  );
}
function Commitment({ token }: { token: string }) {
  const {
    workspace: w,
    loading,
    error,
    notice,
    refresh,
    act,
    busy,
  } = useWorkspace();
  const [consent, setConsent] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  if (loading) return <PublicLoading />;
  if (!w) return <PublicFailure error={error} retry={refresh} />;
  const c = w.commitments.find((c) => c.token === token);
  if (!c)
    return (
      <div className="public-site">
        <main id="main" className="not-found">
          <div className="eyebrow">A PRIVATE SAMPLE CHOICE</div>
          <h1>
            This invitation
            <br />
            <em>belongs elsewhere.</em>
          </h1>
          <p>
            The link is invalid, expired, or belongs to a different browser’s
            isolated workspace.
          </p>
          <ButtonLink href="/events/blue-hour">
            See the sample evening <ArrowRight size={16} />
          </ButtonLink>
        </main>
      </div>
    );
  const booking = w.bookings.find(
    (b) => b.commitmentId === c.id && b.status !== "CANCELLED",
  );
  const pending = c.status === "PENDING",
    reconfirm = c.status === "RECONFIRM_REQUIRED",
    withdrawn = c.status === "WITHDRAWN";
  const bookingOpen =
    w.event.lifecycle === "BOOKING_OPEN" && !w.event.bookingPaused;
  return (
    <div className="public-site commitment-site">
      <header className="event-header">
        <Link href="/" className="event-wordmark">
          ASSEMBLY<span>.</span>
        </Link>
        <span>YOUR CHOICE, IN YOUR HANDS</span>
        <Link href="/studio/events/blue-hour/demand">
          Sample producer view <ArrowUpRight size={14} />
        </Link>
      </header>
      <main id="main" className="commitment-main">
        <Link className="text-link" href="/events/blue-hour">
          <ArrowLeft size={14} />
          Back to the evening
        </Link>
        <div className="commitment-layout">
          <section className="commitment-copy">
            <div className={`commitment-symbol ${reconfirm ? "warning" : ""}`}>
              {pending ? (
                <MailCheck size={32} strokeWidth={1.25} />
              ) : reconfirm ? (
                <RefreshSymbol />
              ) : withdrawn ? (
                <Check size={32} />
              ) : booking ? (
                <Ticket size={32} strokeWidth={1.25} />
              ) : (
                <CheckCircle2 size={32} strokeWidth={1.25} />
              )}
            </div>
            <Badge
              tone={reconfirm ? "warning" : pending ? "neutral" : "positive"}
            >
              {withdrawn
                ? "Choice withdrawn"
                : reconfirm
                  ? "New terms need your choice"
                  : pending
                    ? "One sample step to go"
                    : booking
                      ? "Sample place allocated"
                      : "Verified conditional interest"}
            </Badge>
            <h1>
              {pending ? (
                <>
                  Make your
                  <br />
                  <em>choice count.</em>
                </>
              ) : reconfirm ? (
                <>
                  The evening changed.
                  <br />
                  <em>Your choice is new.</em>
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
              {pending
                ? `Hello ${c.displayName}. Confirm this sample contact and the exact event terms below. This simulated step sends no email and does not verify real email ownership.`
                : reconfirm
                  ? `The live program changed from ${w.change?.before} to ${w.change?.after}. Review terms v${w.terms.version} before deciding. Your old choice does not count toward the new proposition until you accept.`
                  : withdrawn
                    ? "Your conditional choice is withdrawn. Any sample allocation has been released. You can return to the event page to make a fresh choice."
                    : booking
                      ? `${c.quantity} sample ${c.quantity === 1 ? "place has" : "places have"} been allocated within the room’s capacity. No payment was taken, and this is not a real ticket.`
                      : "Your sample choice is verified on the current terms. This is conditional interest; it does not allocate a seat or authorize payment."}
            </p>
            <div className="commitment-identity">
              <span>{c.displayName.charAt(0).toUpperCase()}</span>
              <div>
                <strong>{c.displayName}</strong>
                <small>
                  {c.emailMasked} · {c.quantity}{" "}
                  {c.quantity === 1 ? "person" : "people"}
                </small>
              </div>
            </div>
            {error ? (
              <div className="public-error" role="alert">
                <TriangleAlert size={17} />
                <p>{error}</p>
              </div>
            ) : null}
            {notice ? (
              <div className="public-success" role="status">
                <CheckCircle2 size={17} />
                <p>{notice}</p>
              </div>
            ) : null}
            {pending || reconfirm ? (
              <div className="commitment-action">
                <label className="consent-label">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    I accept the exact terms v{w.terms.version} shown here. I
                    understand this is an isolated sample choice and no real
                    payment or reservation is made.
                  </span>
                </label>
                <Button
                  disabled={!consent}
                  busy={busy === (pending ? "VERIFY_INTEREST" : "RECONFIRM")}
                  onClick={async () => {
                    if (
                      (
                        await act(pending ? "VERIFY_INTEREST" : "RECONFIRM", {
                          token,
                          termsVersion: w.terms.version,
                        })
                      ).ok
                    )
                      setConsent(false);
                  }}
                >
                  {pending
                    ? "Verify my sample contact"
                    : "Accept the revised terms"}
                  <Check size={16} />
                </Button>
                {pending ? (
                  <div className="sample-verification-note">
                    <Info size={14} />
                    <span>Sample verification link. Nothing was emailed.</span>
                  </div>
                ) : null}
              </div>
            ) : !withdrawn && !booking ? (
              <div className="commitment-action">
                {bookingOpen ? (
                  <>
                    <Button
                      busy={busy === "BOOK"}
                      disabled={countsFor(w).remaining < c.quantity}
                      onClick={() => void act("BOOK", { commitmentId: c.id })}
                    >
                      Book {c.quantity} sample{" "}
                      {c.quantity === 1 ? "place" : "places"}
                      <Ticket size={16} />
                    </Button>
                    <div className="sample-verification-note">
                      <ShieldCheck size={14} />
                      <span>
                        {countsFor(w).remaining} sample places remain. Capacity
                        is checked when you book.
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="booking-not-yet">
                    <ClockIcon />
                    <div>
                      <strong>
                        {w.event.bookingPaused
                          ? "Bookings are paused during the change review."
                          : "Bookings aren’t open yet."}
                      </strong>
                      <p>
                        The producer must confirm the event and explicitly open
                        sample booking.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            {!withdrawn ? (
              <div className="withdraw-action">
                {withdraw ? (
                  <>
                    <p>
                      Withdraw this choice and release any allocated sample
                      places?
                    </p>
                    <div>
                      <Button
                        variant="secondary"
                        onClick={() => setWithdraw(false)}
                      >
                        Keep my choice
                      </Button>
                      <Button
                        variant="secondary"
                        busy={busy === "WITHDRAW_INTEREST"}
                        onClick={async () => {
                          if (
                            (
                              await act("WITHDRAW_INTEREST", {
                                token,
                                termsVersion: w.terms.version,
                              })
                            ).ok
                          )
                            setWithdraw(false);
                        }}
                      >
                        Yes, withdraw my choice
                      </Button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => setWithdraw(true)}>
                    Withdraw my sample choice
                  </button>
                )}
              </div>
            ) : (
              <ButtonLink href="/events/blue-hour" variant="secondary">
                Back to the event <ArrowRight size={16} />
              </ButtonLink>
            )}
          </section>
          <aside className="commitment-terms">
            <div className="eyebrow">THE EXACT EVENING YOU’RE CHOOSING</div>
            <h2>{w.terms.title}</h2>
            <dl>
              <div>
                <dt>Date</dt>
                <dd>{eventDate(w.terms.date)}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>
                  {w.terms.doors}–{w.terms.end} · Europe/London
                </dd>
              </div>
              <div>
                <dt>Place</dt>
                <dd>
                  {w.terms.venue}, {w.venue.neighborhood}
                </dd>
              </div>
              <div>
                <dt>Price condition</dt>
                <dd>
                  {formatMoney(w.terms.priceMinor)} per person · no sample
                  charge
                </dd>
              </div>
              <div>
                <dt>Program</dt>
                <dd>{w.terms.program}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>{w.terms.access}</dd>
              </div>
            </dl>
            {reconfirm ? (
              <div className="reconfirmation-diff">
                <span>PREVIOUS PROGRAM</span>
                <del>{w.change?.before}</del>
                <span>REVISED PROGRAM</span>
                <strong>{w.change?.after}</strong>
                <p>Date, venue, and price are unchanged.</p>
              </div>
            ) : null}
            <div className="terms-fingerprint">
              <Fingerprint size={13} />
              Terms v{w.terms.version} · {w.terms.hash.slice(0, 12)}
            </div>
            <div className="commitment-terms-note">
              <ShieldCheck size={17} />
              <p>
                This confirmation is scoped to this browser’s sample workspace.
                It is not a publicly shareable or real ticket.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
function RefreshSymbol() {
  return <TriangleAlert size={32} strokeWidth={1.25} />;
}
function ClockIcon() {
  return <Info size={20} />;
}

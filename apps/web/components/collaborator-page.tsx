"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Fingerprint,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  assessOfferSchedule,
  formatMoney,
  offerProgramSlot,
  offerSetupSlot,
  type SupplierView,
} from "@assembly/contracts";
import { usePublicView } from "./public-session";
import { PublicLoading, PublicFailure } from "./event-page";
import { Badge, Button, PublicFooter } from "./ui";
import { eventDate } from "@/lib/format";

export function CollaboratorPage({ token }: { token: string }) {
  const remote = usePublicView<SupplierView>(
    `/api/suppliers/${encodeURIComponent(token)}`,
  );
  const [acceptedHash, setAcceptedHash] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [validUntil, setValidUntil] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [declining, setDeclining] = useState(false);
  if (remote.loading) return <PublicLoading />;
  if (!remote.view)
    return <PublicFailure error={remote.error} retry={remote.refresh} />;
  const v = remote.view,
    s = v.supplier;
  const programSlot = offerProgramSlot(s),
    setupSlot = offerSetupSlot(s);
  const schedule =
    v.requiresEnteredSchedule || v.mode === "REAL"
      ? assessOfferSchedule([s], v.event.doors, v.event.end)
      : null;
  const scheduleIssues = schedule
    ? [
        ...schedule.violations,
        ...schedule.unresolvedProgram,
        ...schedule.unresolvedSetup,
      ]
    : [];
  const closed = ["CANCELLED", "COMPLETED"].includes(v.event.lifecycle);
  const act = (type: "CONFIRM" | "DECLINE") =>
    remote.act({
      type,
      expectedVersion: v.version,
      termsHash: v.termsHash,
      invitationHash: v.invitationHash,
      payload: {
        note,
        ...(type === "CONFIRM"
          ? { validUntil: `${validUntil}T23:59:59.000Z` }
          : {}),
      },
    });
  return (
    <div className="public-site">
      <header className="event-header">
        <Link href="/" className="event-wordmark">
          ASSEMBLY<span>.</span>
        </Link>
        <span>AN INVITATION TO COLLABORATE</span>
        <Badge tone={v.mode === "SAMPLE" ? "warning" : "neutral"}>
          {v.mode === "SAMPLE" ? "Fictional rehearsal" : "Private assignment"}
        </Badge>
      </header>
      <main id="main" className="collaborator-main">
        <div className="eyebrow">ONE EVENING. YOUR PART IN IT.</div>
        <span className="collaborator-avatar">
          {s.name
            .split(/\s+/)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </span>
        <h1>
          A good night
          <br />
          <em>takes good people.</em>
        </h1>
        <p className="collaborator-intro">
          {s.name}, here is your {v.mode === "SAMPLE" ? "sample " : ""}
          assignment for {v.event.title}
        </p>
        <div className="collaborator-sheet">
          <div className="collaborator-sheet-title">
            <div>
              <span>{s.discipline}</span>
              <h2>{s.name}</h2>
            </div>
            <Badge tone={s.status === "CONFIRMED" ? "positive" : "warning"}>
              {closed
                ? v.event.lifecycle.toLowerCase()
                : s.status.toLowerCase()}
            </Badge>
          </div>
          <dl>
            <div>
              <dt>The evening</dt>
              <dd>
                {eventDate(v.event.date)} · {v.event.doors}–{v.event.end}
                {v.event.timezone ? ` · ${v.event.timezone}` : ""}
              </dd>
            </div>
            {v.event.capacity !== undefined ? (
              <div>
                <dt>Room limits</dt>
                <dd>
                  {v.event.capacity} seated places · {v.event.soundLimitDb} dB ·
                  curfew {v.event.curfew}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>The space</dt>
              <dd>
                {v.event.venue} · {v.event.address}
              </dd>
            </div>
            <div>
              <dt>The quoted assignment</dt>
              <dd>{s.scope}</dd>
            </div>
            {v.requiresEnteredSchedule ||
            v.mode === "REAL" ||
            s.programStart !== undefined ? (
              <>
                <div>
                  <dt>Your program slot</dt>
                  <dd>
                    {programSlot
                      ? `${programSlot.start}–${programSlot.end}`
                      : "Exact time to confirm"}
                    {" · "}
                    {v.event.timezone}
                    {s.canOverlap
                      ? " · concurrent service agreed by the operator"
                      : " · dedicated program slot"}
                  </dd>
                </div>
                <div>
                  <dt>Your setup slot</dt>
                  <dd>
                    {s.setupMinutes === 0
                      ? "No setup required"
                      : setupSlot
                        ? `${setupSlot.start}–${setupSlot.end}`
                        : "Exact time to confirm"}
                  </dd>
                </div>
              </>
            ) : null}
            {v.requiresEnteredSchedule ? (
              <div>
                <dt>Timing review</dt>
                <dd>
                  The program and setup slots above are the current proposal.
                  Review them explicitly if they differ from timing in the
                  original quote.
                </dd>
              </div>
            ) : null}
            <div>
              <dt>The {v.mode === "SAMPLE" ? "sample " : ""}fee</dt>
              <dd>
                {formatMoney(s.feeMinor)} GBP · recorded offer, no payment
                collected
              </dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{v.event.access}</dd>
            </div>
            {s.validUntil ? (
              <div>
                <dt>Offer valid until</dt>
                <dd>{new Date(s.validUntil).toLocaleString("en-GB")}</dd>
              </div>
            ) : null}
          </dl>
          <div className="collaborator-disclaimer">
            <ShieldCheck size={18} />
            <p>
              {v.mode === "SAMPLE"
                ? "This assignment is part of a fictional rehearsal. A response records sample consent; it does not create a real engagement."
                : "Your response applies only to this assignment and its current terms. You cannot view the guest list or change the producer’s plans. The host remains responsible for permissions and the final engagement."}
            </p>
          </div>
          {remote.error ? (
            <div className="public-error" role="alert">
              <TriangleAlert size={17} />
              {remote.error}
            </div>
          ) : null}
          {remote.notice ? (
            <div className="public-success" role="status">
              <CheckCircle2 size={17} />
              {remote.notice}
            </div>
          ) : null}
          {closed ? (
            <p>
              This production is {v.event.lifecycle.toLowerCase()}. No further
              response is needed.
            </p>
          ) : s.status === "UNAVAILABLE" ? (
            <div className="collaborator-unavailable">
              You are marked unavailable. The host will review a replacement;
              your earlier confirmation cannot be reused.
            </div>
          ) : (
            <>
              {s.status === "CONFIRMED" && !declining ? (
                <div className="collaborator-confirmed">
                  <CheckCircle2 size={19} />
                  {s.confirmationMethod === "SUPPLIER_RESPONSE"
                    ? "Your response is recorded against these exact terms."
                    : "The host recorded availability. You can add your own confirmation below."}
                </div>
              ) : null}
              {!declining && scheduleIssues.length ? (
                <div className="schedule-review" role="status">
                  <strong>
                    Ask the host to complete the exact timing before you
                    confirm.
                  </strong>
                  <ul>
                    {scheduleIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <label className="field">
                <span>
                  {declining
                    ? "Reason you are unavailable"
                    : "Scope notes or confirmation evidence"}
                </span>
                <textarea
                  value={note}
                  maxLength={1000}
                  rows={3}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    declining
                      ? "Tell the producer what changed."
                      : "Confirm the assignment or add a practical note. Do not include private contact details."
                  }
                />
              </label>
              {!declining ? (
                <label className="field">
                  <span>Keep this availability confirmation valid through</span>
                  <input
                    type="date"
                    value={validUntil}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </label>
              ) : null}
              <label className="consent-label">
                <input
                  type="checkbox"
                  checked={acceptedHash === v.invitationHash}
                  onChange={(e) =>
                    setAcceptedHash(e.target.checked ? v.invitationHash : null)
                  }
                />
                <span>
                  {declining
                    ? "I am no longer available for this exact assignment. I understand the producer may need to pause booking and review the program."
                    : `I’ve reviewed the date, ${v.requiresEnteredSchedule ? "program and setup times, " : ""}fee, scope and access terms. I confirm this ${v.mode === "SAMPLE" ? "sample " : ""}availability and scope until the date above.`}
                </span>
              </label>
              <div className="button-row">
                <Button
                  variant={declining ? "danger" : "primary"}
                  disabled={
                    acceptedHash !== v.invitationHash ||
                    (declining && note.trim().length < 5) ||
                    (!declining && scheduleIssues.length > 0)
                  }
                  busy={!!remote.busy}
                  onClick={async () => {
                    if ((await act(declining ? "DECLINE" : "CONFIRM")).ok) {
                      setAcceptedHash(null);
                      setDeclining(false);
                    }
                  }}
                >
                  {declining
                    ? "Record that I’m unavailable"
                    : "Confirm availability & scope"}
                  <Check size={16} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDeclining(!declining);
                    setAcceptedHash(null);
                  }}
                >
                  {declining ? "Keep reviewing" : "I’m unavailable"}
                </Button>
              </div>
            </>
          )}
          <div className="terms-fingerprint">
            <Fingerprint size={13} />
            Exact assignment {v.invitationHash.slice(0, 12)}
          </div>
        </div>
        <p className="collaborator-private-note">
          Keep this link private. Anyone with it can respond for this
          assignment. No email or payment is sent.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

"use client";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";
import { formatMoney } from "@assembly/contracts";
import { WorkspaceProvider, useWorkspace } from "./workspace-context";
import { PublicLoading, PublicFailure } from "./event-page";
import { Badge, Button, ButtonLink, PublicFooter } from "./ui";
import { eventDate } from "@/lib/format";
export function CollaboratorPage({ token }: { token: string }) {
  return (
    <WorkspaceProvider>
      <Collaborator token={token} />
    </WorkspaceProvider>
  );
}
function Collaborator({ token }: { token: string }) {
  const {
    workspace: w,
    loading,
    error,
    notice,
    act,
    busy,
    refresh,
  } = useWorkspace();
  if (loading) return <PublicLoading />;
  if (!w) return <PublicFailure error={error} retry={refresh} />;
  const supplier = w.suppliers.find((s) => s.token === token);
  if (!supplier)
    return (
      <div className="public-site">
        <main id="main" className="not-found">
          <div className="eyebrow">A SCOPED SAMPLE ASSIGNMENT</div>
          <h1>
            This link
            <br />
            <em>isn’t active.</em>
          </h1>
          <p>
            The assignment is invalid, expired, or belongs to a different sample
            workspace.
          </p>
          <ButtonLink href="/studio/events/blue-hour/production">
            Back to production
          </ButtonLink>
        </main>
      </div>
    );
  return (
    <div className="public-site">
      <header className="event-header">
        <Link href="/" className="event-wordmark">
          ASSEMBLY<span>.</span>
        </Link>
        <span>AN INVITATION TO COLLABORATE</span>
        <Link href="/studio/events/blue-hour/production">
          Producer view <ArrowUpRight size={14} />
        </Link>
      </header>
      <main id="main" className="collaborator-main">
        <div className="eyebrow">ONE EVENING. YOUR PART IN IT.</div>
        <span className="collaborator-avatar">{supplier.initials}</span>
        <h1>
          A good night
          <br />
          <em>takes good people.</em>
        </h1>
        <p className="collaborator-intro">
          {supplier.name}, here is your sample assignment for {w.terms.title}
        </p>
        <div className="collaborator-sheet">
          <div className="collaborator-sheet-title">
            <div>
              <span>{supplier.discipline}</span>
              <h2>{supplier.name}</h2>
            </div>
            <Badge
              tone={supplier.status === "CONFIRMED" ? "positive" : "warning"}
            >
              {supplier.status.toLowerCase()}
            </Badge>
          </div>
          <dl>
            <div>
              <dt>The evening</dt>
              <dd>
                {eventDate(w.terms.date)} · {w.terms.doors}–{w.terms.end}
              </dd>
            </div>
            <div>
              <dt>The space</dt>
              <dd>
                {w.venue.name}, {w.venue.neighborhood}
              </dd>
            </div>
            <div>
              <dt>The assignment</dt>
              <dd>{supplier.scope}</dd>
            </div>
            <div>
              <dt>The sample fee</dt>
              <dd>{formatMoney(supplier.feeMinor)} GBP · no real payment</dd>
            </div>
            <div>
              <dt>The constraints</dt>
              <dd>
                {w.venue.capacity} seated guests · {w.venue.soundLimitDb} dB
                sound limit · {w.venue.curfew} curfew
              </dd>
            </div>
            <div>
              <dt>The source</dt>
              <dd>{supplier.source}</dd>
            </div>
          </dl>
          <div className="collaborator-disclaimer">
            <ShieldCheck size={18} />
            <p>
              This is a role-play within the producer’s isolated sample session.
              Confirming records a fictional offer; it sends no message and does
              not create a real contract.
            </p>
          </div>
          {error ? (
            <div className="public-error" role="alert">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="public-success" role="status">
              {notice}
            </div>
          ) : null}
          {supplier.status === "QUOTED" ? (
            <Button
              busy={busy === "CONFIRM_SUPPLIER"}
              onClick={() =>
                void act("CONFIRM_SUPPLIER", { supplierId: supplier.id })
              }
            >
              Confirm this sample availability & scope <Check size={16} />
            </Button>
          ) : supplier.status === "CONFIRMED" ? (
            <div className="collaborator-confirmed">
              <CheckCircle2 size={19} />
              Sample terms confirmed. Your production record is updated.
            </div>
          ) : (
            <div className="collaborator-unavailable">
              This sample supplier is unavailable. The producer must review a
              replacement.
            </div>
          )}
          <div className="terms-fingerprint">
            <Fingerprint size={13} />
            Sample event terms v{w.terms.version}
          </div>
        </div>
        <ButtonLink href="/studio/events/blue-hour/production" variant="ghost">
          <ArrowLeft size={14} />
          Back to the production
        </ButtonLink>
      </main>
      <PublicFooter />
    </div>
  );
}

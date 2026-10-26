"use client";
import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Info,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  formatMoney,
  offerProgramSlot,
  offerSetupSlot,
  selectedConcept,
  type Supplier,
} from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, ButtonLink, EmptyState } from "../ui";

const methodLabel = (s: Supplier, sample: boolean) =>
  s.status === "QUOTED"
    ? sample
      ? "Authored sample offer"
      : "Operator-entered quote"
    : s.confirmationMethod === "SUPPLIER_RESPONSE"
      ? "Response through supplier link"
      : s.confirmationMethod === "OWNER_ATTESTATION"
        ? "Recorded by the operator"
        : sample
          ? "Authored sample offer"
          : "Operator-entered quote";

export function SuppliersView() {
  const { workspace: w, act, busy } = useWorkspace();
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  if (!w) return null;
  const selected = selectedConcept(w)?.supplierIds || [];
  const locked = !["DRAFT", "CONCEPT_READY"].includes(w.event.lifecycle);
  return (
    <>
      <div className="inventory-heading">
        <div>
          <div className="eyebrow">THE PEOPLE & THE POSSIBILITIES</div>
          <h1>
            A good night
            <br />
            <em>starts with good people.</em>
          </h1>
          <p>
            Enter offers you can stand behind. Keep the scope, source and price
            explicit. Cultural fit comes next.
          </p>
        </div>
        <Button
          disabled={["COMPLETED", "CANCELLED"].includes(w.event.lifecycle)}
          onClick={() => setEditing("new")}
        >
          <Plus size={17} />
          Add a supplier offer
        </Button>
      </div>
      <div className="inventory-boundary">
        <ShieldCheck size={20} />
        <p>
          {w.mode === "SAMPLE"
            ? "These are fictional offers for a rehearsal. Adding or confirming them records sample activity."
            : "These are your entered offers. A quote is not a confirmed engagement. Use a private supplier link or record a dated operator attestation."}{" "}
          Qloo can connect their influences; it cannot establish availability,
          fees or rights.
        </p>
      </div>
      {w.suppliers.length ? (
        <div className="inventory-grid">
          {w.suppliers.map((s) => (
            <article className="inventory-card" id={`offer-${s.id}`} key={s.id}>
              <div className="inventory-card-top">
                <span className="supplier-avatar">{s.initials}</span>
                <Badge
                  tone={
                    s.status === "CONFIRMED"
                      ? "positive"
                      : s.status === "UNAVAILABLE"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {s.status.toLowerCase()}
                </Badge>
              </div>
              <div className="eyebrow">{s.discipline}</div>
              <h2>{s.name}</h2>
              <p>{s.description}</p>
              <div className="offer-terms">
                <strong>{formatMoney(s.feeMinor)}</strong>
                <span>fixed offer · GBP</span>
                {selected.includes(s.id) ? (
                  <Badge tone="coral" dot={false}>
                    In this production
                  </Badge>
                ) : null}
              </div>
              <dl>
                <div>
                  <dt>The scope</dt>
                  <dd>{s.scope}</dd>
                </div>
                <div>
                  <dt>Program time</dt>
                  <dd>
                    {offerProgramSlot(s)
                      ? `${offerProgramSlot(s)!.start}–${offerProgramSlot(s)!.end}`
                      : "Exact time to confirm"}
                    {s.canOverlap ? " · may run alongside other items" : ""}
                  </dd>
                </div>
                <div>
                  <dt>Setup time</dt>
                  <dd>
                    {s.setupMinutes === 0
                      ? "No setup required"
                      : offerSetupSlot(s)
                        ? `${offerSetupSlot(s)!.start}–${offerSetupSlot(s)!.end}`
                        : "Exact time to confirm"}
                  </dd>
                </div>
                <div>
                  <dt>The source</dt>
                  <dd>{s.source}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>
                    {s.validUntil
                      ? `Review by ${new Date(s.validUntil).toLocaleDateString("en-GB")}`
                      : "Confirmation required"}
                  </dd>
                </div>
                <div>
                  <dt>Recorded by</dt>
                  <dd>{methodLabel(s, w.mode === "SAMPLE")}</dd>
                </div>
              </dl>
              <div className="supplier-influence-note">
                <Info size={14} />
                <p>
                  {s.influence || "No cultural influence has been linked yet."}
                </p>
              </div>
              <SupplierTools supplier={s} />
              <div className="inventory-card-bottom">
                <Button
                  variant="ghost"
                  disabled={locked && selected.includes(s.id)}
                  onClick={() => setEditing(s)}
                >
                  <Pencil size={14} />
                  Edit offer
                </Button>
                {!selected.includes(s.id) ? (
                  <Button
                    variant="ghost"
                    busy={busy === "REMOVE_SUPPLIER"}
                    onClick={() =>
                      void act("REMOVE_SUPPLIER", { supplierId: s.id })
                    }
                  >
                    <Trash2 size={14} />
                    Remove
                  </Button>
                ) : (
                  <span>
                    {locked
                      ? "Change through a reviewed proposal"
                      : "Used by the chosen concept"}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users size={25} />}
          title="Who could make this evening happen?"
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} />
              Add your first offer
            </Button>
          }
        >
          Start with a performer, facilitator, food partner or host whose scope
          and quote you know. Unconfirmed offers remain visible until someone
          confirms them.
        </EmptyState>
      )}
      <div className="inventory-next">
        <p>
          Have a few workable offers? Give the evening its cultural direction.
        </p>
        <ButtonLink href="/studio/events/current/brief" variant="secondary">
          Shape the brief
          <ArrowRight size={15} />
        </ButtonLink>
      </div>
      <Dialog.Root
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="modal dark-modal supplier-editor">
            <Dialog.Close
              className="icon-button modal-close"
              aria-label="Close supplier editor"
            >
              <X size={18} />
            </Dialog.Close>
            <div className="eyebrow">AN OFFER, WITH A SOURCE</div>
            <Dialog.Title>
              {editing === "new"
                ? "Someone for the evening."
                : "Keep the details clear."}
            </Dialog.Title>
            <Dialog.Description>
              Record the actual scope and quote. Changes to a selected,
              published offer need a reviewed replacement.
            </Dialog.Description>
            {editing ? (
              <SupplierForm
                key={editing === "new" ? "new" : editing.id}
                supplier={editing === "new" ? undefined : editing}
                saved={() => setEditing(null)}
              />
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function SupplierForm({
  supplier: s,
  saved,
}: {
  supplier?: Supplier;
  saved: () => void;
}) {
  const { act, busy, error } = useWorkspace();
  const [draft, setDraft] = useState(() => ({
    id: s?.id,
    name: s?.name || "",
    discipline: s?.discipline || "",
    feeMinor: s?.feeMinor ?? 0,
    description: s?.description || "",
    critical: s?.critical ?? true,
    source: s?.source || "",
    influence: s?.influence || "",
    scope: s?.scope || "",
    validUntil:
      s?.validUntil?.slice(0, 10) ||
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    setupMinutes: s?.setupMinutes ?? 30,
    durationMinutes: s?.durationMinutes ?? 50,
    programStart: s?.programStart || "",
    setupStart: s?.setupStart || "",
    canOverlap: s?.canOverlap ?? false,
    soundDb: s?.soundDb ?? 70,
  }));
  function update(key: string, value: string | number | boolean) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await act("UPSERT_SUPPLIER", {
          supplier: {
            ...draft,
            programStart: draft.programStart || undefined,
            setupStart: draft.setupStart || undefined,
            validUntil: `${draft.validUntil}T23:59:59.000Z`,
          },
        });
        if (result.ok) saved();
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>Supplier or collaborator name</span>
          <input
            required
            maxLength={100}
            value={draft.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Name from your quote"
          />
        </label>
        <label className="field">
          <span>Role in the evening</span>
          <input
            required
            maxLength={100}
            value={draft.discipline}
            onChange={(e) => update("discipline", e.target.value)}
            placeholder="Acoustic performance, food, workshop…"
          />
        </label>
      </div>
      <label className="field">
        <span>What they bring</span>
        <textarea
          required
          minLength={5}
          maxLength={1000}
          rows={2}
          value={draft.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </label>
      <label className="field">
        <span>Exact assignment & restrictions</span>
        <textarea
          required
          minLength={5}
          maxLength={2000}
          rows={3}
          value={draft.scope}
          onChange={(e) => update("scope", e.target.value)}
          placeholder="Deliverables, timing, equipment, travel and anything the host must provide."
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>
            Fixed fee <small>GBP</small>
          </span>
          <div className="input-prefix">
            <span>£</span>
            <input
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              required
              value={draft.feeMinor / 100}
              onChange={(e) =>
                update("feeMinor", Math.round(Number(e.target.value) * 100))
              }
            />
          </div>
        </label>
        <label className="field">
          <span>Quote / confirmation review date</span>
          <input
            type="date"
            required
            value={draft.validUntil}
            onChange={(e) => update("validUntil", e.target.value)}
          />
        </label>
      </div>
      <div className="form-grid form-grid-three">
        <label className="field">
          <span>
            Setup <small>minutes</small>
          </span>
          <input
            type="number"
            required
            min="0"
            max="240"
            value={draft.setupMinutes}
            onChange={(e) => update("setupMinutes", Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>
            Program length <small>minutes</small>
          </span>
          <input
            type="number"
            required
            min="1"
            max="180"
            value={draft.durationMinutes}
            onChange={(e) => update("durationMinutes", Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>
            Sound <small>dB</small>
          </span>
          <input
            type="number"
            required
            min="0"
            max="140"
            value={draft.soundDb}
            onChange={(e) => update("soundDb", Number(e.target.value))}
          />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Program starts</span>
          <input
            type="time"
            value={draft.programStart}
            onChange={(e) => update("programStart", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Setup starts</span>
          <input
            type="time"
            disabled={draft.setupMinutes === 0}
            value={draft.setupStart}
            onChange={(e) => update("setupStart", e.target.value)}
          />
        </label>
      </div>
      <p className="field-hint">
        Times use the venue’s timezone on the event date. Enter the slot from
        the offer; timing in the scope text is not added to the schedule.
        Confirm program times before publishing and setup before greenlight.
      </p>
      <label className="consent-label">
        <input
          type="checkbox"
          checked={draft.canOverlap}
          onChange={(e) => update("canOverlap", e.target.checked)}
        />
        <span>
          This offer may run alongside another program item, such as food
          service during a performance. I have checked that the activities can
          share the space.
        </span>
      </label>
      <label className="field">
        <span>Source of the quote</span>
        <textarea
          required
          minLength={5}
          maxLength={1000}
          rows={2}
          value={draft.source}
          onChange={(e) => update("source", e.target.value)}
          placeholder="Who provided it, when, and what you checked. Keep private contact details out."
        />
      </label>
      <label className="field">
        <span>
          Known cultural influences <small>OPTIONAL</small>
        </span>
        <input
          maxLength={1000}
          value={draft.influence}
          onChange={(e) => update("influence", e.target.value)}
          placeholder="Influences they or you can confirm. Link catalog identities in the brief."
        />
      </label>
      <label className="consent-label">
        <input
          type="checkbox"
          checked={draft.critical}
          onChange={(e) => update("critical", e.target.checked)}
        />
        <span>
          This offer is essential to a concept that selects it. Losing it should
          pause booking for review.
        </span>
      </label>
      {error ? (
        <div className="feedback feedback-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="modal-actions">
        <Button type="submit" busy={busy === "UPSERT_SUPPLIER"}>
          Save this offer
          <Check size={16} />
        </Button>
      </div>
    </form>
  );
}

export function SupplierTools({ supplier: s }: { supplier: Supplier }) {
  const { workspace: w, act, busy } = useWorkspace();
  const [link, setLink] = useState<{ token: string; termsHash: string } | null>(
    null,
  );
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attest, setAttest] = useState(false);
  const [note, setNote] = useState("");
  const [until, setUntil] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  if (!w) return null;
  const currentLink = link?.termsHash === w.terms.hash ? link : null;
  async function invite() {
    if (!w) return;
    setOpening(true);
    setError(null);
    try {
      const response = await fetch("/api/supplier-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: s.id,
          expectedVersion: w.version,
          workspaceId: w.id,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message || "This assignment link could not be opened.",
        );
      setLink({ token: data.token, termsHash: data.view.termsHash });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create the invitation.",
      );
    } finally {
      setOpening(false);
    }
  }
  return (
    <div className="supplier-tools">
      {s.status !== "UNAVAILABLE" &&
      !["CANCELLED", "COMPLETED"].includes(w.event.lifecycle) ? (
        <>
          <div className="button-row">
            <Button
              variant="secondary"
              busy={opening}
              onClick={() => void invite()}
            >
              <ExternalLink size={14} />
              {currentLink
                ? "Refresh supplier link"
                : "Open supplier invitation"}
            </Button>
            <Button variant="ghost" onClick={() => setAttest(!attest)}>
              {attest
                ? "Close check"
                : s.status === "CONFIRMED"
                  ? "Renew my confirmation"
                  : "Record my confirmation"}
            </Button>
          </div>
          {currentLink ? (
            <div className="supplier-share">
              <Link
                href={`/collaborate/${currentLink.token}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open scoped assignment
                <ArrowUpRight size={14} />
              </Link>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/collaborate/${currentLink.token}`,
                    );
                    setCopied(true);
                  } catch {
                    setError(
                      "Open the assignment and copy its address to share it.",
                    );
                  }
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy private link"}
              </button>
              <small>
                Only this supplier’s scope. Share it yourself; no message is
                sent.
              </small>
            </div>
          ) : null}
          {attest ? (
            <form
              className="proof-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  (
                    await act("CONFIRM_SUPPLIER", {
                      supplierId: s.id,
                      validUntil: `${until}T23:59:59.000Z`,
                      note,
                    })
                  ).ok
                )
                  setAttest(false);
              }}
            >
              <label className="field">
                <span>What did you confirm, and with whom?</span>
                <textarea
                  rows={2}
                  required
                  minLength={5}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    w.mode === "SAMPLE"
                      ? "Rehearsal confirmation of the sample fee, date and scope."
                      : "Record your source for the current date, fee and exact scope."
                  }
                />
              </label>
              <label className="field">
                <span>Confirmation valid through</span>
                <input
                  type="date"
                  required
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </label>
              <Button type="submit" busy={busy === "CONFIRM_SUPPLIER"}>
                <Check size={14} />
                Save operator attestation
              </Button>
              <p className="field-hint">
                Recorded as your attestation, separately from a response through
                the supplier link.
              </p>
            </form>
          ) : null}
        </>
      ) : null}
      {error ? (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

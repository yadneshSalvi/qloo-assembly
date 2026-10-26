"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, Fingerprint, ShieldCheck, X } from "lucide-react";
import { formatMoney, type ActionType } from "@assembly/contracts";
import { Button, Badge } from "./ui";
import { useWorkspace } from "./workspace-context";
export function ApprovalDialog({
  open,
  onOpenChange,
  action,
  title,
  description,
  buttonLabel,
  children,
  blocked = false,
  payload = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ActionType;
  title: string;
  description: string;
  buttonLabel: string;
  children?: ReactNode;
  blocked?: boolean;
  payload?: Record<string, unknown>;
}) {
  const { workspace: w, act, busy, error } = useWorkspace();
  const [acceptedHash, setAcceptedHash] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  if (!w) return null;
  const change = action === "APPROVE_CHANGE" ? w.change : null;
  const approvalIdentity = `${w.terms.hash}:${change?.id ?? ""}`;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) setAcceptedHash(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="modal dark-modal approval-modal"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            else document.getElementById("main")?.focus();
          }}
        >
          <Dialog.Close
            className="icon-button modal-close"
            aria-label="Close approval"
          >
            <X size={18} />
          </Dialog.Close>
          <div className="eyebrow">
            <ShieldCheck size={16} />
            YOUR DECISION
          </div>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {change ? (
            <div className="proposed-change-preview">
              <div className="eyebrow">
                PROPOSED CHANGE · TERMS v{w.terms.version + 1}
              </div>
              {change.supplierId ? (
                <div>
                  <del>{change.before}</del>
                  <ArrowRight size={15} />
                  <strong>{change.after}</strong>
                </div>
              ) : null}
              {change.diff?.map((diff) => (
                <div className="approval-diff" key={diff.field}>
                  <span>
                    {diff.field === "priceMinor"
                      ? "Price"
                      : diff.field === "programSchedule"
                        ? "Program times"
                        : diff.field === "setupSchedule"
                          ? "Setup times"
                          : diff.field}
                  </span>
                  <del>
                    {diff.field === "priceMinor"
                      ? formatMoney(Number(diff.before))
                      : diff.before}
                  </del>
                  <strong>
                    {diff.field === "priceMinor"
                      ? formatMoney(Number(diff.after))
                      : diff.after}
                  </strong>
                </div>
              ))}
              <p>
                Full-capacity cost delta:{" "}
                <strong>
                  {(change.totalCostDeltaMinor ?? change.costDeltaMinor) >= 0
                    ? "+"
                    : ""}
                  {formatMoney(
                    change.totalCostDeltaMinor ?? change.costDeltaMinor,
                  )}
                </strong>
                . Current active choices will require reconfirmation. The
                differences above become the new terms.
              </p>
            </div>
          ) : null}
          <div className="approval-terms">
            {change ? (
              <div className="eyebrow">
                CURRENT APPROVED TERMS · BASE OF THIS CHANGE
              </div>
            ) : null}
            <div>
              <strong>{w.terms.title}</strong>
              <Badge>Terms v{w.terms.version}</Badge>
            </div>
            <dl>
              <div>
                <dt>Date</dt>
                <dd>
                  {w.terms.date} · {w.terms.doors}–{w.terms.end}
                  {" · "}
                  {w.terms.timezone || w.venue.timezone}
                </dd>
              </div>
              <div>
                <dt>Room limits</dt>
                <dd>
                  {w.terms.soundLimitDb ?? w.venue.soundLimitDb} dB · curfew{" "}
                  {w.terms.curfew || w.venue.curfew}
                </dd>
              </div>
              <div>
                <dt>Place</dt>
                <dd>
                  {w.terms.venue} · {w.venue.capacity} seated
                </dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>
                  {formatMoney(w.terms.priceMinor)} per person ·{" "}
                  {w.mode === "SAMPLE" ? "sample only" : "free admission"}
                </dd>
              </div>
              <div>
                <dt>{change ? "Previous program" : "Program"}</dt>
                <dd>{w.terms.program}</dd>
              </div>
              {w.terms.programSchedule?.length ? (
                <div>
                  <dt>{change ? "Previous times" : "Program times"}</dt>
                  <dd>
                    <ul className="terms-program-slots">
                      {w.terms.programSchedule.map((slot) => (
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
                <dd>{w.terms.access}</dd>
              </div>
            </dl>
          </div>
          {children}
          <div className="approval-hash">
            <Fingerprint size={13} />
            {change ? "Base terms hash" : "Exact terms hash"}{" "}
            <code>{w.terms.hash.slice(0, 16)}</code>
            <span>v{w.terms.version}</span>
          </div>
          {change ? (
            <div className="approval-hash">
              Change reference <code>{change.id}</code>
            </div>
          ) : null}
          <label className="consent-label">
            <input
              type="checkbox"
              checked={acceptedHash === approvalIdentity}
              onChange={(e) =>
                setAcceptedHash(e.target.checked ? approvalIdentity : null)
              }
            />
            <span>
              {change
                ? `I have reviewed the exact differences, cost delta and base terms. I approve this change${w.mode === "SAMPLE" ? " in this fictional rehearsal" : " as the operator"}.`
                : `I have reviewed these exact terms and approve this action${w.mode === "SAMPLE" ? " in this fictional rehearsal" : " as the operator"}.`}
            </span>
          </label>
          {error ? (
            <div className="approval-check warning" role="alert">
              <p>{error}</p>
            </div>
          ) : null}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Keep reviewing
            </Button>
            <Button
              disabled={acceptedHash !== approvalIdentity || blocked}
              busy={busy === action}
              onClick={async () => {
                const result = await act(action, {
                  ...payload,
                  termsHash: w.terms.hash,
                });
                if (result.ok) {
                  onOpenChange(false);
                  setAcceptedHash(null);
                }
              }}
            >
              {buttonLabel}
              <Check size={15} />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

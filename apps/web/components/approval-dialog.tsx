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
                PROPOSED PROGRAM · TERMS v{w.terms.version + 1}
              </div>
              <div>
                <del>{change.before}</del>
                <ArrowRight size={15} />
                <strong>{change.after}</strong>
              </div>
              <p>
                Fixed production cost increases by{" "}
                <strong>{formatMoney(change.costDeltaMinor)}</strong>. Date,
                venue, price, and access terms remain as shown below. Current
                active choices will require reconfirmation.
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
                  {formatMoney(w.terms.priceMinor)} per person · sample only
                </dd>
              </div>
              <div>
                <dt>{change ? "Previous program" : "Program"}</dt>
                <dd>{w.terms.program}</dd>
              </div>
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
                ? "I have reviewed this replacement, cost delta, and unchanged terms. I approve this exact change in my isolated sample workspace."
                : "I have reviewed these exact terms and approve this action in my isolated sample workspace."}
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

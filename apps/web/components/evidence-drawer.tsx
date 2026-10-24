"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Database,
  Fingerprint,
  Info,
  X,
} from "lucide-react";
import { useWorkspace } from "./workspace-context";
import { Badge } from "./ui";
const labels = {
  AUTHORED_SAMPLE: "Authored example",
  QLOO_RESULT: "Qloo result",
  OPERATOR_ASSERTION: "Operator assertion",
  APP_CALCULATION: "App calculation",
  MODEL_HYPOTHESIS: "Model hypothesis",
  HUMAN_CHOICE: "Human choice",
};
export function EvidenceDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspace: w } = useWorkspace();
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content
          className="evidence-drawer"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <div className="drawer-heading">
            <span className="eyebrow">
              <BookOpen size={14} />
              BEHIND THE DECISION
            </span>
            <Dialog.Close aria-label="Close evidence" className="icon-button">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Title>
            Good decisions
            <br />
            <em>have a source.</em>
          </Dialog.Title>
          <Dialog.Description>
            See what we know, who said it, and where the evidence ends.
          </Dialog.Description>
          <div className="evidence-mode">
            <Badge tone="warning">Sample operations</Badge>
            <Badge>
              Qloo{" "}
              {w?.qloo.status === "UNAVAILABLE" ? "unavailable" : "configured"}
            </Badge>
          </div>
          <div className="evidence-callout">
            <Info size={19} />
            <div>
              <strong>Authored concepts, clearly labeled.</strong>
              <p>
                {w?.qloo.message ||
                  "Qloo is not connected. This experience uses authored sample concepts."}
              </p>
            </div>
          </div>
          {w?.evidence.map((e, i) => (
            <article className="evidence-item" key={e.id}>
              <div className="evidence-item-top">
                <span>0{i + 1}</span>
                <Badge dot={false}>{labels[e.origin]}</Badge>
              </div>
              <h3>{e.title}</h3>
              <p>{e.body}</p>
              <div className="evidence-source">
                <Database size={13} />
                {e.source}
              </div>
              <div className="evidence-boundary">
                <Fingerprint size={14} />
                <p>{e.boundary}</p>
              </div>
            </article>
          ))}
          <div className="evidence-principle">
            <Check size={16} />
            <p>
              Affinity never establishes availability, consent, or ticket
              demand. Every production decision remains yours.
            </p>
          </div>
          <a
            className="text-link"
            href="https://docs.qloo.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Qloo developer documentation
            <ArrowUpRight size={14} />
          </a>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

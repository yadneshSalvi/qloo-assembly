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
import {
  RESEARCH_CALL_LIMITS,
  type Evidence,
  type ResearchEvidence,
} from "@assembly/contracts";
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
  const hasLiveEvidence = w?.evidence.some((e) => e.origin === "QLOO_RESULT");
  const earlierNotes = hasLiveEvidence
    ? (w?.evidence.filter((e) => e.origin === "AUTHORED_SAMPLE") ?? [])
    : [];
  const sources = (w?.evidence ?? [])
    .filter((e) => !hasLiveEvidence || e.origin !== "AUTHORED_SAMPLE")
    .toSorted(
      (a, b) =>
        Number(b.origin === "QLOO_RESULT") - Number(a.origin === "QLOO_RESULT"),
    );
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
            <Badge tone={w?.mode === "REAL" ? "neutral" : "warning"}>
              {w?.mode === "REAL"
                ? "Operator-owned inventory"
                : "Sample operations"}
            </Badge>
            <Badge tone={w?.qloo.status === "LIVE" ? "positive" : "neutral"}>
              Qloo{" "}
              {w?.qloo.status === "LIVE"
                ? "live evidence"
                : w?.qloo.status === "UNAVAILABLE"
                  ? "not used yet"
                  : "configured"}
            </Badge>
          </div>
          <div className="evidence-callout">
            <Info size={19} />
            <div>
              <strong>Every source has a boundary.</strong>
              <p>
                {w?.qloo.message ||
                  "Qloo is not connected. This experience uses authored sample concepts."}
              </p>
            </div>
          </div>
          {w?.research?.anchors.length ? (
            <div className="evidence-anchors">
              <div className="eyebrow">EXACT CULTURAL STARTING POINTS</div>
              {w.research.anchors.map((a) => (
                <div key={a.entityId}>
                  <strong>{a.name}</strong>
                  <span>{a.entityType} · chosen by the operator</span>
                </div>
              ))}
            </div>
          ) : null}
          {sources.map((e, i) => (
            <EvidenceRecord key={e.id} evidence={e} index={i} />
          ))}
          {earlierNotes.length ? (
            <details className="evidence-history">
              <summary>
                Earlier authored sample notes · {earlierNotes.length}
              </summary>
              <p>
                These notes describe the sample as it was recorded. They are
                kept as context; the live results appear above.
              </p>
              {earlierNotes.map((e, i) => (
                <EvidenceRecord
                  key={e.id}
                  evidence={e}
                  index={sources.length + i}
                />
              ))}
            </details>
          ) : null}
          {w?.research?.trace.length ? (
            <details className="research-trace">
              <summary>
                The producer’s saved work <BookOpen size={14} />
              </summary>
              {w.research.trace.map((t) => (
                <div key={t.id}>
                  <Badge dot={false}>
                    {t.provider === "qloo"
                      ? "Qloo"
                      : t.provider === "model"
                        ? "AI producer"
                        : "Application"}
                    {t.cacheHit ? " · cached" : ""}
                  </Badge>
                  <strong>{t.stage}</strong>
                  <p>{t.summary}</p>
                </div>
              ))}
              <p className="field-hint">
                {w.research.budget.qlooUsed}/{w.research.budget.qlooLimit} Qloo
                calls · {w.research.budget.modelUsed}/
                {w.research.budget.modelLimit} model steps charged to this run.
                {w.research.budget.modelLimit >= RESEARCH_CALL_LIMITS.model
                  ? " Includes at most one proposal correction using the same captured evidence."
                  : ""}
              </p>
            </details>
          ) : null}
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

function EvidenceRecord({
  evidence: e,
  index,
}: {
  evidence: Evidence;
  index: number;
}) {
  return (
    <article className="evidence-item">
      <div className="evidence-item-top">
        <span>{(index + 1).toString().padStart(2, "0")}</span>
        <Badge dot={false}>{labels[e.origin]}</Badge>
      </div>
      <h3>{e.title}</h3>
      <p>{e.body}</p>
      {e.origin === "QLOO_RESULT" && "rankings" in e ? (
        <ol className="evidence-rankings">
          {(e as ResearchEvidence).rankings.map((r) => (
            <li key={r.entityId}>
              <span>{r.position.toString().padStart(2, "0")}</span>
              <strong>{r.name}</strong>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="evidence-source">
        <Database size={13} />
        {e.origin === "APP_CALCULATION" && e.id === "cost-calculation"
          ? "Cost worksheet · GBP"
          : e.source}
      </div>
      <small className="evidence-captured">
        Captured{" "}
        {new Date(e.capturedAt).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </small>
      <div className="evidence-boundary">
        <Fingerprint size={14} />
        <p>{e.boundary}</p>
      </div>
    </article>
  );
}

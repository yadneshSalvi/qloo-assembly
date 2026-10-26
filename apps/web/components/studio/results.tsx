"use client";
import { ArrowRight, Fingerprint, Info } from "lucide-react";
import { countsFor, costWorksheet, formatMoney } from "@assembly/contracts";
import { useWorkspace } from "../workspace-context";
import { Badge, ButtonLink } from "../ui";
export function ResultsView() {
  const { workspace: w } = useWorkspace();
  if (!w) return null;
  const n = countsFor(w),
    cost = costWorksheet(w),
    done = w.event.lifecycle === "COMPLETED";
  return (
    <>
      <div className="results-hero">
        <div className="eyebrow">05 / THE OUTCOME</div>
        <span className="result-star">✳</span>
        <h2>
          {done ? (
            <>
              A night,
              <br />
              <em>made together.</em>
            </>
          ) : (
            <>
              The story is
              <br />
              <em>still unfolding.</em>
            </>
          )}
        </h2>
        <p>
          {done
            ? w.mode === "SAMPLE"
              ? "Here is what happened in this fictional rehearsal. Recorded actions stay separate from real-world outcomes."
              : "Here is the operator’s record of this production, alongside guest choices and feedback. The record does not independently verify a physical event."
            : "Every saved choice and production step becomes part of the record. The outcome will only reflect what you actually do."}
        </p>
        <Badge tone={done ? "positive" : "neutral"}>
          {done
            ? w.mode === "SAMPLE"
              ? "Sample production completed"
              : "Completion recorded by operator"
            : w.event.lifecycle === "CANCELLED"
              ? "Production cancelled"
              : "Production in progress"}
        </Badge>
      </div>
      <div className="result-metrics">
        <div>
          <strong>{n.verified}</strong>
          <span>current confirmed choices</span>
        </div>
        <div>
          <strong>{n.bookings}</strong>
          <span>
            {w.mode === "SAMPLE"
              ? "confirmed sample places"
              : "confirmed free places"}
          </span>
        </div>
        <div>
          <strong>{n.checkins}</strong>
          <span>
            {w.mode === "SAMPLE"
              ? "recorded sample arrivals"
              : "operator-recorded arrivals"}
          </span>
        </div>
        <div>
          <strong>£0</strong>
          <span>collected through ASSEMBLY</span>
        </div>
      </div>
      {w.feedback?.length ? (
        <section className="panel feedback-results">
          <div className="panel-heading">
            <div>
              <h3>Voices after the evening</h3>
              <p>
                {w.feedback.length} private-link feedback{" "}
                {w.feedback.length === 1 ? "response" : "responses"} ·{" "}
                {w.mode === "SAMPLE"
                  ? "sample activity"
                  : "submitted by response-link holders"}
              </p>
            </div>
          </div>
          {w.feedback.map((f) => (
            <div className="feedback-result" key={f.id}>
              <strong>{f.rating} / 5</strong>
              <p>{f.comment || "Rating only"}</p>
              <span>
                {f.origin === "AUTHORED_SAMPLE"
                  ? "Rehearsal response"
                  : "Participant response"}
              </span>
            </div>
          ))}
        </section>
      ) : null}
      <div className="results-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>The decisions behind the evening</h3>
              <p>A saved, versioned record of this workspace.</p>
            </div>
            <Fingerprint size={19} />
          </div>
          <div className="audit-list">
            {w.audit
              .slice()
              .reverse()
              .slice(0, 15)
              .map((a) => (
                <div key={a.id} className="audit-item">
                  <span className="audit-dot" />
                  <div>
                    <strong>{a.description}</strong>
                    <small>
                      {new Date(a.at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · workspace v{a.version}
                    </small>
                  </div>
                  <Badge dot={false}>
                    {a.action.toLowerCase().replaceAll("_", " ")}
                  </Badge>
                </div>
              ))}
          </div>
        </section>
        <aside>
          <div className="panel results-notes">
            <div className="eyebrow">WHAT THE NUMBERS CAN SAY</div>
            <h3>Evidence, with its edges.</h3>
            <p>
              {w.mode === "SAMPLE"
                ? "This is a fictional rehearsal. It demonstrates the operational flow; it does not measure real demand, revenue or independent human preference."
                : "These are choices submitted through private links and observations recorded by the operator. Link possession is not independent identity verification."}
            </p>
            <dl>
              <div>
                <dt>Estimated production cost</dt>
                <dd>{formatMoney(cost.total)}</dd>
              </div>
              <div>
                <dt>Actual paid revenue</dt>
                <dd>£0</dd>
              </div>
              <div>
                <dt>Independent impact study</dt>
                <dd>Not measured</dd>
              </div>
              <div>
                <dt>Live Qloo evidence records</dt>
                <dd>
                  {w.evidence.filter((e) => e.origin === "QLOO_RESULT").length}
                </dd>
              </div>
            </dl>
            <div className="inline-hint">
              <Info size={14} />
              Affinity does not measure demand or Qloo’s causal contribution.
            </div>
          </div>
          {w.completion ? (
            <div className="panel results-notes">
              <div className="eyebrow">COMPLETION RECORD</div>
              <p>{w.completion.evidence}</p>
              <small>
                {new Date(w.completion.observedAt).toLocaleString("en-GB")} ·{" "}
                {w.completion.origin === "AUTHORED_SAMPLE"
                  ? "Rehearsal observation"
                  : "Operator assertion"}
              </small>
            </div>
          ) : null}
          {!done ? (
            <ButtonLink href="/studio/events/current/production">
              Continue the production <ArrowRight size={16} />
            </ButtonLink>
          ) : (
            <ButtonLink href="/studio">
              Back to your desk <ArrowRight size={16} />
            </ButtonLink>
          )}
        </aside>
      </div>
    </>
  );
}

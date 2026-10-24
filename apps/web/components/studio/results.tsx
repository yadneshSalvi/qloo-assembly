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
            ? "Here is what happened in this isolated sample. Observations stay separate from hopes, hypotheses, and estimates."
            : "Every saved choice and production step becomes part of the record. The outcome will only reflect what you actually do."}
        </p>
        <Badge tone={done ? "positive" : "neutral"}>
          {done ? "Sample production completed" : "Production in progress"}
        </Badge>
      </div>
      <div className="result-metrics">
        <div>
          <strong>{n.verified}</strong>
          <span>current verified choices</span>
        </div>
        <div>
          <strong>{n.bookings}</strong>
          <span>confirmed sample places</span>
        </div>
        <div>
          <strong>{n.checkins}</strong>
          <span>observed sample arrivals</span>
        </div>
        <div>
          <strong>£0</strong>
          <span>paid transactions</span>
        </div>
      </div>
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
              This is a fictional, local scenario. It demonstrates the
              operational workflow; it does not measure real demand, revenue, or
              Qloo’s contribution.
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
                <dt>Independent pilot participants</dt>
                <dd>0</dd>
              </div>
              <div>
                <dt>Live Qloo results</dt>
                <dd>0</dd>
              </div>
            </dl>
            <div className="inline-hint">
              <Info size={14} />A preference study and a real authorized pilot
              remain separate work.
            </div>
          </div>
          {!done ? (
            <ButtonLink href="/studio/events/blue-hour/production">
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

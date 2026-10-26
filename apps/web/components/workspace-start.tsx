"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, DoorOpen, Sparkles } from "lucide-react";
import { Badge, Button } from "./ui";

export function WorkspaceStart() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function create(mode: "SAMPLE" | "REAL") {
    setBusy(mode);
    setError(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message || "Your production could not be created.",
        );
      router.push(mode === "REAL" ? "/studio/venue" : "/studio");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not reach the studio. Try again.",
      );
      setBusy(null);
    }
  }
  return (
    <div className="workspace-start">
      <div className="demo-mode">
        <div>
          <Badge tone="positive">A complete rehearsal</Badge>
          <h2>Make a night at The Fold.</h2>
          <p>
            Fictional venue and offers. Use live Qloo discovery and an AI
            producer, or explore authored concepts. Invite people into a clearly
            labelled rehearsal.
          </p>
          <Button
            onClick={() => void create("SAMPLE")}
            busy={busy === "SAMPLE"}
            disabled={!!busy}
          >
            <Sparkles size={16} />
            Open my sample production
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
      <div className="demo-mode own-production">
        <div>
          <Badge dot={false}>Your own room</Badge>
          <h2>Start with what you know.</h2>
          <p>
            Enter your venue, quote sources and supplier offers. Publish your
            own proposal, collect interest and manage free places. Every
            operational claim stays yours.
          </p>
          <Button
            variant="secondary"
            onClick={() => void create("REAL")}
            busy={busy === "REAL"}
            disabled={!!busy}
          >
            <DoorOpen size={16} />
            Start my own production
            <ArrowUpRight size={16} />
          </Button>
        </div>
      </div>
      {error ? (
        <p className="public-error" role="alert">
          {error}
        </p>
      ) : null}
      <Link className="text-link" href="/studio">
        Return to my saved desk
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}

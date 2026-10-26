"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Check, FolderOpen, Plus, X } from "lucide-react";
import { useWorkspace } from "./workspace-context";
import { Badge, Button } from "./ui";
type Desk = {
  id: string;
  title: string;
  mode: "SAMPLE" | "REAL";
  lifecycle: string;
  updatedAt: string;
  expiresAt: string;
};
export function WorkspaceMenu() {
  const { workspace, openWorkspace, busy } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/workspaces", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message || "Could not open the saved production list.",
        );
      setDesks(data.workspaces);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load your productions.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function choose(
    input: { workspaceId: string } | { mode: "SAMPLE" | "REAL" },
  ) {
    if (await openWorkspace(input)) {
      setOpen(false);
      router.push("/studio");
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) void load();
      }}
    >
      <Dialog.Trigger asChild>
        <button className="nav-link workspace-menu-trigger">
          <FolderOpen size={16} />
          Your productions
          <Plus size={13} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="modal dark-modal workspace-modal">
          <Dialog.Close
            className="icon-button modal-close"
            aria-label="Close productions"
          >
            <X size={18} />
          </Dialog.Close>
          <div className="eyebrow">YOUR SAVED EVENINGS</div>
          <Dialog.Title>
            There’s always
            <br />
            <em>another good night.</em>
          </Dialog.Title>
          <Dialog.Description>
            Each production has its own venue, people, evidence and approvals.
            Opening another keeps this one saved.
          </Dialog.Description>
          {error ? (
            <p className="feedback feedback-error" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p role="status">Opening your production list…</p>
          ) : (
            <div className="saved-desks">
              {desks.map((d) => (
                <button
                  key={d.id}
                  className={`saved-desk ${workspace?.id === d.id ? "current" : ""}`}
                  disabled={!!busy || d.id === workspace?.id}
                  onClick={() => void choose({ workspaceId: d.id })}
                >
                  <div>
                    <Badge
                      tone={d.mode === "SAMPLE" ? "warning" : "neutral"}
                      dot={false}
                    >
                      {d.mode === "SAMPLE" ? "Sample" : "Your production"}
                    </Badge>
                    <strong>{d.title}</strong>
                    <span>
                      {d.lifecycle.toLowerCase().replaceAll("_", " ")}
                    </span>
                  </div>
                  {workspace?.id === d.id ? (
                    <Check size={17} />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="new-desk-options">
            <Button
              disabled={!!busy}
              onClick={() => void choose({ mode: "REAL" })}
            >
              <Plus size={16} />
              New own production
            </Button>
            <Button
              variant="secondary"
              disabled={!!busy}
              onClick={() => void choose({ mode: "SAMPLE" })}
            >
              New sample rehearsal
            </Button>
          </div>
          <p className="field-hint">
            This browser holds your owner access. Participant and supplier links
            only open their own scoped response.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

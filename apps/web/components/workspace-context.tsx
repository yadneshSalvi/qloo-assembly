"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActionType, ApiError, Workspace } from "@assembly/contracts";
interface Context {
  workspace: Workspace | null;
  loading: boolean;
  busy: string | null;
  error: string | null;
  notice: string | null;
  refresh: () => Promise<void>;
  act: (
    type: ActionType,
    payload?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; token?: string }>;
  reset: () => Promise<boolean>;
  openWorkspace: (
    input: { mode: "SAMPLE" | "REAL" } | { workspaceId: string },
  ) => Promise<boolean>;
  clearError: () => void;
}
const WorkspaceContext = createContext<Context | null>(null);
// Deduplicate the initial cookie-establishing request across Strict Mode effect mounts.
// The database remains authoritative; this promise is discarded as soon as it settles.
let initialRequest: Promise<Workspace> | undefined;
async function readWorkspace(): Promise<Workspace> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error?.message || "The workspace could not be loaded.",
    );
  return data;
}
function bootstrapWorkspace() {
  initialRequest ??= readWorkspace().finally(() => {
    initialRequest = undefined;
  });
  return initialRequest;
}
const messageFor = (e: unknown) =>
  e instanceof Error ? e.message : "Could not connect to the studio.";
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const stateRef = useRef<Workspace | null>(null);
  const accept = useCallback((data: Workspace) => {
    if (
      stateRef.current?.id === data.id &&
      stateRef.current.version > data.version
    )
      return;
    stateRef.current = data;
    setWorkspace(data);
  }, []);
  const refresh = useCallback(async () => {
    try {
      accept(await readWorkspace());
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setLoading(false);
    }
  }, [accept]);
  useEffect(() => {
    const onFocus = () => {
      if (!busy) void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [busy, refresh]);
  useEffect(() => {
    let active = true;
    bootstrapWorkspace()
      .then((data) => {
        if (active) accept(data);
      })
      .catch((e) => {
        if (active) setError(messageFor(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accept]);
  useEffect(() => {
    if (
      busy ||
      (workspace?.run?.status !== "QUEUED" &&
        workspace?.run?.status !== "RUNNING" &&
        workspace?.research?.search?.status !== "QUEUED" &&
        workspace?.research?.search?.status !== "RUNNING")
    )
      return;
    const timer = setInterval(() => void refresh(), 1000);
    return () => clearInterval(timer);
  }, [
    workspace?.run?.status,
    workspace?.research?.search?.status,
    busy,
    refresh,
  ]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const act = useCallback(
    async (type: ActionType, payload: Record<string, unknown> = {}) => {
      const current = stateRef.current;
      if (!current) return { ok: false };
      setBusy(type);
      setError(null);
      setNotice(null);
      try {
        const response = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            workspaceId: current.id,
            payload,
            expectedVersion: current.version,
            idempotencyKey: crypto.randomUUID(),
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          if ((data as ApiError).error?.code === "stale_version")
            await refresh();
          const details = data.error?.details?.length
            ? ` ${data.error.details.join(" ")}`
            : "";
          throw new Error(
            (data.error?.message || "That action could not be saved.") +
              details,
          );
        }
        accept(data.workspace);
        setNotice(data.message);
        return { ok: true, token: data.token as string | undefined };
      } catch (e) {
        setError(messageFor(e));
        return { ok: false };
      } finally {
        setBusy(null);
      }
    },
    [refresh, accept],
  );
  const reset = useCallback(async () => {
    setBusy("RESET");
    setError(null);
    try {
      const response = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: stateRef.current?.id,
          expectedVersion: stateRef.current?.version,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message || "The sample could not be reset.",
        );
      stateRef.current = data;
      setWorkspace(data);
      setNotice("A fresh sample is ready.");
      return true;
    } catch (e) {
      setError(messageFor(e));
      return false;
    } finally {
      setBusy(null);
    }
  }, []);
  const openWorkspace = useCallback(
    async (input: { mode: "SAMPLE" | "REAL" } | { workspaceId: string }) => {
      setBusy("WORKSPACE");
      setError(null);
      try {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error?.message || "This production could not be opened.",
          );
        const next = (data.workspace ?? data) as Workspace;
        stateRef.current = next;
        setWorkspace(next);
        setNotice("Your production desk is ready.");
        return true;
      } catch (cause) {
        setError(messageFor(cause));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [],
  );
  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        loading,
        busy,
        error,
        notice,
        refresh,
        act,
        reset,
        openWorkspace,
        clearError: () => setError(null),
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("WorkspaceProvider is required");
  return context;
}

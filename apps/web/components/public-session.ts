"use client";
import { useCallback, useEffect, useRef, useState } from "react";
async function loadView<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error?.message || "This invitation could not be opened.",
    );
  return result as T;
}

/** Public screens never bootstrap or request an operator workspace. */
export function usePublicView<T>(endpoint: string) {
  const [view, setView] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const readSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++readSequence.current;
    try {
      const result = await loadView<T>(endpoint);
      if (mounted.current && sequence === readSequence.current) {
        setView(result);
        setError(null);
      }
    } catch (cause) {
      if (mounted.current && sequence === readSequence.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "We could not connect. Your saved choice is safe.",
        );
    } finally {
      if (mounted.current && sequence === readSequence.current)
        setLoading(false);
    }
  }, [endpoint]);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    const sequence = ++readSequence.current;
    loadView<T>(endpoint)
      .then((result) => {
        if (active && sequence === readSequence.current) {
          setView(result);
          setError(null);
        }
      })
      .catch((cause) => {
        if (active && sequence === readSequence.current)
          setError(
            cause instanceof Error
              ? cause.message
              : "We could not open this invitation.",
          );
      })
      .finally(() => {
        if (active && sequence === readSequence.current) setLoading(false);
      });
    const onFocus = () => {
      if (!pending.current) void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      mounted.current = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [endpoint, refresh]);
  const act = useCallback(
    async (input: { type: string; [key: string]: unknown }) => {
      if (pending.current) return { ok: false };
      pending.current = true;
      readSequence.current++;
      setBusy(input.type);
      setError(null);
      setNotice(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            idempotencyKey: crypto.randomUUID(),
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          if (result.error?.code === "stale_version") await refresh();
          throw new Error(
            [
              result.error?.message || "This choice could not be saved.",
              ...(result.error?.details || []),
            ].join(" "),
          );
        }
        if (mounted.current) {
          if (result.view && !result.token) setView(result.view as T);
          setNotice(result.message || "Your response is saved.");
        }
        return { ok: true, token: result.token as string | undefined };
      } catch (cause) {
        if (mounted.current)
          setError(
            cause instanceof Error
              ? cause.message
              : "We could not connect. Try again when you are online.",
          );
        return { ok: false };
      } finally {
        pending.current = false;
        if (mounted.current) setBusy(null);
      }
    },
    [endpoint, refresh],
  );
  return { view, loading, busy, error, notice, refresh, act };
}

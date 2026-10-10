import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { api } from "./api";
const guards = new Set<() => Promise<boolean>>();
export async function flushEdits() {
  for (const flush of [...guards]) if (!(await flush())) return false;
  return true;
}
type Working<T> = {
  revision: number;
  body: T;
  requestId: string;
  result?: unknown;
};
export function useAutoSave<T extends object>(
  value: T,
  setValue: Dispatch<SetStateAction<T>>,
  endpoint: string,
  working = false,
) {
  const [status, setStatus] = useState(
    working ? "Loading draft…" : "No changes",
  );
  const [error, setError] = useState("");
  const [ready, setReady] = useState(!working);
  const reload = useRef<() => Promise<boolean>>(async () => false);
  const ref = useRef({
    value,
    ack: JSON.stringify(value),
    revision: 0,
    ready: !working,
    pending: null as Promise<boolean> | null,
    request: null as { body: T; revision: number; requestId: string } | null,
    failed: false,
  });
  ref.current.value = value;
  const flush = async (): Promise<boolean> => {
    const s = ref.current;
    if (!s.ready) return reload.current();
    if (s.pending) return s.pending;
    if (JSON.stringify(s.value) === s.ack && !s.request) return true;
    s.pending = (async () => {
      try {
        while (JSON.stringify(s.value) !== s.ack || s.request) {
          if (!working && "id" in s.value && !s.value.id) {
            s.value = { ...s.value, id: crypto.randomUUID() };
            setValue(s.value);
          }
          const sent = structuredClone(s.value);
          setStatus("Saving…");
          setError("");
          let saved: T;
          if (working) {
            s.request ??= {
              body: sent,
              revision: s.revision,
              requestId: crypto.randomUUID(),
            };
            const result = await api<Working<T>>(endpoint, s.request);
            saved = result.body;
            s.revision = result.revision;
            s.request = null;
          } else saved = await api<T>(endpoint, sent);
          if (!working) {
            // Only merge server metadata into newer typing; never replace newer field edits.
            const metadata = saved as T & { id: string; revision: number };
            const merged =
              JSON.stringify(s.value) === JSON.stringify(sent)
                ? saved
                : { ...s.value, id: metadata.id, revision: metadata.revision };
            s.value = merged;
            setValue(merged);
          }
          s.ack = JSON.stringify(saved);
        }
        s.failed = false;
        setStatus(working ? "Draft saved · not published" : "Saved");
        return true;
      } catch (e) {
        s.failed = true;
        setStatus("Unable to save");
        setError((e as Error).message);
        return false;
      } finally {
        s.pending = null;
      }
    })();
    return s.pending;
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    let active = true;
    reload.current = async () => {
      try {
        const d = await api<Working<T> | null>(endpoint);
        if (!active) return false;
        const s = ref.current;
        s.revision = d?.revision ?? 0;
        if (d && !d.result) {
          s.value = d.body;
          s.ack = JSON.stringify(d.body);
          setValue(d.body);
          setStatus("Draft saved · not published");
        } else {
          s.ack = JSON.stringify(s.value);
          setStatus("No unpublished changes");
        }
        s.ready = true;
        setReady(true);
        setError("");
        return true;
      } catch (e) {
        if (active) {
          setError((e as Error).message);
          setStatus("Unable to load draft");
        }
        return false;
      }
    };
    if (working) void reload.current();
    const guard = () => flushRef.current();
    guards.add(guard);
    const unload = (e: BeforeUnloadEvent) => {
      const s = ref.current;
      if (s.pending || JSON.stringify(s.value) !== s.ack) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      active = false;
      guards.delete(guard);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  useEffect(() => {
    if (!ready || JSON.stringify(value) === ref.current.ack) return;
    setStatus("Unsaved changes");
    // A failed request is retried only by an explicit retry or a subsequent field edit.
    const timer = setTimeout(() => {
      void flushRef.current();
    }, 750);
    return () => clearTimeout(timer);
  }, [value, ready]);
  return {
    status,
    error,
    ready,
    flush,
    markPublished: () => setStatus("Published / finalised"),
    revision: () => ref.current.revision,
    download: () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(ref.current.value, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "kitchen-unsaved-edits.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    reset: (next: T, changed = false) => {
      ref.current.value = next;
      ref.current.ack = changed ? "" : JSON.stringify(next);
      ref.current.request = null;
      setValue(next);
      setError("");
      setStatus("No changes");
    },
    accept: (next: T) => {
      ref.current.value = next;
      ref.current.ack = JSON.stringify(next);
      setValue(next);
      setStatus("Published");
    },
    dirty: JSON.stringify(value) !== ref.current.ack,
  };
}
export function SaveStatus({
  save,
}: {
  save: {
    status: string;
    error: string;
    flush: () => Promise<boolean>;
    download?: () => void;
  };
}) {
  return (
    <div className="save-status" aria-live="polite">
      <span>{save.status}</span>
      {save.error && (
        <>
          <p role="alert">
            {save.error} Your edits remain in this form. For a conflict,
            download your edits before reopening the latest record to merge
            them.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => void save.flush()}
          >
            Retry save
          </button>
          {save.download && (
            <button type="button" className="secondary" onClick={save.download}>
              Download edits
            </button>
          )}
        </>
      )}
    </div>
  );
}

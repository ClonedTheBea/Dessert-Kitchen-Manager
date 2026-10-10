import { Store } from "lucide-react";
import { useState } from "react";
import { useAutoSave, SaveStatus } from "../autoSave";
import type { State, Supplier } from "../types";
import RecordManagement from "./RecordManagement";

import { ErrorBox, Field, Modal, clone, type Notify } from "../components/ui";
export default function Suppliers({
  state,
  refresh,
  notify,
  close,
}: {
  state: State;
  refresh: () => Promise<void>;
  notify: Notify;
  close: () => void;
}) {
  const [managing, setManaging] = useState<Supplier>();
  const [showArchived, setShowArchived] = useState(false);
  const blank = { id: "", revision: 0, name: "", contact: "", notes: "" };
  const [draft, setDraft] = useState<Supplier>(blank);
  const autosave = useAutoSave(draft, setDraft, "/suppliers");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Your suppliers"
      close={async () => {
        if (await autosave.flush()) {
          await refresh();
          close();
        }
      }}
    >
      <label className="checkbox">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Include archived suppliers
      </label>
      <div className="supplier-list">
        {state.suppliers
          .filter((s) => showArchived || !s.archived)
          .map((s) => (
            <button
              key={s.id}
              onClick={async () => {
                if (await autosave.flush()) autosave.reset(clone(s));
              }}
            >
              <Store size={18} />
              <span>
                {s.name}
                {s.archived && " · Archived"}
                <small>{s.contact || "No contact details"}</small>
              </span>
              <span>Edit</span>
            </button>
          ))}
      </div>
      {draft.id && (
        <button className="text-button" onClick={() => setManaging(draft)}>
          Manage supplier · archive / restore / delete
        </button>
      )}
      {managing && (
        <RecordManagement
          kind="supplier"
          record={managing}
          close={() => setManaging(undefined)}
          saved={async () => {
            await refresh();
            autosave.reset(blank);
            notify("Supplier record updated. History preserved.");
          }}
        />
      )}
      <h3>{draft.id ? "Edit supplier" : "Add supplier"}</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            if (!(await autosave.flush())) return;
            await refresh();
            autosave.reset(blank);
            notify("Supplier saved.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="editor-save-bar">
          <SaveStatus save={autosave} />
        </div>
        <Field label="Supplier name">
          <input
            required
            maxLength={200}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Contact / website">
          <input
            value={draft.contact}
            onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </Field>
        <ErrorBox error={error} />
        <div className="form-actions">
          {draft.id && (
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                if (await autosave.flush()) autosave.reset(blank);
              }}
            >
              New supplier
            </button>
          )}
          <button className="primary" disabled={busy}>
            Save supplier
          </button>
        </div>
      </form>
    </Modal>
  );
}

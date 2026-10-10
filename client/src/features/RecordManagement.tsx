import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorBox, Modal } from "../components/ui";
export default function RecordManagement({
  kind,
  record,
  close,
  saved,
}: {
  kind: "ingredient" | "supplier";
  record: { id: string; name: string; revision: number; archived?: boolean };
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [dependencies, setDependencies] = useState<string[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<string[]>(`/records/${kind}/${record.id}/dependencies`)
      .then(setDependencies)
      .catch((e) => setError(e.message));
  }, [kind, record.id]);
  const manage = async (action: string) => {
    if (
      !confirm(
        action === "delete"
          ? `Permanently delete unused ${kind} “${record.name}”? This cannot be undone.`
          : `${action === "archive" ? "Archive" : "Restore"} “${record.name}”? Historical recipes and prices will be kept.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`/records/${kind}/${record.id}/manage`, {
        action,
        revision: record.revision,
      });
      await saved();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`Manage ${record.name}`} close={close}>
      <p>
        Status: <strong>{record.archived ? "Archived" : "Active"}</strong>
      </p>
      <p>
        Archiving hides this record from new selections. Existing recipes,
        supplier prices and historical cost snapshots remain available.
      </p>
      <h3>Permanent deletion</h3>
      {dependencies === undefined ? (
        <p>Checking dependencies…</p>
      ) : dependencies.length ? (
        <>
          <p>Deletion is unavailable because this record is referenced by:</p>
          <ul className="dependency-list">
            {dependencies.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>
          No dependent records. This unused record can be permanently deleted.
        </p>
      )}
      <ErrorBox error={error} />
      <div className="form-actions">
        <button
          className="secondary danger"
          disabled={
            busy || dependencies === undefined || dependencies.length > 0
          }
          onClick={() => manage("delete")}
        >
          Delete permanently
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => manage(record.archived ? "restore" : "archive")}
        >
          {record.archived ? "Restore record" : "Archive record"}
        </button>
      </div>
    </Modal>
  );
}
